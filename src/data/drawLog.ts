import { readJson, remove, writeJson } from '../lib/storage'
import {
  DIFFICULTY_ORDER,
  DIFFICULTY_PLAN,
  backupBank,
  bankOf,
  compareByDifficulty,
  drawBank,
  findProblem,
  mediumBank,
} from './problems'
import type { Difficulty, Problem } from './problems'

/**
 * 题池抽取记录按账号隔离：换一个登录身份，刷过的题要重新算，
 * 不然新同学进来会看到「题库已被你刷完」。
 */
const key = (userId: string) => `cp.drawbatch.v1.${userId}`

type Used = Record<Difficulty, string[]>
/** 抽题记录：used 记本账号每个难度抽过谁，last 记上一批那 5 道（规则 B 靠它） */
export type DrawLog = { used: Used; last: string[] }

export type Batch = {
  problems: Problem[]
  /** 每个难度还剩多少道没抽过，用于题池底部的「还剩 N 道」（备用题不计入） */
  left: Record<Difficulty, number>
  /** 本次因为备选池被排空而自动重置了排除记录的难度，UI 据此提示 */
  resetTiers: Difficulty[]
  /** 这一批里被拉来顶班的备用题 id；正常池没排空时是空数组 */
  backupIds: string[]
}

/** 抽题规则 C：一批 2 道中等里，至少几道必须来自「高难度中等」子池 */
const ADVANCED_MEDIUM_MIN = 1

function blank(): DrawLog {
  return { used: { easy: [], medium: [], hard: [] }, last: [] }
}

/** LocalStorage 里可能是旧版本或坏数据，逐档丢掉不认识的题目 id */
function normalize(raw: Partial<DrawLog> | null): DrawLog | null {
  if (!raw?.used) return null
  const log = blank()
  for (const tier of DIFFICULTY_ORDER) {
    const ids = raw.used[tier]
    if (!Array.isArray(ids)) continue
    // 备用题也要认，所以按「该难度全部题目」校验，而不是只认正常池
    const bank = new Set(bankOf(tier).map((p) => p.id))
    log.used[tier] = ids.filter((id): id is string => typeof id === 'string' && bank.has(id))
  }
  log.last = Array.isArray(raw.last) ? raw.last.filter((id) => !!findProblem(id)) : []
  return log
}

function readLog(userId: string): DrawLog {
  return normalize(readJson<Partial<DrawLog>>(key(userId))) ?? blank()
}

function countLeft(log: DrawLog): Record<Difficulty, number> {
  const left = { easy: 0, medium: 0, hard: 0 } as Record<Difficulty, number>
  for (const tier of DIFFICULTY_ORDER) {
    const ids = new Set(log.used[tier])
    left[tier] = Math.max(0, drawBank(tier).length - ids.size)
  }
  return left
}

/** 这道题是不是「高难度中等」（规则 C 数的是它） */
function isAdvancedMedium(problem: Problem): boolean {
  return problem.difficulty === 'medium' && problem.advanced === true
}

/**
 * 当前该被排除掉的题目 id：
 * · 本账号该难度抽过的（比需求的「只排除上一批」更狠，保证长时间不重样）；
 * · 上一批那 5 道（规则 B）；
 * · 本次已经抽进批次里的（规则 A，同一批绝不可能出现两个相同 id）。
 */
function excluded(next: DrawLog, last: Set<string>, chosen: Problem[]): Set<string> {
  const set = new Set<string>(last)
  for (const problem of chosen) set.add(problem.id)
  for (const tier of DIFFICULTY_ORDER) for (const id of next.used[tier]) set.add(id)
  return set
}

/** 从按优先级排好的几个子池里取一道「没被排除」的题，各池都榨干了就返回 null */
function pick(banks: Problem[][], skip: Set<string>, random: boolean): Problem | null {
  for (const bank of banks) {
    const fresh = bank.filter((problem) => !skip.has(problem.id))
    if (fresh.length === 0) continue
    // 干净账号的第一批按星级固定取，StrictMode 把初始化跑两遍才会拿到同一批题
    return random ? fresh[Math.floor(Math.random() * fresh.length)] : fresh[0]
  }
  return null
}

/** 钉题（首页 / 任务账本带过来的那道）一定要在列表里点得到 */
function withPinned(picked: Problem[], pinnedId?: string): Problem[] {
  const pinned = findProblem(pinnedId)
  if (!pinned || picked.includes(pinned)) return picked.sort(compareByDifficulty)
  const sameTier = picked
    .map((problem, index) => ({ problem, index }))
    .filter(({ problem }) => problem.difficulty === pinned.difficulty)
  // 挤掉同难度的哪一道有讲究：换完至少要留下一道高难度中等（规则 C）
  const keepsMix = (index: number) =>
    picked.filter((_, i) => i !== index).filter(isAdvancedMedium).length +
      (isAdvancedMedium(pinned) ? 1 : 0) >
    0
  const target = sameTier.find(({ index }) => keepsMix(index)) ?? sameTier[0]
  if (target) picked[target.index] = pinned
  else picked.push(pinned)
  return picked.sort(compareByDifficulty)
}

export type DrawOptions = {
  /** 强制入选的题目 id */
  pinnedId?: string
  /** true = 用户点「换一批」，真的要抽新题；false 只是恢复上一批 */
  reshuffle?: boolean
}

export type DrawResult = {
  problems: Problem[]
  /** 抽完之后该写回存储的新记录 */
  next: DrawLog
  resetTiers: Difficulty[]
  backupIds: string[]
}

/**
 * 纯粹的抽题规则，不碰存储，方便单测直接喂一个伪造的记录进来验规则 A/B/C/D。
 *
 * · 规则 A：同批 5 道 id 互不相同（排除集合里就带着本批已选的）；
 * · 规则 B：先排除本账号抽过的 + 上一批那几道，某个难度的备选池因此被排空时，
 *   允许把「这一档的排除记录」重置再抽（重置后仍然避开上一批和本批已选）；
 * · 规则 C：2 道中等里至少 1 道来自 advanced 子池；
 * · 规则 D：返回前按 简单 → 中等 → 困难 排序。
 * 兜底顺序是 正常池 → 重置后的正常池 → 该难度的备用题，备用题永远排最后。
 */
export function drawProblems(log: DrawLog, opts: { pinnedId?: string; random: boolean }): DrawResult {
  const next: DrawLog = {
    used: {
      easy: [...log.used.easy],
      medium: [...log.used.medium],
      hard: [...log.used.hard],
    },
    last: [],
  }
  const last = new Set(log.last)
  const chosen: Problem[] = []
  const resetTiers: Difficulty[] = []
  const backupIds: string[] = []

  const commit = (problem: Problem, tier: Difficulty): Problem => {
    chosen.push(problem)
    next.used[tier].push(problem.id)
    return problem
  }

  /** 按当前排除记录取一道，取不到返回 null */
  const takeOnce = (banks: Problem[][]): Problem | null =>
    pick(banks, excluded(next, last, chosen), opts.random)

  /**
   * 规则 B 允许的「重置排除记录」。
   * announce = true 才对外报告这一档被重置过（题池底部那条提示），
   * 只是高难度子池局部重开时不惊动玩家，因为题池明明还没刷完。
   */
  const resetExclusions = (tier: Difficulty, bank: Problem[], announce: boolean) => {
    const ids = new Set(bank.map((problem) => problem.id))
    next.used[tier] = next.used[tier].filter((id) => !ids.has(id))
    if (announce && !resetTiers.includes(tier)) resetTiers.push(tier)
  }

  /**
   * 抽一格。banks 按优先级排：
   * · must = true（规则 C 的那道高难度中等）先只认第一个子池，它被排除记录榨干就
   *   只重置这个子池再来一次，真的一道都没有才允许降级到普通中等；
   * · 其余格子按 banks 顺序找，全被排除就把这一档整体重置后重试，
   *   重置之后还是凑不出来，最后才轮到该难度的备用题（规则 B 的兜底）。
   */
  const take = (banks: Problem[][], tier: Difficulty, must: boolean): Problem | null => {
    if (must && banks[0].length > 0) {
      let only = takeOnce([banks[0]])
      if (!only) {
        resetExclusions(tier, banks[0], false)
        only = takeOnce([banks[0]])
      }
      if (only) return commit(only, tier)
    }
    let got = takeOnce(banks)
    if (!got) {
      resetExclusions(tier, banks.flat(), true)
      got = takeOnce(banks)
    }
    if (!got) {
      got = takeOnce([backupBank(tier)])
      if (got) backupIds.push(got.id)
    }
    return got ? commit(got, tier) : null
  }

  for (let i = 0; i < DIFFICULTY_PLAN.easy; i += 1) take([drawBank('easy')], 'easy', false)

  // 规则 C：先给高难度中等留一个位（must），再补一道普通中等；哪个子池真空了就互相补位
  for (let i = 0; i < ADVANCED_MEDIUM_MIN; i += 1) {
    take([mediumBank(true), mediumBank(false)], 'medium', true)
  }
  for (let i = ADVANCED_MEDIUM_MIN; i < DIFFICULTY_PLAN.medium; i += 1) {
    take([mediumBank(false), mediumBank(true)], 'medium', false)
  }

  for (let i = 0; i < DIFFICULTY_PLAN.hard; i += 1) take([drawBank('hard')], 'hard', false)

  const problems = withPinned(chosen, opts.pinnedId)
  // 规则 B 靠这一行：把本批 id 记成「上一批」，下一次抽取先把它排除掉
  next.last = problems.map((problem) => problem.id)
  return { problems, next, resetTiers, backupIds }
}

/** 这道题是不是只能靠备用题兜底才出场的 */
function isBackupId(id?: string | null): boolean {
  const problem = findProblem(id)
  return Boolean(problem?.backup)
}

/**
 * 今日题池的一批题。恢复上一批走存储里的 last，点「换一批」才真的重抽；
 * 抽题本身交给 drawProblems，这里只管读写记录。
 */
export function drawBatch(userId: string, opts: DrawOptions = {}): Batch {
  const log = readLog(userId)
  if (log.last.length > 0 && !opts.reshuffle) {
    return {
      problems: withPinned(log.last.map((id) => findProblem(id)!), opts.pinnedId),
      left: countLeft(log),
      resetTiers: [],
      backupIds: log.last.filter(isBackupId),
    }
  }

  const drawn = drawProblems(log, {
    pinnedId: opts.pinnedId,
    // 第一批按星级固定取，之后（有历史或明确换一批）才随机
    random: log.last.length > 0 || Boolean(opts.reshuffle),
  })
  writeJson(key(userId), drawn.next)
  return {
    problems: drawn.problems,
    left: countLeft(drawn.next),
    resetTiers: drawn.resetTiers,
    backupIds: drawn.backupIds,
  }
}

/** 手动清空抽取记录：把三个难度的「已抽过」和上一批一起归零，重新从最简单的开始 */
export function clearDrawLog(userId: string) {
  remove(key(userId))
}
