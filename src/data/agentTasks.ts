/**
 * 数据分析师智能体的任务账本（纯前端演示：LocalStorage 就是它的后端队列）。
 *
 * 生命周期只有五条规矩，闭环全靠它们：
 *   1. 报告页生成的是一张 pending 卡，学生**点卡片**那一刻才写 activeTaskId，
 *      同一刻这张卡已经按「维度 + 难度」钉好了一道目标题（problemId）；
 *   2. 进挑战页时先按卡上的题目定位（答过就以 attemptId 为准，没答过用 problemId，
 *      两个都没有才退回题池第一题），然后给这张卡起表（startedAt）；
 *   3. 点「提交答案」时把耗时、判定结果和编辑器里的代码原样写回，通关才转 completed；
 *   4. alreadyReported 一旦为真这条账就封死，同一张卡不会被第二次提交覆盖，
 *      写回成功的瞬间 activeTaskId 也被清空——不会有「下次提交又记一笔」的鬼账；
 *   5. 没通过不算封账：状态留 pending，failCount +1、lastFailCode 记下差在哪，
 *      activeTaskId 不动，学生改完直接再提交；下次从账本点进来还会回到同一道题。
 *
 * 账本点「▶ 去完成」走 startTask()：它只写 activeTaskId 和 problemId 进 LocalStorage，
 * 再按卡片自带的 target_route 跳转，全程不调模型——所以从账本进去永远生成不出第二条任务。
 *
 * 上限 20 条。超了先从最老的「已完成」开始丢，pending 的卡永远留着：
 * 学生刚点的任务要是下一页就凭空消失，他会以为整个功能没生效。
 *
 * 【查重口径】每张卡都带一个代表维度的 taskKey 和一条 target_route。
 * 新卡只能通过 claimTask() 进账本：它先遍历现有记录，只要已经有一张同 taskKey 的
 * pending 卡，就不再写第二条，只把 activeTaskId 指回那张旧卡。所以「报告页反复点卡片」
 * 「首页和报告页各推一次同一维度的特训」都攒不出重复任务。
 * 读账本时同一维度的多张 pending 会收敛成最新那一张——查重规则上线前存下的重复旧卡，
 * 页面一打开就自动并成一条，不需要清缓存。
 * 反过来，任何页面想生成任务都得走这个函数——别处不要直接 createTask + saveTask，
 * 那样绕过查重，账本马上又开始堆积。
 */
import { readJson, remove, writeJson } from '../lib/storage'
import { axisKeyOf, DRILL_TARGET_ROUTE, starterProblemOf } from './analyst'
import type { Difficulty } from './problems'

export type TaskStatus = 'pending' | 'completed'

export type AgentTask = {
  id: string
  /** 给人看的生成时间，例如「10月19日 20:41」 */
  createdLabel: string
  /** 维度的中文标签，只用来显示 */
  axis: string
  /** 维度的稳定标识（logic / syntax / style / algo / creative）；pending 查重就按它 */
  taskKey: string
  /** 点卡片要去的路由 */
  target_route: string
  /**
   * 这张卡钉好的那道题（挑战页靠它选题）。生成时按维度配一题，
   * 学生一道没答过也有明确的去处；真答过之后以 attemptId 为准。
   */
  problemId: string | null
  goal: string
  reason: string
  minutes: number
  status: TaskStatus
  /** 挑战页起表的时刻（Date.now()）；还没进过挑战页就是 null */
  startedAt: number | null
  /** 从起表到点「提交答案」的毫秒差 */
  elapsedMs: number | null
  /** 判定结果一句话，原样来自挑战页 */
  verdict: string | null
  /** 提交那一刻从编辑器抓走的源码原文 */
  code: string | null
  /** 实际作答的那道题；失败也记，下次点「▶ 去完成」就回到这道题接着死磕 */
  attemptId: string | null
  attemptTitle: string | null
  /** 提交过但没通过的次数；只在判负时 +1，通关后不再动 */
  failCount: number
  /** 最后一次失败的机器码（error / timeout / missing / no-output），给人看的那句在 verdict 里 */
  lastFailCode: string | null
  /** 已经写回过一次 = 封账，后续提交不再动这条记录 */
  alreadyReported: boolean
}

export type TaskEvidence = {
  problemId: string
  problemTitle: string
  verdict: string
  code: string
  /** 这次提交到底通没通过：通过才封账，没通过留着卡继续重试 */
  passed: boolean
  /** 没通过时的机器码，通关时传 null */
  failCode?: string | null
}

export const MAX_TASKS = 20

const LEDGER_PREFIX = 'cp.agentTasks.v1.'
const ACTIVE_PREFIX = 'cp.agentTask.active.v1.'

function strOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function numOr(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 老档案或手改过的记录可能缺字段，逐字段兜底，别让报告页读到 undefined */
function normalizeTask(raw: unknown): AgentTask | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<AgentTask>
  if (typeof item.id !== 'string' || !item.id) return null
  const axis = strOr(item.axis, '')
  return {
    id: item.id,
    createdLabel: strOr(item.createdLabel, ''),
    axis,
    // 加字段之前存进账本的卡没有 taskKey，按它的维度现算一个补上，
    // 否则老卡和新卡是两套身份，查重正好在最常见的账号上失效
    taskKey: typeof item.taskKey === 'string' && item.taskKey ? item.taskKey : axisKeyOf(axis),
    target_route:
      typeof item.target_route === 'string' && item.target_route.startsWith('/')
        ? item.target_route
        : DRILL_TARGET_ROUTE,
    // 加字段之前存进账本的卡没有钉好的题目，按它的维度现配一道，
    // 保证「▶ 去完成」跳过去时挑战页总有题可选（难度只能退回 easy）
    problemId:
      typeof item.problemId === 'string' && item.problemId
        ? item.problemId
        : starterProblemOf(axisKeyOf(axis), 'easy').id,
    goal: strOr(item.goal, ''),
    reason: strOr(item.reason, ''),
    minutes: numOr(item.minutes) ?? 15,
    status: item.status === 'completed' ? 'completed' : 'pending',
    startedAt: numOr(item.startedAt),
    elapsedMs: numOr(item.elapsedMs),
    verdict: typeof item.verdict === 'string' ? item.verdict : null,
    code: typeof item.code === 'string' ? item.code : null,
    attemptId: typeof item.attemptId === 'string' ? item.attemptId : null,
    attemptTitle: typeof item.attemptTitle === 'string' ? item.attemptTitle : null,
    failCount: numOr(item.failCount) ?? 0,
    lastFailCode: typeof item.lastFailCode === 'string' ? item.lastFailCode : null,
    alreadyReported: item.alreadyReported === true,
  }
}

/** 同一维度只留最新那张 pending；已完成的卡各留各的，练过几轮都是历史 */
function collapsePending(tasks: AgentTask[]): AgentTask[] {
  const seen = new Set<string>()
  return tasks.filter((task) => {
    if (task.status !== 'pending') return true
    if (seen.has(task.taskKey)) return false
    seen.add(task.taskKey)
    return true
  })
}

/** 新卡在前；先收敛同维度的重复 pending，再按 20 条上限淘汰最老的已完成项 */
function trim(tasks: AgentTask[]): AgentTask[] {
  const out = collapsePending(tasks)
  if (out.length <= MAX_TASKS) return out
  const kept = [...out]
  for (let i = kept.length - 1; i >= 0 && kept.length > MAX_TASKS; i -= 1) {
    if (kept[i].status === 'completed') kept.splice(i, 1)
  }
  return kept.slice(0, MAX_TASKS)
}

/**
 * 读出来就已经是「同一维度最多一张 pending」的形状：
 * 查重规则上线前攒下的重复旧卡不用等迁移脚本，页面一打开就收敛成一张，
 * 下一次写入直接把收敛后的形状落盘。
 */
export function readTasks(userId: string): AgentTask[] {
  const raw = readJson<unknown>(`${LEDGER_PREFIX}${userId}`)
  if (!Array.isArray(raw)) return []
  return collapsePending(
    raw
      .map(normalizeTask)
      .filter((task): task is AgentTask => task !== null)
      .slice(0, MAX_TASKS),
  )
}

function writeTasks(userId: string, tasks: AgentTask[]): void {
  writeJson(`${LEDGER_PREFIX}${userId}`, trim(tasks))
}

/** 任务 id 只要在本设备唯一就够了 */
export function newTaskId(): string {
  const salt = Math.floor(Math.random() * 46656)
    .toString(36)
    .padStart(3, '0')
  return `t${Date.now().toString(36)}${salt}`
}

export function createdLabelOf(at: Date): string {
  const hour = `${at.getHours()}`.padStart(2, '0')
  return `${at.getMonth() + 1}月${at.getDate()}日 ${hour}:${`${at.getMinutes()}`.padStart(2, '0')}`
}

export type TaskSpec = {
  axis: string
  goal: string
  reason: string
  minutes: number
  /** 不传就按 axis 现算；两个来源（模型点的维度、本地兜底那一维）都能拼出同一个键 */
  taskKey?: string
  target_route?: string
  /** 这条特训练哪个难度，只影响给它配哪道题 */
  difficulty?: Difficulty
  /** 指定目标题；不传就按 维度 + 难度 自己配（模型不参与选题） */
  problemId?: string
}

export function createTask(input: TaskSpec): AgentTask {
  const taskKey = input.taskKey && input.taskKey.trim() ? input.taskKey.trim() : axisKeyOf(input.axis)
  return {
    id: newTaskId(),
    createdLabel: createdLabelOf(new Date()),
    axis: input.axis,
    taskKey,
    target_route:
      input.target_route && input.target_route.startsWith('/') ? input.target_route : DRILL_TARGET_ROUTE,
    problemId:
      input.problemId && input.problemId.trim()
        ? input.problemId.trim()
        : starterProblemOf(axisKeyOf(input.axis), input.difficulty ?? 'easy').id,
    goal: input.goal,
    reason: input.reason,
    minutes: input.minutes,
    status: 'pending',
    startedAt: null,
    elapsedMs: null,
    verdict: null,
    code: null,
    attemptId: null,
    attemptTitle: null,
    failCount: 0,
    lastFailCode: null,
    alreadyReported: false,
  }
}

/** 存一张新卡（同 id 覆盖，重复点卡片不会存出两条） */
export function saveTask(userId: string, task: AgentTask): void {
  const rest = readTasks(userId).filter((item) => item.id !== task.id)
  writeTasks(userId, [task, ...rest])
}

/** 账本里这一维有没有还没练完的卡；completed 的同款不算，练完可以再来一轮 */
export function findPendingTask(userId: string, taskKey: string): AgentTask | null {
  return readTasks(userId).find((task) => task.status === 'pending' && task.taskKey === taskKey) ?? null
}

export type TaskClaim = { task: AgentTask; reused: boolean }

/**
 * 生成任务的唯一入口：先遍历账本，同 taskKey 的 pending 卡已经存在就直接拦截，
 * 既不新建记录也不生成新 id，只把 activeTaskId 指回那张旧卡（reused=true，
 * 调用处照着 task.target_route 跳转就行）。
 * 查重放在这一层而不是页面里，是因为首页和报告页会各自想写一张卡，
 * 谁都拦不住谁；写入口只有一个，规则才真的全局。
 */
export function claimTask(userId: string, spec: TaskSpec): TaskClaim {
  const key = spec.taskKey && spec.taskKey.trim() ? spec.taskKey.trim() : axisKeyOf(spec.axis)
  const pending = findPendingTask(userId, key)
  if (pending) {
    startTask(userId, pending.id)
    return { task: pending, reused: true }
  }
  const task = createTask({ ...spec, taskKey: key })
  saveTask(userId, task)
  setActiveTaskId(userId, task.id)
  return { task, reused: false }
}

/**
 * 「▶ 去完成」的动作，也是所有跳转的共用前半段：把 activeTaskId 指到这张卡，
 * 同时把它钉好的 problemId 一起落盘，挑战页读 LocalStorage 就能定位到同一道题。
 * 一个字节都不碰 lib/aiAnalyst——不召唤分析师、不重新出卡，
 * 所以从账本进去永远生成不出第二条任务。跳转由调用处负责，起表仍是挑战页的 armActiveTask。
 */
export function startTask(userId: string, taskId: string): AgentTask | null {
  const tasks = readTasks(userId)
  const task = tasks.find((item) => item.id === taskId) ?? null
  if (!task) return null
  // 读到内存时才补上的 problemId（老卡）在这里落盘，之后挑战页不用再猜
  writeTasks(userId, tasks)
  setActiveTaskId(userId, task.id)
  return task
}

export function findTask(userId: string, id: string): AgentTask | null {
  return readTasks(userId).find((task) => task.id === id) ?? null
}

export function activeTaskId(userId: string): string | null {
  const raw = readJson<unknown>(`${ACTIVE_PREFIX}${userId}`)
  return typeof raw === 'string' && raw ? raw : null
}

/**
 * 正在追踪的那张卡（连题目一起给）。挑战页靠它读 problemId：
 * activeTaskId 只是指针，题目在卡上，所以跳转前不需要再另存一份键，
 * 也就不会出现「指针和题目各说一套」的对不上。
 */
export function activeTask(userId: string): AgentTask | null {
  const id = activeTaskId(userId)
  return id ? findTask(userId, id) : null
}

export function setActiveTaskId(userId: string, id: string): void {
  writeJson(`${ACTIVE_PREFIX}${userId}`, id)
}

export function clearActiveTaskId(userId: string): void {
  remove(`${ACTIVE_PREFIX}${userId}`)
}

/**
 * 起表：挑战页一进来（或换题）调这里。
 * 只给「挂着 activeTaskId + 还没计时过」的 pending 卡写 startedAt，
 * 所以重新进挑战页不会把已经跑过的耗时清零。
 */
export function armActiveTask(userId: string): AgentTask | null {
  const id = activeTaskId(userId)
  if (!id) return null
  const tasks = readTasks(userId)
  const index = tasks.findIndex((task) => task.id === id)
  if (index < 0) {
    clearActiveTaskId(userId)
    return null
  }
  const task = tasks[index]
  if (task.status === 'completed' || task.startedAt !== null) return task
  const next: AgentTask = { ...task, startedAt: Date.now() }
  tasks[index] = next
  writeTasks(userId, tasks)
  return next
}

/**
 * 收账：点「提交答案」的那一刻调这里。
 * 没在追踪、任务已封账、或账本里找不到，都只清掉 activeTaskId 并返回 null——
 * 调用处不需要为这几种情况写分支，埋点因此能只有一行。
 *
 * 两种结局分开处理，这是「失败可以重来」那套语义的地基：
 *   通过 → completed + alreadyReported，并清空 activeTaskId（这张卡到此封死）；
 *   没通过 → 状态留 pending，failCount +1、记下 lastFailCode 和这次的代码，
 *            activeTaskId 原样不动，学生改完再提交就是第二次尝试。
 * 两种情况都会写 elapsedMs / verdict / code / attemptId：attemptId 留着，
 * 下次从账本点进挑战页才能定位回同一道题。耗时按第一次起表的 startedAt 算，
 * 所以它是「这道特训总共花了多久」，包含所有重试，而不是最后一次那一段。
 */
export function reportActiveTask(userId: string, evidence: TaskEvidence): AgentTask | null {
  const id = activeTaskId(userId)
  if (!id) return null
  const tasks = readTasks(userId)
  const index = tasks.findIndex((task) => task.id === id)
  if (index < 0) {
    clearActiveTaskId(userId)
    return null
  }
  const task = tasks[index]
  if (task.alreadyReported || task.status === 'completed') {
    clearActiveTaskId(userId)
    return null
  }
  const startedAt = task.startedAt
  const written = {
    elapsedMs: startedAt === null ? null : Math.max(0, Date.now() - startedAt),
    verdict: evidence.verdict,
    code: evidence.code,
    attemptId: evidence.problemId,
    attemptTitle: evidence.problemTitle,
  }
  const next: AgentTask = evidence.passed
    ? { ...task, ...written, status: 'completed', lastFailCode: null, alreadyReported: true }
    : {
        ...task,
        ...written,
        status: 'pending',
        failCount: task.failCount + 1,
        lastFailCode: evidence.failCode ?? 'fail',
      }
  tasks[index] = next
  writeTasks(userId, tasks)
  if (evidence.passed) clearActiveTaskId(userId)
  return next
}

/** 耗时给人看时按秒和分说，AI 那边只给原始毫秒 */
export function formatElapsed(ms: number | null): string | null {
  if (ms === null) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}秒`
  return `${Math.floor(seconds / 60)}分${`${seconds % 60}`.padStart(2, '0')}秒`
}
