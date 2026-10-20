/**
 * AI 数据分析师的文案目录：按钮叫什么、管线有哪几步、模型没连上时本地教练说什么。
 * 和 butler.ts / arenaHost.ts 一样，这里只有确定性的台词，不碰接口——
 * 真正的模型调用在 lib/aiAnalyst.ts。
 */
import { bankOf } from './problems'
import type { Difficulty, Problem } from './problems'
import { SKILL_AXES } from './player'
import type { SkillId } from './player'

/** 需求指定的按钮文案，连放大镜表情一起照抄 */
export const ANALYST_CALL_LABEL = '🔍 生成专属训练报告'
export const ANALYST_TITLE = '专属战术复盘 · 训练报告'

export type PipelineStep = { id: 'pack' | 'tool' | 'narrate' | 'issue'; label: string; detail: string }

/** 报告页顶部那条管线：状态由页面的 phase 推导，不在这里存任何东西 */
export const ANALYST_STEPS: PipelineStep[] = [
  { id: 'pack', label: '读取雷达与行为数据', detail: '五维分数 · 战绩 · 连续打卡 · 历史任务' },
  { id: 'tool', label: '智能中枢自动布置任务', detail: '由中枢自己决定这条特训落在哪个维度' },
  { id: 'narrate', label: '系统分析逻辑', detail: '逐字输出，每字 30 毫秒' },
  { id: 'issue', label: '生成可追踪任务卡', detail: '点卡片才挂进挑战页' },
]

export type Drill = {
  axis: string
  goal: string
  reason: string
  minutes: number
  difficulty: 'easy' | 'medium' | 'hard'
}

/**
 * 训练任务永远落在挑战页。路由由代码定，不让模型填：
 * 它填什么维度、什么目标是本事，但它要是能指定路由，就等于能从报告页跳去任何地方。
 */
export const DRILL_TARGET_ROUTE = '/challenge'

/**
 * 模型没调用工具（或参数缺失、请求整个失败）时的补全表。
 * 每个维度都得有一条，否则兜底路径自己也要判空，那就本末倒置了。
 */
export const FALLBACK_DRILLS: Record<SkillId, Drill> = {
  logic: {
    axis: '逻辑思维',
    goal: '一道带嵌套条件的题，先在纸上写清分支再动手',
    reason: '雷达上「逻辑思维」是你最低的一维，先补分支再补循环',
    minutes: 15,
    difficulty: 'easy',
  },
  syntax: {
    axis: '语法掌握',
    goal: '同一道题换一门语言重写，盯分号、括号和大括号',
    reason: '「语法掌握」偏低，多半是报错来自标点而不是思路',
    minutes: 20,
    difficulty: 'easy',
  },
  style: {
    axis: '代码规范',
    goal: '把最近通关的那段重排成 4 空格缩进、变量名说人话',
    reason: '「代码规范」还差点，写得出来也要让人读得懂',
    minutes: 12,
    difficulty: 'easy',
  },
  algo: {
    axis: '算法效率',
    goal: '一道循环题写两遍：双层暴力版和只扫一遍版，比用时',
    reason: '「算法效率」是你的短板，先感受 O(n²) 和 O(n) 的差距',
    minutes: 25,
    difficulty: 'medium',
  },
  creative: {
    axis: '创造力',
    goal: '通关后加一个题面没要求的小输出，比如提示或计数',
    reason: '「创造力」还有空间，跑通只是起点而不是终点',
    minutes: 18,
    difficulty: 'medium',
  },
}

/**
 * 模型写的维度可能是「算法」「算法效率偏低」这种碎片，先模糊匹配成五个标准标签之一；
 * 认不出来返回 null，由调用处决定退到哪一维（不要在这里替它挑一维）。
 */
export function axisLabelOf(value: string | null | undefined): string | null {
  const wanted = (value ?? '').trim()
  if (!wanted) return null
  const hit = SKILL_AXES.find((item) => wanted.includes(item.axis) || item.axis.includes(wanted))
  return hit ? hit.axis : null
}

/**
 * 维度 → 全局稳定标识（logic / syntax / style / algo / creative）。
 * 雷达、任务卡、账本查重共用这一个键，所以「算法效率」和模型随口写的「算法」
 * 会落到同一个 taskKey 上——查重才有意义。认不出来的维度退回 logic，
 * 宁可保守也不让一张卡没有身份。
 */
export function axisKeyOf(value: string | null | undefined): SkillId {
  const label = axisLabelOf(value)
  const hit = SKILL_AXES.find((item) => item.axis === (label ?? ''))
  return hit ? hit.id : 'logic'
}

/**
 * 按标签取兜底练习；匹配不上退回「逻辑思维」——任务卡宁可保守也不能空着。
 */
export function drillOfAxis(axis: string | null | undefined): Drill {
  return FALLBACK_DRILLS[axisKeyOf(axis)]
}

/**
 * 每个维度偏爱什么类型的题。只用来给任务卡钉一道「特训指定题」，
 * 不参与判题，也不是题面数据，所以改它不会影响题库。
 */
const AXIS_TAG_HINT: Record<SkillId, string[]> = {
  logic: ['条件', '嵌套循环'],
  syntax: ['变量', '输出'],
  style: ['数组', '函数'],
  algo: ['累加', '累乘', '排序', '搜索'],
  creative: ['图形', '循环'],
}

/**
 * 任务卡自带的那道题：按这条特训的难度在同难度题池里挑，优先命中这一维的关键词标签，
 * 挑不到就退到同难度里星级最低的一道。规则写在数据层而不是让模型填题号——
 * 模型能指定题号，等于能从报告页把我直接送去任何一题。
 */
export function starterProblemOf(key: SkillId, difficulty: Difficulty): Problem {
  const bank = bankOf(difficulty)
  const hints = AXIS_TAG_HINT[key]
  return bank.find((problem) => problem.tags.some((tag) => hints.includes(tag))) ?? bank[0]
}

export type NarrativeInput = {
  nickname: string
  rankName: string
  level: number
  avg: number
  strongestAxis: string
  strongestScore: number
  weakestAxis: string
  weakestScore: number
  winRate: number
  wins: number
  losses: number
  streak: number
  cleared: number
  codeLines: number
  /** 上一次追踪任务的执行结果，本地复盘要照着它说话，不能编造 */
  lastTracked: { goal: string; verdict: string; elapsed: string } | null
}

/**
 * 完全离线时本地教练的那份稿子：三段结构和模型被要求的一模一样
 * （复盘 → 【AI 思考过程】 → 总结），所以界面无需为兜底写第二套渲染。
 */
export function localNarrative(input: NarrativeInput): { recap: string; thinking: string; summary: string } {
  const recap = [
    `${input.nickname}，${input.rankName} Lv.${input.level}，手上一共 ${input.wins} 胜 ${input.losses} 负（胜率 ${input.winRate}%），通关 ${input.cleared} 题、累计手写 ${input.codeLines} 行。`,
    input.lastTracked
      ? `上一次我盯着你那条「${input.lastTracked.goal}」：用时 ${input.lastTracked.elapsed}，判定结果是「${input.lastTracked.verdict}」。`
      : '目前账本里还没有追踪记录，这次是第一轮。',
    `连续打卡 ${input.streak} 天，这条比分数更能说明你来没来。`,
  ].join('\n')

  const thinking = [
    `第一眼看的是形状不是分数：${input.strongestAxis} ${input.strongestScore} 分是你能撑住的那一边，${input.weakestAxis} ${input.weakestScore} 分是缺口。`,
    `综合 ${input.avg} 分说明你写得出、跑得通，卡在把思路讲清楚这一步——所以不该再刷新的知识点，该补最弱那一维。`,
    `任务按 15–25 分钟一道来排：短于 15 分钟练不出手感，长于 25 分钟你今天就不会点开它。`,
    `这条任务我会挂在挑战页上自动计时并抓走你提交的那份代码，下次分析先读它，不用你复述。`,
  ].join('\n')

  const summary = `这轮就练「${input.weakestAxis}」：${drillOfAxis(input.weakestAxis).goal}。跑完点提交，剩下的交给追踪，我不需要你手写日志。`

  return { recap, thinking, summary }
}
