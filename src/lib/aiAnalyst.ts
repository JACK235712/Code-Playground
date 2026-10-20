/**
 * 赛博数据分析师智能体的真实接口层（智谱 glm-4-flash-250414 + 原生 function calling）。
 *
 * 和助教（aiMentor）、解说（aiCaster）共用的东西只有两样：同一条同源代理路径
 * AI_CHAT_PATH 和同一个模型名。密钥仍然只存在于 vite.config.ts 的代理里，
 * 浏览器代码从头到尾没读过它——需求写的 VITE_ZHIPU_API_KEY 已被代理兼容读取，
 * 但 VITE_ 前缀的变量会被 Vite 原样打进浏览器包，所以 .env 里首选 ZHIPU_API_KEY。
 *
 * 一次完整生命周期是两趟请求：
 *   1) 带 tools 的非流式请求（tool_choice:'required'），模型把「练哪一维、练什么、练多久」
 *      作为 assign_training_task 的参数交回来。
 *      只认 finish_reason === 'tool_calls' 或 message.tool_calls 非空，别的都当纯文本；
 *   2) 把 assistant 的 tool_calls 和 role:'tool' 的回执送回，再要一份
 *      「复盘 →【AI 思考过程】→ 总结」正文，交给界面做 30ms 打字机。
 *
 * 容错口径：这个函数**不往外抛**。没配密钥、限流、超时、参数缺失、返回空文本，
 * 全部退到 data/analyst.ts 的本地教练稿 + 兜底任务，并带一句 notice 说明降级原因。
 * 报告页因此永远有东西可渲染，不会出现白屏。
 */
import { AI_CHAT_PATH, AI_MODEL, maskModelIdentity } from './aiMentor'
import { axisKeyOf, axisLabelOf, DRILL_TARGET_ROUTE, drillOfAxis, localNarrative } from '../data/analyst'
import type { Drill } from '../data/analyst'
import type { SkillId } from '../data/player'
import { formatElapsed } from '../data/agentTasks'
import type { AgentTask } from '../data/agentTasks'
import {
  bestTimeOf,
  codeLinesOf,
  hasSkillData,
  radarOf,
  recordOf,
  streakOf,
  winRateOf,
} from '../data/stats'
import type { UserStats } from '../data/stats'

/** 需求原文，照抄不改 */
export const ANALYST_SYSTEM_PROMPT =
  '你是电竞级编程教练。请先基于历史记录（包括用户上次写的代码和判定结果）进行复盘；接着输出一段【AI 思考过程】；最后给出总结。'

export const ANALYST_TOOL_NAME = 'assign_training_task'

/** 工具的名字改了，需求里的判断口径就没意义了，所以导出给单测和界面共用 */
export const ANALYST_TOOLS = [
  {
    type: 'function',
    function: {
      name: ANALYST_TOOL_NAME,
      description: '教练决定布置一条可自动追踪的训练任务时调用；优先针对雷达图上最低的一维。',
      parameters: {
        type: 'object',
        properties: {
          axis: {
            type: 'string',
            description: '针对的雷达维度：逻辑思维 / 语法掌握 / 代码规范 / 算法效率 / 创造力',
          },
          goal: { type: 'string', description: '一句话说清这次要练成什么，不超过 30 字' },
          reason: { type: 'string', description: '为什么现在练这个，要引用具体分数或最近的判定结果' },
          minutes: { type: 'number', description: '预计用时（分钟），10 到 40 之间' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: '建议难度' },
        },
        required: ['axis', 'goal', 'reason'],
      },
    },
  },
] as const

/** 一次请求就 30 秒上限：分析师要出长文本，比解说的 6 秒宽，但也不能让学生干等 */
const TIMEOUT_MS = 30000
/** 带进上下文的追踪任务条数与每份代码的截断长度——token 也是钱，整页模板没必要灌进去 */
const MAX_TRACKED = 3
const MAX_CODE_CHARS = 900
const MAX_MATCHES = 8

/**
 * 一张任务卡要落进账本的全部字段。
 * taskKey / target_route 由代码补，不作为工具的参数——模型决定练什么，
 * 但「这一维叫什么键、跳去哪个路由」是全局查重的地基，不能交给它发挥。
 */
export type AnalystPlan = Drill & {
  taskKey: SkillId
  target_route: string
  fromTool: boolean
}

/** 任何一张卡都从 Drill 上补出这两个字段，保证不会出现「有维度没键」的卡 */
/** 任务卡上的两句话是模型写的，它会自称 AI：入库和上屏之前先换成「系统」 */
function planOf(drill: Drill, fromTool: boolean): AnalystPlan {
  return {
    ...drill,
    goal: maskModelIdentity(drill.goal),
    reason: maskModelIdentity(drill.reason),
    taskKey: axisKeyOf(drill.axis),
    target_route: DRILL_TARGET_ROUTE,
    fromTool,
  }
}

export type AnalystBrief = {
  nickname: string
  rankName: string
  level: number
  xp: number
  skills: { axis: string; score: number }[]
  scored: boolean
  avg: number
  strongest: { axis: string; score: number }
  weakest: { axis: string; score: number }
  wins: number
  losses: number
  total: number
  winRate: number
  streak: number
  cleared: number
  codeLines: number
  bestTime: string | null
  guild: string
  matches: UserStats['matches']
  tasks: AgentTask[]
  /** 学生从雷达图带过来的关注维度 */
  focus: string | null
}

function clip(text: string, max: number): string {
  const one = text.replace(/\s+$/g, '')
  return one.length <= max ? one : `${one.slice(0, max)}\n…（后面 ${one.length - max} 个字符已截断）`
}

/**
 * 把雷达、行为和账本压成一份画像。报告页和埋点都读同一份 userStats，
 * 所以这里只做整理，不做第二套口径。
 */
export function buildBrief(input: {
  nickname: string
  rankName: string
  level: number
  stats: UserStats
  tasks: AgentTask[]
  focus?: string | null
}): AnalystBrief {
  const { stats } = input
  const skills = radarOf(stats)
  const record = recordOf(stats)
  const total = skills.reduce((sum, item) => sum + item.score, 0)
  const strongest = skills.reduce((a, b) => (b.score > a.score ? b : a), skills[0])
  const weakest = skills.reduce((a, b) => (b.score < a.score ? b : a), skills[0])

  return {
    nickname: input.nickname,
    rankName: input.rankName,
    level: input.level,
    xp: stats.xp,
    skills,
    scored: hasSkillData(stats),
    avg: Math.round(total / (skills.length || 1)),
    strongest,
    weakest,
    ...record,
    winRate: winRateOf(stats),
    streak: streakOf(stats),
    cleared: stats.cleared,
    codeLines: codeLinesOf(stats),
    bestTime: bestTimeOf(stats),
    guild: stats.guild,
    matches: stats.matches.slice(0, MAX_MATCHES),
    tasks: input.tasks.slice(0, MAX_TRACKED),
    focus: input.focus ?? null,
  }
}

/** 打包成给模型读的那段文字：题目、判定、上次写的代码都要原样带上 */
export function briefToPrompt(brief: AnalystBrief): string {
  const lines: string[] = []

  lines.push(
    `【学员】${brief.nickname} · ${brief.guild}`,
    `【段位】${brief.rankName} Lv.${brief.level}（累计 ${brief.xp} XP）`,
    brief.scored
      ? `【能力雷达】${brief.skills.map((item) => `${item.axis} ${item.score}`).join(' / ')}；综合 ${brief.avg}`
      : '【能力雷达】五维全是 0：这条账号还没有任何一次被判分通过的提交',
    `【战绩】${brief.wins} 胜 ${brief.losses} 负，胜率 ${brief.winRate}%；通关 ${brief.cleared} 题；连续打卡 ${brief.streak} 天；累计手写 ${brief.codeLines} 行；最快通关 ${brief.bestTime ?? '暂无'}`,
  )

  if (brief.focus) lines.push(`【他刚从雷达图点开的关注维度】${brief.focus}`)

  if (brief.matches.length) {
    lines.push(
      `【最近判定】\n${brief.matches
        .map((m) => `- ${m.when} ${m.result === 'win' ? '胜' : '负'} vs ${m.opponent}（${m.mode}）：${m.detail}`)
        .join('\n')}`,
    )
  } else {
    lines.push('【最近判定】还没有对战记录')
  }

  if (brief.tasks.length) {
    lines.push(
      `【上一轮智能体追踪结果】\n${brief.tasks
        .map((task) => {
          const elapsed = formatElapsed(task.elapsedMs)
          const state =
            task.status === 'completed'
              ? '已完成'
              : task.failCount > 0
                ? `练过 ${task.failCount} 次还没通过`
                : '未开始'
          const head = `- 「${task.goal}」（${task.axis}）状态 ${state}`
          const body = [
            task.attemptTitle ? `作答题目：《${task.attemptTitle}》` : null,
            elapsed ? `耗时：${elapsed}` : null,
            task.verdict ? `判定结果：${task.verdict}` : null,
            task.lastFailCode ? `最后一次失败原因码：${task.lastFailCode}` : null,
            task.code ? `他当时写的代码：\n${clip(task.code, MAX_CODE_CHARS)}` : '他当时没提交代码',
          ]
            .filter(Boolean)
            .join('\n  ')
          return `${head}\n  ${body}`
        })
        .join('\n')}`,
    )
  } else {
    lines.push('【上一轮智能体追踪结果】账本为空，这是第一轮分析')
  }

  lines.push(
    `【要求】第一步必须先调用工具 ${ANALYST_TOOL_NAME}，把 axis/goal/reason/minutes 填全（练哪一维、练什么、为什么、练多久都由你自己定）；` +
      '工具调完之后，再按 system 的三段结构输出正文：先复盘历史记录，再写一段【AI 思考过程】，最后单独起一段「总结」。正文里不要再重复工具参数。',
  )

  return lines.join('\n\n')
}

type RawToolCall = {
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: RawToolCall[]
  tool_call_id?: string
}

type ChatChoice = {
  finish_reason?: string
  message?: { content?: string; tool_calls?: RawToolCall[] }
}

/** 同小游那条口径：页面上只说中枢，密钥、代理、上游细节进控制台 */
function analystError(status: number, raw: string): string {
  const blurb = raw.slice(0, 140).replace(/\s+/g, ' ')
  console.warn(`[分析师] 中枢请求失败 status=${status} ${blurb}`)
  if (status === 401 || status === 403) {
    return '分析师接不上智能中枢：本地代理没带上密钥，配好之后重启一次服务。'
  }
  if (status === 404) return '分析师接不上智能中枢：本地转发路径没生效。'
  if (status === 429) return '分析师被限流了，等十几秒再召唤一次。'
  if (status >= 500) return `智能中枢正在排队（${status}），过一会儿再试。`
  return `智能中枢这次没答上来（${status}）。`
}

async function postChat(body: Record<string, unknown>, signal?: AbortSignal): Promise<ChatChoice> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort('timeout'), TIMEOUT_MS)
  const relay = () => ctrl.abort('cancelled')
  signal?.addEventListener('abort', relay)

  try {
    const res = await fetch(AI_CHAT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(analystError(res.status, await res.text().catch(() => '')))
    const json = (await res.json()) as { choices?: ChatChoice[]; error?: { message?: string } }
    if (json.error) {
      console.warn(`[分析师] 中枢回了错误体：${json.error.message ?? '（无消息）'}`)
      throw new Error('智能中枢回了一个错误，这次改用本地战术库补全。')
    }
    const choice = json.choices?.[0]
    if (!choice) throw new Error('分析师拿到的是一个空响应。')
    return choice
  } catch (error) {
    if (ctrl.signal.aborted) {
      throw new Error(signal?.aborted ? '这次分析被取消了。' : '分析师 30 秒没答上来，再召唤一次试试。')
    }
    throw error instanceof Error ? error : new Error('分析师没能开口。')
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', relay)
  }
}

/**
 * 原生函数调用的判据：finish_reason === 'tool_calls' 或 message.tool_calls 非空，
 * 两个条件命中任何一个都算调用。只给了 finish_reason、参数体缺失时 call 为 null，
 * 由调用处用默认值补全——这属于「参数缺失」而不是「没调用」。
 */
export type ToolCallSignal = { called: boolean; call: RawToolCall | null; fromFinishReason: boolean }

export function detectToolCall(choice: ChatChoice): ToolCallSignal {
  const calls = choice.message?.tool_calls
  if (Array.isArray(calls) && calls.length > 0) return { called: true, call: calls[0], fromFinishReason: false }
  if (choice.finish_reason === 'tool_calls') return { called: true, call: null, fromFinishReason: true }
  return { called: false, call: null, fromFinishReason: false }
}

/** arguments 是字符串形式的 JSON，坏一个引号就整段解析失败——失败就全用默认值，绝不空着 */
export function planFromArgs(raw: string | undefined, fallback: Drill): AnalystPlan {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }
  const text = (value: unknown, max: number): string | null => {
    if (typeof value !== 'string') return null
    const one = value.replace(/\s+/g, ' ').trim()
    return one ? one.slice(0, max) : null
  }
  // 维度只认五个标准标签。模型写成「手感」这种不存在的维度时退回兜底那一维，
  // 而不是照抄它的字面——照抄会让任务卡和雷达图对不上号。
  const axis = axisLabelOf(text(parsed.axis, 12)) ?? drillOfAxis(fallback.axis).axis
  const goal = text(parsed.goal, 60) ?? fallback.goal
  const reason = text(parsed.reason, 160) ?? fallback.reason
  const minutes =
    typeof parsed.minutes === 'number' && Number.isFinite(parsed.minutes)
      ? Math.min(40, Math.max(5, Math.round(parsed.minutes)))
      : fallback.minutes
  const difficulty = parsed.difficulty
  const level =
    difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard' ? difficulty : fallback.difficulty

  return planOf({ axis, goal, reason, minutes, difficulty: level }, true)
}

const THINK_RE = /[【[]?\s*(?:AI\s*)?思考过程\s*[】]?\s*[:：]?\s*/
/** 「总结」这两个字太常出现在句子里，所以只认行首的那个，否则会把思考过程腰斩 */
const SUMMARY_RE = /(?:^|\n)[ \t]*[【[]?\s*(?:最终)?\s*(?:总结|结论)\s*[】]?\s*[:：]?\s*/

/**
 * 把正文切成复盘 / 思考 / 总结三段。模型经常不守标记（或者用 markdown 标题），
 * 所以每一段都允许缺席：切不出来就整段当思考过程，界面照样有字可打。
 */
export function splitSections(text: string): { recap: string; thinking: string; summary: string } {
  const clean = text
    .replace(/```[^\n]*/g, '')
    .replace(/^[ \t]*(?:#{1,6}|>)[ \t]*/gm, '')
    .replace(/\*\*|__|`/g, '')
    .trim()

  const thinkAt = clean.search(THINK_RE)
  const thinkMatch = thinkAt >= 0 ? THINK_RE.exec(clean) : null
  const thinkBody = thinkAt >= 0 && thinkMatch ? thinkAt + thinkMatch[0].length : -1

  if (thinkBody < 0) {
    return { recap: '', thinking: clean, summary: '' }
  }

  const recap = clean.slice(0, thinkAt).trim()
  const rest = clean.slice(thinkBody)
  const sumMatch = SUMMARY_RE.exec(rest)
  if (!sumMatch) {
    return { recap, thinking: rest.trim(), summary: '' }
  }
  const thinking = rest.slice(0, sumMatch.index).trim()
  const summary = rest.slice(sumMatch.index + sumMatch[0].length).trim()
  return { recap, thinking, summary }
}

/** 三段稿一落地就把模型的自报家门抹掉：复盘、逐字思考、总结里都不该再出现 AI 口径 */
function maskedSections(text: string) {
  const s = splitSections(text)
  return {
    recap: maskModelIdentity(s.recap),
    thinking: maskModelIdentity(s.thinking),
    summary: maskModelIdentity(s.summary),
  }
}

export type AnalystOutput = {
  plan: AnalystPlan
  recap: string
  thinking: string
  summary: string
  /** 正文是否真的来自模型（false = 本地兜底稿） */
  fromModel: boolean
  toolCalled: boolean
  /** 降级原因；一切正常时是 null */
  notice: string | null
  model: string
}

/**
 * 本地兜底：按雷达最低的一维出任务、出三段稿。
 * 单独抽出来是因为有三处要用它——两趟都没成、只成了第一趟、以及只成了工具调用。
 * planOverride 传进来时，本地稿要照着那张卡说话，否则文案和卡片会对不上。
 */
export function localOutput(
  brief: AnalystBrief,
  notice: string,
  extra: { toolCalled?: boolean; plan?: AnalystPlan } = {},
): AnalystOutput {
  const plan: AnalystPlan = extra.plan ?? planOf(drillOfAxis(brief.focus ?? brief.weakest.axis), false)
  const tracked = brief.tasks.find((task) => task.status === 'completed')
  const narrative = localNarrative({
    nickname: brief.nickname,
    rankName: brief.rankName,
    level: brief.level,
    avg: brief.avg,
    strongestAxis: brief.strongest.axis,
    strongestScore: brief.strongest.score,
    weakestAxis: plan.axis,
    weakestScore: brief.weakest.score,
    winRate: brief.winRate,
    wins: brief.wins,
    losses: brief.losses,
    streak: brief.streak,
    cleared: brief.cleared,
    codeLines: brief.codeLines,
    lastTracked:
      tracked && tracked.elapsedMs !== null
        ? {
            goal: tracked.goal,
            verdict: tracked.verdict ?? '没有判定结果',
            elapsed: formatElapsed(tracked.elapsedMs) ?? '未知',
          }
        : null,
  })
  return { plan, ...narrative, fromModel: false, toolCalled: extra.toolCalled ?? false, notice, model: AI_MODEL }
}

/** 跑一次完整分析；任何失败都被吃下来变成兜底稿，调用方只需要渲染 */
export async function requestAnalysis(
  brief: AnalystBrief,
  options: { signal?: AbortSignal } = {},
): Promise<AnalystOutput> {
  const prompt = briefToPrompt(brief)
  const fallback = drillOfAxis(brief.focus ?? brief.weakest.axis)

  let first: ChatChoice
  try {
    first = await postChat(
      {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: ANALYST_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        tools: ANALYST_TOOLS,
        /**
         * 实测：glm-4-flash-250414 在 tool_choice:'auto' 下几乎总是直接用散文回答，
         * 一个 tool_calls 都不给（探针见 .scratch-battle/toolprobe.mjs），原生调用等于没接上；
         * 换 'required' 后稳定回 finish_reason === 'tool_calls'。
         * 注意「调用与否、参数填什么」仍是模型自己决定，这里只是不许它跳过工具那一步。
         */
        tool_choice: 'required',
        stream: false,
        temperature: 0.6,
        max_tokens: 320,
      },
      options.signal,
    )
  } catch (error) {
    return localOutput(brief, `${error instanceof Error ? error.message : '分析失败'}（已改用本地教练的排课）`)
  }

  const tool = detectToolCall(first)
  const plan = tool.call?.function ? planFromArgs(tool.call.function.arguments, fallback) : planOf(fallback, false)

  // 模型这一趟只给了正文、没调工具：只算「未调用工具」，文本照用，任务卡用本地补的
  if (!tool.called) {
    const sections = maskedSections(first.message?.content ?? '')
    if (!sections.thinking) return localOutput(brief, '中枢这轮没有下单，任务卡按本地战术库补全。')
    return {
      plan,
      ...sections,
      summary: sections.summary || `这轮就练「${plan.axis}」：${plan.goal}`,
      fromModel: true,
      toolCalled: false,
      notice: '中枢直接给了结论、没有下单，任务参数由本地战术库补全。',
      model: AI_MODEL,
    }
  }

  // 第二趟：把 assistant 的工具调用和 role:'tool' 的回执按原样送回去，再要三段正文。
  // finish_reason 说了调用但没带 tool_calls 时，回执没法构造，只补一句文字回执。
  const messages: ChatMessage[] = [
    { role: 'system', content: ANALYST_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]
  const receipt = `任务已登记：${JSON.stringify({ axis: plan.axis, goal: plan.goal, minutes: plan.minutes })}。`
  if (first.message?.tool_calls?.length) {
    messages.push(
      { role: 'assistant', content: first.message.content ?? '', tool_calls: first.message.tool_calls },
      { role: 'tool', tool_call_id: tool.call?.id ?? ANALYST_TOOL_NAME, content: JSON.stringify({ accepted: true, ...plan }) },
    )
  } else {
    messages.push({ role: 'assistant', content: first.message?.content ?? '' })
  }
  messages.push({
    role: 'user',
    content: `${receipt}现在只输出三段正文：先复盘历史记录，再写一段【AI 思考过程】，最后单独起一段「总结」。不要重复工具参数。`,
  })

  let second: ChatChoice
  try {
    second = await postChat(
      { model: AI_MODEL, messages, stream: false, temperature: 0.8, max_tokens: 900 },
      options.signal,
    )
  } catch (error) {
    return localOutput(brief, `${error instanceof Error ? error.message : '正文没生成'}（任务卡是中枢点的，保留）`, {
      toolCalled: true,
      plan,
    })
  }

  const sections = maskedSections(second.message?.content ?? '')
  if (!sections.thinking) {
    return localOutput(brief, '中枢回了空正文，这一遍用本地稿。', { toolCalled: true, plan })
  }

  return {
    plan,
    ...sections,
    summary: sections.summary || `这轮就练「${plan.axis}」：${plan.goal}`,
    fromModel: true,
    toolCalled: true,
    notice: null,
    model: AI_MODEL,
  }
}
