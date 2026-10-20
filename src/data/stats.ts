/**
 * 每个账号一份的游戏数据（userStats），存在 LocalStorage 的 `cp.stats.v1.<userId>` 上。
 *
 * 口径只有一条：真实注册的账号一律从全 0 起步，只有「极速游客体验」的游客账号
 * 自带一套满级档，点进来就能看到饱满的雷达图、解锁的徽章和好看的战绩。
 *
 * 存档里只留 xp 一个成长数字，而且是「累计」总量：等级由 data/ranks 的 xpToReachLevel
 * 反推，段位由 getRankInfo 按门槛折算。这样名片、顶栏、排行榜不可能各说各话，
 * 也不会出现「段位是王者、等级还是 Lv.1」。
 * 判题后端接上之后，这个文件的读写换成接口，下面的派生选择器（胜率、连续打卡、足迹）
 * 可以原样留着——它们只认 userStats 的形状，不关心数据从哪来。
 */
import type { ModeId } from './arena'
import { BADGE_CATALOG, SKILL_AXES } from './player'
import type { SkillId } from './player'
import { readJson, remove, writeJson } from '../lib/storage'
import { xpToReachLevel } from './ranks'

export type MatchResult = 'win' | 'loss'

export type MatchRecord = {
  id: string
  result: MatchResult
  opponent: string
  mode: ModeId
  detail: string
  points: number
  when: string
  /** 竞速用时（秒），只有计时玩法才有；「最快通关」从这些里取最小值 */
  seconds?: number
}

export type UserStats = {
  /** 累计经验值：等级和段位都从这一个数字推导，存量的老档案里可能还有 level/tier 字段，读到时直接忽略 */
  xp: number
  coins: number
  guild: string
  /** 通关题数：只算每道题的首次通关，重刷不重复计数（防刷名单见 data/rewards.ts） */
  cleared: number
  /** 徽章 id → 获得那天；没在这张表里的就是还没解锁 */
  badges: Record<string, string>
  /** 未解锁徽章的实时进度文案，缺省时用徽章目录里的 hint */
  badgeProgress: Record<string, string>
  skills: Record<SkillId, number>
  /** 'YYYY-MM-DD' → 那天手写的行数；只存有写过的一天 */
  linesByDay: Record<string, number>
  /** 'YYYY-MM-DD' → 那天编辑器真正在用的秒数；心跳来自 hooks/useCodingTimer */
  codingByDay: Record<string, number>
  matches: MatchRecord[]
}

export type FootprintCell = {
  date: Date
  lines: number
  /** 0–4 的深浅档位，对应格子图的 5 层绿 */
  level: number
  /** 今天之后的那几天还没发生，格子上要留空而不是画成「没写」 */
  future: boolean
}

const STATS_PREFIX = 'cp.stats.v1.'
export const FOOTPRINT_WEEKS = 6
export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** 按「天」做日历运算，跨过夏令时也不会差一天 */
function addDays(base: Date, days: number) {
  const copy = new Date(base)
  copy.setDate(copy.getDate() + days)
  return copy
}

/** 本地日期键，故意不用 toISOString——UTC 会把晚上写的代码记到第二天 */
function dateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dayAgoText(daysAgo: number) {
  return dateKey(addDays(startOfDay(new Date()), -daysAgo))
}

function zeroSkills(): Record<SkillId, number> {
  return SKILL_AXES.reduce(
    (acc, axis) => {
      acc[axis.id] = 0
      return acc
    },
    {} as Record<SkillId, number>,
  )
}

/** 真实注册账号的初始档案——荣誉室全是空的，得自己挣。0 XP = 青铜、Lv.0 */
export function emptyStats(): UserStats {
  return {
    xp: 0,
    coins: 0,
    guild: '新晋玩家 · 第 3 赛季',
    cleared: 0,
    badges: {},
    badgeProgress: {},
    skills: zeroSkills(),
    linesByDay: {},
    codingByDay: {},
    matches: [],
  }
}

/* ---------------------------------------------------- 游客满级档（不进正式注册） */

/** 近 6 周每天手写行数，下标 = 多少天前；只填到 35 天前，保证任何一天打开都能整段画进窗口，合计 1500 行 */
const GUEST_LINES = [
  52, 38, 101, 54, 53, 86, 59, 64, 56, 0, 43, 65, 0, 31, 50, 0, 79, 24, 0, 48, 67, 66, 0, 29, 58, 74,
  0, 41, 60, 0, 34, 46, 30, 66, 0, 26,
]

const GUEST_SKILLS: Record<SkillId, number> = {
  logic: 96,
  syntax: 92,
  style: 88,
  algo: 84,
  creative: 90,
}

/** 13 胜 6 负 → 胜率 68%，胜负场次和积分都从这张表里数出来 */
const GUEST_MATCHES: MatchRecord[] = [
  { id: 'g1', result: 'win', opponent: '极客小明', mode: 'debug', detail: '用时 2分15秒', points: 25, when: '今天 20:41', seconds: 135 },
  { id: 'g2', result: 'loss', opponent: '夜航员的猫', mode: 'debug', detail: '用时 4分02秒 · 差 1 个用例', points: -12, when: '今天 19:58' },
  { id: 'g3', result: 'win', opponent: '小林同学', mode: 'golf', detail: '11 行 · 对手 17 行', points: 30, when: '昨天 22:10' },
  { id: 'g4', result: 'win', opponent: '半糖主义', mode: 'debug', detail: '用时 1分48秒 · 本场最快', points: 28, when: '昨天 21:03', seconds: 108 },
  { id: 'g5', result: 'loss', opponent: 'Ctrl_Alt_Dog', mode: 'maze', detail: '卡在出口前 3 格', points: -10, when: '周一 18:26' },
  { id: 'g6', result: 'win', opponent: '阿吉不加班', mode: 'debug', detail: '用时 2分03秒', points: 26, when: '周日 21:14', seconds: 123 },
  { id: 'g7', result: 'win', opponent: '小林同学', mode: 'debug', detail: '用时 2分41秒', points: 32, when: '10月12日' },
  { id: 'g8', result: 'win', opponent: '半糖主义', mode: 'debug', detail: '用时 1分59秒', points: 29, when: '10月12日' },
  { id: 'g9', result: 'loss', opponent: '极客小明', mode: 'debug', detail: '差 2 个用例', points: -12, when: '10月11日' },
  { id: 'g10', result: 'win', opponent: '阿吉不加班', mode: 'golf', detail: '9 行 · 对手 14 行', points: 34, when: '10月10日' },
  { id: 'g11', result: 'win', opponent: '夜航员的猫', mode: 'debug', detail: '用时 2分12秒', points: 27, when: '10月9日' },
  { id: 'g12', result: 'loss', opponent: 'Ctrl_Alt_Dog', mode: 'maze', detail: '撞墙 6 次', points: -9, when: '10月8日' },
  { id: 'g13', result: 'win', opponent: '小林同学', mode: 'debug', detail: '用时 1分37秒 · 赛季最快', points: 38, when: '10月7日', seconds: 97 },
  { id: 'g14', result: 'win', opponent: '半糖主义', mode: 'golf', detail: '13 行 · 对手 21 行', points: 31, when: '10月6日' },
  { id: 'g15', result: 'loss', opponent: '极客小明', mode: 'maze', detail: '绕了远路', points: -14, when: '10月5日' },
  { id: 'g16', result: 'win', opponent: '阿吉不加班', mode: 'debug', detail: '用时 2分28秒', points: 26, when: '10月4日' },
  { id: 'g17', result: 'win', opponent: '夜航员的猫', mode: 'debug', detail: '用时 1分52秒', points: 35, when: '10月3日' },
  { id: 'g18', result: 'loss', opponent: '小林同学', mode: 'debug', detail: '超时没跑通', points: -11, when: '10月2日' },
  { id: 'g19', result: 'win', opponent: '半糖主义', mode: 'debug', detail: '用时 2分06秒', points: 41, when: '10月1日' },
]

/**
 * 王者账号不可能只写了 6 周代码。42 天以前到 126 天以前再铺一层老足迹，
 * 格子图只看近 6 周所以画不到它们，但「累计手写行数」会把它们算进去，
 * 数字上去到四千多行——这才配得上封顶段位。
 */
function veteranLines(): Record<string, number> {
  const out: Record<string, number> = {}
  for (let daysAgo = 42; daysAgo <= 126; daysAgo += 1) {
    if (daysAgo % 7 === 0) continue
    out[dayAgoText(daysAgo)] = 18 + ((daysAgo * 13) % 46)
  }
  return out
}

function guestLines(): Record<string, number> {
  const recent = GUEST_LINES.reduce(
    (acc, lines, daysAgo) => {
      if (lines > 0) acc[dayAgoText(daysAgo)] = lines
      return acc
    },
    {} as Record<string, number>,
  )
  return { ...veteranLines(), ...recent }
}

/** 游客体验档：2500 累计 XP → 王者 · Lv.9，8888 金币、四千余行、68 题通关、徽章全亮 */
export function guestStats(): UserStats {
  return {
    xp: 2500,
    coins: 8888,
    guild: '手写派 · 第 3 赛季',
    cleared: 68,
    badges: {
      b1: '9月12日',
      b2: '9月20日',
      b3: '9月28日',
      b4: '10月3日',
      b5: '10月9日',
      b6: '10月12日',
      b7: '今天',
    },
    badgeProgress: {},
    skills: { ...zeroSkills(), ...GUEST_SKILLS },
    linesByDay: guestLines(),
    /** 游客档是给人看演示的，今天先垫 45 分钟；后面真的写代码照样往这一格累加 */
    codingByDay: { [dayAgoText(0)]: 45 * 60 },
    matches: GUEST_MATCHES,
  }
}

/* ------------------------------------------------------------------ 读写 */

/**
 * 老数据可能缺字段，一律用 emptyStats 兜底补齐，别让页面读到 undefined。
 * 上一版的 xp 记的是「本级内进度」，所以带 level 的旧档案先折算成累计 XP 再读；
 * 逐字段取而不是整体展开，顺手把已经作废的 level / tier 旧键丢掉。
 */
function normalize(raw: Partial<UserStats> & { level?: number } | null): UserStats {
  if (!raw) return emptyStats()
  const withinLevel = Math.max(0, Math.floor(raw.xp ?? 0))
  const toThisLevel = xpToReachLevel(Math.max(0, Math.floor(raw.level ?? 0)))
  return {
    xp: withinLevel + toThisLevel,
    coins: Math.max(0, Math.floor(raw.coins ?? 0)),
    guild: raw.guild ?? '新晋玩家 · 第 3 赛季',
    cleared: Math.max(0, Math.floor(raw.cleared ?? 0)),
    badges: raw.badges ?? {},
    badgeProgress: raw.badgeProgress ?? {},
    skills: { ...zeroSkills(), ...(raw.skills ?? {}) },
    linesByDay: raw.linesByDay ?? {},
    codingByDay: raw.codingByDay ?? {},
    matches: Array.isArray(raw.matches) ? raw.matches : [],
  }
}

export function readStats(userId: string): UserStats {
  return normalize(readJson<Partial<UserStats>>(`${STATS_PREFIX}${userId}`))
}

export function writeStats(userId: string, stats: UserStats): boolean {
  return writeJson(`${STATS_PREFIX}${userId}`, stats)
}

/** 游客每次都当新号发；已有档案的账号（比如退出又登录）保持原样 */
export function ensureStats(userId: string, seed: () => UserStats): UserStats {
  const key = `${STATS_PREFIX}${userId}`
  if (readJson<Partial<UserStats>>(key)) return readStats(userId)
  const stats = seed()
  writeStats(userId, stats)
  return stats
}

export function purgeStats(userId: string) {
  remove(`${STATS_PREFIX}${userId}`)
}

/* ------------------------------------------------------------------ 派生 */

export function recordOf(stats: UserStats) {
  const wins = stats.matches.filter((match) => match.result === 'win').length
  return { wins, losses: stats.matches.length - wins, total: stats.matches.length }
}

export function winRateOf(stats: UserStats) {
  const { wins, total } = recordOf(stats)
  if (!total) return 0
  return Math.round((wins / total) * 100)
}

export function codeLinesOf(stats: UserStats) {
  return Object.values(stats.linesByDay).reduce((sum, lines) => sum + lines, 0)
}

/** 今天真实写了多少分钟；没记过就是 0，首页要的就是这个诚实答案 */
export function codingMinutesOf(stats: UserStats, daysAgo = 0) {
  return Math.floor((stats.codingByDay[dayAgoText(daysAgo)] ?? 0) / 60)
}

/** 连续打卡：从今天往前数，数到第一个没写的日子为止 */
export function streakOf(stats: UserStats) {
  let days = 0
  while ((stats.linesByDay[dayAgoText(days)] ?? 0) > 0) days += 1
  return days
}

export function busiestOf(stats: UserStats): { date: Date; lines: number } | null {
  let best: { date: Date; lines: number } | null = null
  for (const [key, lines] of Object.entries(stats.linesByDay)) {
    if (lines <= 0) continue
    if (!best || lines > best.lines) {
      const [year, month, day] = key.split('-').map(Number)
      best = { date: new Date(year, month - 1, day), lines }
    }
  }
  return best
}

function shadeOf(lines: number) {
  if (lines <= 0) return 0
  if (lines <= 20) return 1
  if (lines <= 45) return 2
  if (lines <= 70) return 3
  return 4
}

/** 按周一对齐的 6 周格子图；最后一列可能延伸到未来 */
export function footprintOf(stats: UserStats): FootprintCell[][] {
  const today = startOfDay(new Date())
  const mondayOffset = (today.getDay() + 6) % 7
  const windowStart = addDays(today, -(mondayOffset + (FOOTPRINT_WEEKS - 1) * 7))
  return Array.from({ length: FOOTPRINT_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(windowStart, week * 7 + day)
      const lines = stats.linesByDay[dateKey(date)] ?? 0
      return { date, lines, level: shadeOf(lines), future: date.getTime() > today.getTime() }
    }),
  )
}

export function bestTimeOf(stats: UserStats): string | null {
  const times = stats.matches
    .filter((match) => match.result === 'win' && match.seconds)
    .map((match) => match.seconds as number)
  if (!times.length) return null
  const fastest = Math.min(...times)
  return `${Math.floor(fastest / 60)}分${`${fastest % 60}`.padStart(2, '0')}秒`
}

export function radarOf(stats: UserStats) {
  return SKILL_AXES.map((axis) => ({ axis: axis.axis, score: stats.skills[axis.id] ?? 0 }))
}

/** 一个提交都没有时，雷达图缩在最中心，这里给一句解释而不是「综合 0」 */
export function hasSkillData(stats: UserStats) {
  return SKILL_AXES.some((axis) => (stats.skills[axis.id] ?? 0) > 0)
}

export function earnedBadgeCount(stats: UserStats) {
  return BADGE_CATALOG.filter((badge) => Boolean(stats.badges[badge.id])).length
}

/**
 * 挑战页判题通过后调这个：经验直接累加，等级和段位由累计值自己长出来，
 * 不需要在这里维护两个已经作废的字段。
 *
 * 五维分数是「涨多少」而不是「是多少」：满分 100，加到顶就停，
 * 所以同一道题反复刷不会把雷达图撑爆——何况调用处只在首次通关才发。
 * 行数落在 linesByDay 的今天这一格上，累计行数和格子图、连续打卡都是从它派生的。
 */
export function grantProgress(
  stats: UserStats,
  input: {
    xp?: number
    coins?: number
    lines?: number
    cleared?: number
    skill?: { id: SkillId; gain: number }
  },
): UserStats {
  const lines = input.lines ?? 0
  const today = dayAgoText(0)
  return {
    ...stats,
    xp: Math.max(0, stats.xp + (input.xp ?? 0)),
    coins: Math.max(0, stats.coins + (input.coins ?? 0)),
    cleared: Math.max(0, stats.cleared + (input.cleared ?? 0)),
    skills: input.skill
      ? {
          ...stats.skills,
          [input.skill.id]: Math.min(100, (stats.skills[input.skill.id] ?? 0) + input.skill.gain),
        }
      : stats.skills,
    linesByDay:
      lines > 0 ? { ...stats.linesByDay, [today]: (stats.linesByDay[today] ?? 0) + lines } : stats.linesByDay,
  }
}

/**
 * 编码计时心跳落笔的地方：每记一次就往「今天」这一格加真实秒数。
 * 记秒而不是记分钟，是因为一次心跳可能只有几十秒，砍成分钟会永远停在 0。
 */
export function addCodingSeconds(stats: UserStats, seconds: number): UserStats {
  if (seconds <= 0) return stats
  const today = dayAgoText(0)
  return {
    ...stats,
    codingByDay: { ...stats.codingByDay, [today]: (stats.codingByDay[today] ?? 0) + seconds },
  }
}
