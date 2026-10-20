/**
 * 挑战页的经济结算。一次「判定通过」到底该发多少钱，全在下面这个纯函数里定，
 * LocalStorage 只负责把名单读进来、写回去——这样单测不必伪造 window 也能把闸门测穿。
 *
 * 两道闸门彼此独立，谁也不许拿对方的结论当条件：
 *   ① solved 名单（防刷）：题面奖励只在这道题第一次通关时发，重刷一个子儿都没有；
 *   ② alreadyReported（任务封账）：智能体派下的特训任务只在首次完成时补发一份，
 *      它的结论来自 reportActiveTask 的返回值——那张卡早就封过账时它返回 null。
 * 账本状态的写入发生在 reportActiveTask 里，成败都记、与发钱无关，所以重刷那张卡
 * 该转 completed 照样转，只是领不到第二份任务奖励。
 *
 * 除了金币和经验，首通还顺带记三笔「只有第一次才算」的成长：累计手写行数、通关题数、
 * 以及这道题所属那一维的雷达分（+2~+5，满分 100）。重刷一个都不加，
 * 免得把「累计」两个字刷成水分。全部落在 userStats 上，【我的】页那几个面板都从它派生。
 */
import { readJson, writeJson } from '../lib/storage'
import type { AgentTask } from './agentTasks'
import { findProblem } from './problems'
import type { Problem } from './problems'
import { SKILL_AXES } from './player'
import type { SkillId } from './player'
import { getRankInfo, levelOf } from './ranks'
import type { UserStats } from './stats'

/** 已通关题号名单：一个账号一份，和抽题记录、任务账本各自独立 */
const SOLVED_PREFIX = 'cp.solved.v1.'

/** 名单可能被老版本或手改的存档写坏，读到不是数组就当空的 */
export function readSolvedIds(userId: string): string[] {
  const raw = readJson<unknown>(`${SOLVED_PREFIX}${userId}`)
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

export function saveSolvedIds(userId: string, ids: string[]): boolean {
  return writeJson(`${SOLVED_PREFIX}${userId}`, ids)
}

export type Reward = { coins: number; xp: number }

/**
 * 这道题算哪一维——雷达图靠它决定该给哪根轴涨分。
 * 顺序是「越专门的信号越先」：算法类标签压过分支，分支压过规范，最后才是语法这类通用写法；
 * tags 一个都没命中就退回章节名（第六章算法深巷、第四章图形工坊……），
 * 保证任何一道题——包括以后新加的——都必定落进五维之一，不会出现「打了题雷达不动」。
 */
const AXIS_BY_TAG: [SkillId, string[]][] = [
  ['creative', ['图形', '图案', '创意', '艺术', '装饰']],
  [
    'algo',
    [
      '动态规划', 'DP', '递推', '递归', '回溯', '双指针', '滑动窗口', '一次遍历', '前缀和',
      '区间查询', '二分', '排序', '搜索', '哈希', '栈', '队列', '嵌套循环', '质数', '进位',
      '大数', '算术', '平方根', '累乘', '累加',
    ],
  ],
  ['logic', ['条件', '分支', '判断', '比较', '逻辑', '取余', '模拟']],
  ['style', ['格式化', '字符串', '函数', '缩进', '复用', '规范', '注释']],
  ['syntax', ['输出', '变量', '循环', '数组', '赋值', '索引', '长度', '截取', '拼接', '计数', '统计', '浮点', '除法']],
]

const AXIS_BY_CHAPTER: [string, SkillId][] = [
  ['算法深巷', 'algo'],
  ['图形工坊', 'creative'],
  ['数据集市', 'style'],
  ['循环竞技场', 'logic'],
  ['变量之城', 'syntax'],
  ['语法丛林', 'syntax'],
]

export function skillAxisOf(problem: Problem): SkillId {
  for (const [id, words] of AXIS_BY_TAG) {
    if (problem.tags.some((tag) => words.some((word) => tag.includes(word)))) return id
  }
  for (const [word, id] of AXIS_BY_CHAPTER) {
    if (problem.chapter.includes(word)) return id
  }
  return 'syntax'
}

export type SkillGain = {
  id: SkillId
  /** 中文维度名，直接拿来写控制台 */
  axis: string
  before: number
  after: number
  /** 这次真正加上去的分数（顶到 100 时可能小于摇出来的值） */
  gain: number
}

export type ClearInput = {
  /** 结算前已通关的题号 */
  solved: string[]
  /** 结算前的全局数据，只看 xp 这一个成长数字 */
  stats: UserStats
  problemId: string
  /** 没在追踪 / 早已封账时为 null */
  settledTask: AgentTask | null
  /** 提交那一刻编辑器里的源码，累计行数按它算 */
  source: string
  /** 注入随机数好让雷达那一笔能被单测钉死；默认 Math.random */
  roll?: () => number
}

export type ClearResult = {
  /** false = 防刷拦下，题面奖励一份都不发 */
  firstSolve: boolean
  taskPaid: boolean
  /** 题面那一份（防刷拦下就是 0） */
  problem: Reward
  /** 任务那一份（不是首次封账就是 0） */
  task: Reward
  /** 这次实际要加到 userStats 上的总数 */
  coins: number
  xp: number
  /** 这次提交带来的累计行数（只有首通才算，重刷不重复记账） */
  lines: number
  /** 通关数增量：首通 1，重刷 0 */
  cleared: number
  /** 雷达图涨的那一维；重刷或题号找不到时为 null */
  skill: SkillGain | null
  /** 结算后的名单；调用处只在 firstSolve 时才写回 */
  solved: string[]
  level: { before: number; after: number }
  rank: { before: string; after: string }
}

const NOTHING: Reward = { coins: 0, xp: 0 }

/** 空行不算「手写」，剩下的按 \n 切出来几行就是几行 */
function countCodeLines(source: string) {
  return source.split('\n').filter((line) => line.trim() !== '').length
}

/** 摇 +2 到 +5，顶到满分 100 就停，所以雷达图不会被同一道题刷穿 */
function rollSkill(stats: UserStats, problem: Problem, roll: () => number): SkillGain {
  const id = skillAxisOf(problem)
  const before = stats.skills[id] ?? 0
  const after = Math.min(100, before + 2 + Math.floor(roll() * 4))
  return {
    id,
    axis: SKILL_AXES.find((a) => a.id === id)?.axis ?? id,
    before,
    after,
    gain: after - before,
  }
}

export function applyClear({
  solved,
  stats,
  problemId,
  settledTask,
  source,
  roll = Math.random,
}: ClearInput): ClearResult {
  const firstSolve = !solved.includes(problemId)
  const taskPaid = settledTask !== null && settledTask.status === 'completed'

  const problem = firstSolve ? findProblem(problemId) : null
  /** 任务卡没有自己的奖励字段，就按它钉的那道题算（答过之后以 attemptId 为准） */
  const taskProblem = taskPaid ? findProblem(settledTask?.attemptId ?? settledTask?.problemId ?? '') : null

  const fromProblem: Reward = problem
    ? { coins: problem.rewardCoins, xp: problem.rewardXp }
    : NOTHING
  const fromTask: Reward = taskProblem ? { coins: taskProblem.rewardCoins, xp: taskProblem.rewardXp } : NOTHING

  const xp = fromProblem.xp + fromTask.xp
  const before = stats.xp
  const after = Math.max(0, before + xp)

  return {
    firstSolve,
    taskPaid,
    problem: fromProblem,
    task: fromTask,
    coins: fromProblem.coins + fromTask.coins,
    xp,
    lines: firstSolve ? countCodeLines(source) : 0,
    cleared: firstSolve ? 1 : 0,
    skill: problem ? rollSkill(stats, problem, roll) : null,
    solved: firstSolve ? [...solved, problemId] : solved,
    level: { before: levelOf(before), after: levelOf(after) },
    rank: { before: getRankInfo(before).name, after: getRankInfo(after).name },
  }
}

/**
 * 界面用的那层薄壳：读名单 → 纯函数结算 → 首通才把题号写回。
 * 发钱不在这里做，调用处拿到结果自己去 patchStats，免得存储层插手全局状态。
 */
export function settleClearReward(
  userId: string,
  stats: UserStats,
  problemId: string,
  settledTask: AgentTask | null,
  source: string,
  roll?: () => number,
): ClearResult {
  const result = applyClear({ solved: readSolvedIds(userId), stats, problemId, settledTask, source, roll })
  if (result.firstSolve) saveSolvedIds(userId, result.solved)
  return result
}

/** 控制台那几句话：两道闸门各自结了几笔摊开说，别只报一个总数 */
export function describeClear(problemTitle: string, result: ClearResult): string[] {
  const lines: string[] = []
  if (result.firstSolve) {
    lines.push(
      `《${problemTitle}》首次通关：题面奖励 +${result.problem.coins} 金币 / +${result.problem.xp} XP` +
        ` · 累计 ${result.lines} 行 · 通关数 +${result.cleared}`,
    )
  } else {
    lines.push(`《${problemTitle}》该题已通关，无额外奖励`)
  }
  if (result.skill) {
    lines.push(`雷达图「${result.skill.axis}」+${result.skill.gain}：${result.skill.before} → ${result.skill.after}`)
  }
  if (result.taskPaid) {
    lines.push(`任务卡首次封账：按这道题再补一份 +${result.task.coins} 金币 / +${result.task.xp} XP`)
  }
  if (result.rank.before !== result.rank.after) {
    lines.push(
      `段位刷新：${result.rank.before} Lv.${result.level.before} → ${result.rank.after} Lv.${result.level.after}`,
    )
  } else if (result.level.after !== result.level.before) {
    lines.push(`等级提升：Lv.${result.level.before} → Lv.${result.level.after}`)
  }
  return lines
}
