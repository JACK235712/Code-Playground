/**
 * 账号体系（纯前端演示版）：注册表和会话都写在这台设备的 LocalStorage 里，没有任何后端。
 * 这里只管「你是谁」——等级、金币、战绩这些游戏数据在每个账号的 userStats 里，见 data/stats.ts。
 *
 * 【口径】两个键名按需求点名，全站只认这两个：
 *   registered_users = [{ email, password, username, id, handle, joined }, …]
 *   current_user     = 当前登录者（游客也写这里，但游客不进注册表）
 * 密码按需求存明文——前提是「纯本地演示、这台设备上的邮箱密码都是编的」，**不是安全设计**：
 * 接真后端那天，这个文件整个换成接口调用，明文口令既不进请求也不进日志。
 * id / handle / joined 是应用自己要用的身份数据：每个账号的存档按 id 存在
 * cp.stats.v1.<id> 上，所以它们跟 email / password / username 同行存放，不另开键。
 *
 * 绝对没有 localStorage.clear()：这个文件只做定点读写（remove 也只针对某一个键），
 * 清会话（signOut）不会碰注册表，退游客只清那个一次性游客档。
 *
 * 【启动不 destructive】页面加载时走的是 readSession()，它只读不删：
 * 注册表里查不到当前会话那一行，就当作没登录，但 current_user 原样留着——
 * 它是「这个浏览器里曾经登过谁」的唯一线索，删了反而查无可查。
 * 【写入不覆盖】saveUsers() 是并表不是替换：先读一遍当前表，把自己没带上的邮箱原样接下去，
 * 所以哪怕调用方手里是个空数组（存储临时读失败、旧数据解析不动），也不会把已注册的账号抹掉。
 * 真读到解析不动的原文，先整份挪到 registered_users.unreadable 备份，再允许被替换。
 */
import { readJson, readRaw, remove, writeJson } from '../lib/storage'

export type PlayerUser = {
  id: string
  nickname: string
  email: string
  handle: string
  joined: string
  /** 游客会话退出即销毁，也不写进注册表 */
  guest: boolean
}

/** registered_users 里的一行：前三位是需求点名的字段，后三位是应用需要的身份数据 */
export type StoredUser = {
  email: string
  password: string
  username: string
  id: string
  handle: string
  joined: string
  /**
   * 只有从旧版（口令存 djb2 摘要，明文拿不回来）迁进来的行才有这一位。
   * 拿旧密码登录成功一次，就当场升级成明文并删掉它——老账号因此不会因换键名而失踪。
   */
  legacySecret?: string
}

export type AuthResult = { ok: true; user: PlayerUser } | { ok: false; error: string }

/** 注册成功不再顺手登录：写完就回登录页，所以这里没有 user */
export type RegisterResult = { ok: true; email: string } | { ok: false; error: string }

const USERS_KEY = 'registered_users'
const SESSION_KEY = 'current_user'
/** registered_users 读到解析不动的原文时，整份挪到这里等人来看，不参与登录 */
const CORRUPT_KEY = 'registered_users.unreadable'
/** 旧键：只在第一次读到注册表时迁移一次，迁完就删 */
const LEGACY_USERS_KEY = 'cp.accounts.v1'
const LEGACY_SESSION_KEY = 'cp.session.v1'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NICKNAME_MIN = 2
const NICKNAME_MAX = 12
const PASSWORD_MIN = 6

/** 旧版口令的摘要算法，迁移过来的行还得靠它对一次 */
function digest(input: string) {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  return `d1:${(hash >>> 0).toString(36)}`
}

function shortId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

/** 展示用的 handle：直接取邮箱前缀，比随机串更像真正的账号名 */
function handleOf(email: string) {
  const local = email.split('@')[0].replace(/[^A-Za-z0-9._-]/g, '').slice(0, 16)
  return `@${local || 'player'}`
}

/** 注册表那一行 → 应用内部的身份对象（昵称在存档里叫 username，出去给页面用 nickname） */
function toUser(row: StoredUser): PlayerUser {
  return {
    id: row.id,
    nickname: row.username,
    email: row.email ?? '',
    handle: row.handle ?? '@player',
    joined: row.joined ?? '',
    guest: false,
  }
}

function toRow(user: PlayerUser): Omit<StoredUser, 'password'> {
  return {
    email: user.email,
    username: user.nickname,
    id: user.id,
    handle: user.handle,
    joined: user.joined,
  }
}

/** 把旧键里的账号搬进 registered_users；搬不动的（没邮箱的）直接丢掉，反正也登录不了 */
function migrateLegacyUsers(): StoredUser[] {
  const legacy = readJson<{ user?: PlayerUser; secret?: string }[]>(LEGACY_USERS_KEY)
  if (!Array.isArray(legacy)) return []
  const rows: StoredUser[] = []
  for (const item of legacy) {
    const user = item?.user
    if (!user?.id || !user.email || typeof item.secret !== 'string') continue
    rows.push({ ...toRow(user), password: '', legacySecret: item.secret })
  }
  remove(LEGACY_USERS_KEY)
  return rows
}

function normalize(raw: StoredUser): StoredUser | null {
  if (!raw?.id || typeof raw.email !== 'string' || !raw.email) return null
  return {
    email: raw.email,
    password: typeof raw.password === 'string' ? raw.password : '',
    username: typeof raw.username === 'string' && raw.username ? raw.username : '玩家',
    id: raw.id,
    handle: raw.handle ?? '@player',
    joined: raw.joined ?? '',
    ...(typeof raw.legacySecret === 'string' ? { legacySecret: raw.legacySecret } : {}),
  }
}

/**
 * 从 getItem 拿到的原文里读出注册表的行。三种情况分得很清楚：
 * 键不存在（这个浏览器桶本来就还没注册过人）、能 JSON.parse 成数组、坏了解析不动。
 * 坏的那种先把原文整份备份走，免得下一次写入把它就地盖掉——这是需求点名的「不能误删」。
 */
function readStoredRows(): StoredUser[] {
  const raw = readRaw(USERS_KEY)
  if (raw === null) return []
  const parsed = readJson<unknown>(USERS_KEY)
  if (!Array.isArray(parsed)) {
    writeJson(CORRUPT_KEY, { savedAt: new Date().toISOString(), raw })
    return []
  }
  return parsed.map(normalize).filter((row): row is StoredUser => row !== null)
}

/** 注册表读出来的一定是数组、一定带邮箱；老键的数据第一次读时并进来 */
function listUsers(): StoredUser[] {
  const users = readStoredRows()
  const migrated = migrateLegacyUsers()
  if (!migrated.length) return users
  const known = new Set(users.map((row) => row.email.toLowerCase()))
  const merged = [...users, ...migrated.filter((row) => !known.has(row.email.toLowerCase()))]
  saveUsers(merged)
  return merged
}

/**
 * 写注册表：并表，不是替换。
 * 先读一遍当前表，把自己这份没带上的邮箱原样接下去——所以调用方哪怕手里是个空数组，
 * 也不会把已经注册好的账号整体抹掉。同一邮箱以传进来的行为准（登录时补明文口令走的就是这条）。
 */
function saveUsers(next: StoredUser[]): boolean {
  const known = new Set(next.map((row) => row.email.toLowerCase()))
  const kept = readStoredRows().filter((row) => !known.has(row.email.toLowerCase()))
  return writeJson(USERS_KEY, [...next, ...kept])
}

export function validateNickname(nickname: string) {
  const value = nickname.trim()
  if (!value) return '给自己起个昵称吧'
  if (value.length < NICKNAME_MIN) return `昵称至少 ${NICKNAME_MIN} 个字`
  if (value.length > NICKNAME_MAX) return `昵称最多 ${NICKNAME_MAX} 个字`
  return null
}

export function validateEmail(email: string) {
  if (!email.trim()) return '邮箱不能为空'
  if (!EMAIL_RE.test(email.trim())) return '邮箱格式不太对，检查一下 @ 和域名'
  return null
}

export function validatePassword(password: string) {
  if (!password) return '密码不能为空'
  if (password.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位`
  return null
}

function buildUser(nickname: string, email: string, guest: boolean): PlayerUser {
  return {
    id: shortId(),
    nickname,
    email,
    handle: guest ? `@guest_${shortId().slice(-4)}` : handleOf(email),
    joined: today(),
    guest,
  }
}

/**
 * 注册：校验 → 按邮箱查重 → 写进 registered_users 就完事。
 * 这里不建会话，页面拿着 ok 跳回登录 tab，由用户自己登进来。
 */
export function register(input: { nickname: string; email: string; password: string }): RegisterResult {
  const nickname = input.nickname.trim()
  const email = input.email.trim()
  const error =
    validateNickname(nickname) ??
    validateEmail(email) ??
    validatePassword(input.password) ??
    (input.password !== input.password.trim() ? '密码首尾不要留空格' : null)
  if (error) return { ok: false, error }

  const users = listUsers()
  if (users.some((row) => row.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: '该邮箱已注册，请直接登录' }
  }

  const user = buildUser(nickname, email, false)
  if (!saveUsers([...users, { ...toRow(user), password: input.password }])) {
    return { ok: false, error: '这台设备的本地存储不可用（可能开了无痕模式）' }
  }
  // 需求点名的「写入证明」：落盘之后再把原文打一遍，能直接看见刚插进去的那一行
  console.log('注册成功，当前数据：', readRaw(USERS_KEY))
  return { ok: true, email: user.email }
}

/**
 * 登录：遍历 registered_users 找邮箱 → 找到了才比密码。
 * 两种失败分开报，学生才知道自己卡在哪一步。
 * 迁进来的老账号口令是摘要，所以留了第二条通道：摘要对上就放行，同时把明文补回那一行。
 */
export function login(input: { email: string; password: string }): AuthResult {
  const email = input.email.trim()
  const formatError = validateEmail(email)
  if (formatError) return { ok: false, error: formatError }
  if (!input.password) return { ok: false, error: '请输入密码' }

  const users = listUsers()
  const index = users.findIndex((row) => row.email.toLowerCase() === email.toLowerCase())
  if (index < 0) return { ok: false, error: '没找到这个邮箱，请先注册' }

  const row = users[index]
  if (row.password !== input.password) {
    if (!row.legacySecret || digest(input.password) !== row.legacySecret) {
      return { ok: false, error: '密码错误，请重试' }
    }
    users[index] = { ...row, password: input.password, legacySecret: undefined }
    saveUsers(users)
  }
  return saveSession(toUser(row))
}

export function loginAsGuest(): AuthResult {
  const nickname = `游客_${1000 + Math.floor(Math.random() * 9000)}`
  return saveSession(buildUser(nickname, '', true))
}

/** 会话 = 当前登录者，写进 current_user；游客不进注册表，所以它只活在这一个键里 */
function saveSession(user: PlayerUser): AuthResult {
  const payload = { ...user, username: user.nickname }
  if (!writeJson(SESSION_KEY, payload)) {
    return { ok: false, error: '这台设备的本地存储不可用（可能开了无痕模式）' }
  }
  return { ok: true, user }
}

/** 旧键里的会话也搬一次，免得升级当场把人踢下线 */
function migrateLegacySession(): void {
  const legacy = readJson<PlayerUser>(LEGACY_SESSION_KEY)
  if (legacy?.id) {
    writeJson(SESSION_KEY, { ...legacy, username: legacy.nickname })
    remove(LEGACY_SESSION_KEY)
  }
}

/**
 * 会话里的账号可能已经被删掉（清了存储或换了浏览器），所以每次启动都要回查一次注册表；
 * 游客不查，它本来就不在注册表里。
 */
export function readSession(): PlayerUser | null {
  const stored = readJson<PlayerUser & { username?: string }>(SESSION_KEY)
  if (!stored?.id) {
    migrateLegacySession()
    const revived = readJson<PlayerUser>(SESSION_KEY)
    if (!revived?.id) return null
    return revived.guest ? revived : readSessionForNonGuest(revived)
  }
  if (stored.guest) return stored
  return readSessionForNonGuest(stored)
}

function readSessionForNonGuest(stored: PlayerUser): PlayerUser | null {
  // 启动路径上只判断、不动手：注册表里查不到这一行就当没登录，
  // 但 current_user 一个字都不删——它是「这个浏览器里曾经登过谁」的唯一线索，
  // 删了下次排查就只剩「我明明注册过」这一句话了。真要清会话，由 signOut() 明着来。
  const row = listUsers().find((item) => item.id === stored.id)
  return row ? toUser(row) : null
}

export function signOut() {
  // 只收会话，注册表一个字节都不动
  remove(SESSION_KEY)
}

/**
 * 需求点名的排查日志：点登录那一刻把注册表原样打出来，好对着 DevTools 数条目。
 * 走 readRaw 而不是 readJson，打的就是 localStorage 里的原文（明文口令也在里面）。
 */
export function dumpRegisteredUsers() {
  console.log('当前已注册用户列表：', readRaw(USERS_KEY))
}
