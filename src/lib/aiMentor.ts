/**
 * 小游 · AI 助教的真实接口（智谱 ChatGLM）。
 *
 * 三样东西按需求写死，不接受任何「顺手优化」：
 *   模型 glm-4-flash-250414（不带 -x / -plus / -air，也不简写）
 *   接口 /api/zhipu/chat/completions → dev 代理转发到 https://open.bigmodel.cn/api/paas/v4/chat/completions
 *   system prompt 原文照抄，只给引导不给代码
 *
 * 密钥不在这里：浏览器只发同源请求，Authorization 头由 vite.config.ts 的代理注入。
 * 流式返回按 SSE 一帧一帧解析，读到一段就往外抛一段，界面因此能打出打字机效果。
 */
import { DIFFICULTY_LABEL } from '../data/problems'
import type { Problem } from '../data/problems'
import { LANGUAGES } from '../data/languages'
import type { LangId } from '../data/languages'

/** 界面上给这套推理能力起的名字：真实的模型号只留在请求体里，不给学生看 */
export const AI_CORE_LABEL = 'Cyber-Neural-Core v3.0 · 实时驱动'

export const AI_MODEL = 'glm-4-flash-250414'
export const AI_SYSTEM_PROMPT =
  '你是一个幽默的编程导师。绝对不要直接给出完整代码，用提问引导用户思考，每次回答必须包含一句鼓励。'

/** 助教和竞技场解说共用这一条同源路径：真实域名与密钥只存在于 vite.config.ts 的代理里 */
export const AI_CHAT_PATH = '/api/zhipu/chat/completions'

/**
 * 模型爱自报家门，界面不跟着报：把正文里的「AI / 人工智能 / 大模型 / GLM」一律换成「系统」。
 * 前后都卡了非字母边界，所以 OpenAI、main 这类词不会被误伤；替换后再吃掉中文前面那个空格。
 */
export function maskModelIdentity(text: string): string {
  return text
    .replace(/(?<![A-Za-z])(?:AI|GLM|ChatGLM|GPT|人工智能|大模型)(?![A-Za-z0-9])/g, '系统')
    .replace(/系统[ \t]+(?=[\u4e00-\u9fa5])/g, '系统')
}

/** 学生代码截断长度：一次提问没必要把整页模板都灌进去，token 也是钱 */
const MAX_CODE_CHARS = 2400
/** 最多带上几轮历史，够它记住上一个问题就行 */
const MAX_TURNS = 6
/** 上游偶尔会连上不回话，超时后主动断开，别让学生干等 */
const TIMEOUT_MS = 40000

export type WireRole = 'user' | 'assistant'
export type WireMessage = { role: 'system' | WireRole; content: string }

export type MentorContext = {
  problem: Problem | null
  lang: LangId | null
  /** 学生此刻编辑器里的代码；首页弹窗里没有编辑器，传空串 */
  code: string
  /**
   * 本地规则判题引擎最近拦下的错词（那句 explain）。
   * 有了它，小游就不用再对着「输出看起来是对的」代码泛泛地夸，能直接点那一行。
   */
  ruleHit?: string | null
}

function clip(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max)}\n…（后面还有 ${text.length - max} 个字符被省略）`
}

/**
 * 把「题目 + 当前代码 + 本轮历史 + 这轮提问」拼成一条消息。
 * 题目描述和编辑器内容都按需求原文带上，AI 才问得出针对性的问题。
 */
export function buildMentorMessages(question: string, history: WireMessage[], ctx: MentorContext): WireMessage[] {
  const { problem, lang, code, ruleHit } = ctx
  const block: string[] = []

  if (problem) {
    block.push(
      `【当前题目】${problem.title}（${DIFFICULTY_LABEL[problem.difficulty]} · ${problem.chapter}）`,
      `题目描述：${problem.description.trim()}`,
      `通关目标：${problem.goals.map((goal) => goal.trim()).join('；')}`,
    )
  } else {
    block.push('【当前题目】学生没在任何一道题里，只是随口问编程问题')
  }

  block.push(
    lang
      ? `【使用语言】${LANGUAGES[lang].label}`
      : '【使用语言】还没选',
  )

  const trimmed = code.trim()
  block.push(
    trimmed
      ? `【学生此刻的编辑器代码】\n${clip(trimmed, MAX_CODE_CHARS)}`
      : '【学生此刻的编辑器代码】（还没动手写，编辑器是起手模板或空的）',
  )

  /**
   * 本地规则判题引擎的结论：它的输出行是「看着对」的，只有引擎拦下来的错词是真信号。
   * 带上这一段，小游就该针对那一行提问，而不是照旧夸一句「思路不错」。
   */
  if (ruleHit) {
    block.push(
      `【本地规则判题引擎刚刚拦下的一次提交】${ruleHit}\n` +
        (problem ? `这道题的标准输出是：\n${problem.expectedOutput}\n` : '') +
        '学生的代码可能把结果打印对了，但上面那个写法本身是错的。请只针对那一行追问一句，点出「输出碰巧对但逻辑不对」这件事，仍然不要给代码。',
    )
  }

  block.push(`【学生这轮的问题】${question.trim()}`)

  const recent = history.slice(-MAX_TURNS)
  return [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    ...recent,
    { role: 'user', content: block.join('\n\n') },
  ]
}

/** 界面上只说「中枢接不上」，是密钥、代理还是上游抽风，留给控制台 */
function friendlyError(status: number, raw: string): string {
  const blurb = raw.slice(0, 160).replace(/\s+/g, ' ')
  console.warn(`[小游] 中枢请求失败 status=${status} ${blurb}`)
  if (status === 401 || status === 403) {
    return '小游暂时接不上智能中枢：本地代理没带上密钥，配好之后重启一次服务。'
  }
  if (status === 404) {
    return '小游暂时接不上智能中枢：本地转发路径没生效。'
  }
  if (status === 429) {
    return '这一分钟问得太密了，被限流。喝口水，十几秒后再问一次。'
  }
  if (status >= 500) {
    return `智能中枢正在排队（${status}），过一会儿再问。`
  }
  return `智能中枢这次没答上来（${status}）。`
}

/** 解析一帧 SSE：返回增量文本；拿到 [DONE] 返回 null；坏帧返回空串跳过 */
export function parseSseFrame(frame: string): string | null {
  let delta = ''
  for (const line of frame.split('\n')) {
    const cleaned = line.replace(/\r$/, '')
    if (!cleaned.startsWith('data:')) continue
    const payload = cleaned.slice(5).trim()
    if (!payload) continue
    if (payload === '[DONE]') return null
    try {
      const json = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[]
        error?: { message?: string }
      }
      if (json.error) throw new Error(json.error.message ?? '上游返回了错误体')
      delta += json.choices?.[0]?.delta?.content ?? ''
    } catch (error) {
      if (error instanceof SyntaxError) continue
      throw error
    }
  }
  return delta
}

export type StreamInput = {
  question: string
  /** 之前的小游对话（role 用 assistant 表示导师） */
  history: WireMessage[]
  ctx: MentorContext
  /** 每来一段就调一次，界面拿它刷新气泡 */
  onDelta: (accumulated: string) => void
  signal?: AbortSignal
}

/** 发一次流式对话，返回完整回复；中途出错或超时会被 reject */
export async function streamMentorReply({ question, history, ctx, onDelta, signal }: StreamInput): Promise<string> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort('timeout'), TIMEOUT_MS)
  const relay = () => ctrl.abort('cancelled')
  signal?.addEventListener('abort', relay)

  try {
    const res = await fetch(AI_CHAT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: buildMentorMessages(question, history, ctx),
        stream: true,
        temperature: 0.8,
        max_tokens: 700,
      }),
      signal: ctrl.signal,
    })

    if (!res.ok) throw new Error(friendlyError(res.status, await res.text().catch(() => '')))
    if (!res.body) throw new Error('这个浏览器读不了流式响应，请换 Chrome / Edge 最新版。')

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let answer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let cut = buffer.indexOf('\n\n')
      while (cut >= 0) {
        const frame = buffer.slice(0, cut)
        buffer = buffer.slice(cut + 2)
        const delta = parseSseFrame(frame)
        if (delta === null) {
          onDelta(maskModelIdentity(answer))
          return maskModelIdentity(answer)
        }
        if (delta) {
          answer += delta
          /** 每次都是拿整段已积累的文本去刷气泡，所以「AI」可能被拆成两帧：在这里统一抹平 */
          onDelta(maskModelIdentity(answer))
        }
        cut = buffer.indexOf('\n\n')
      }
    }

    onDelta(maskModelIdentity(answer))
    return maskModelIdentity(answer)
  } catch (error) {
    if (ctrl.signal.aborted) {
      throw new Error(
        signal?.aborted
          ? '这次提问被取消了。'
          : '小游 40 秒没答上来，可能是网络或中枢排队。再问一次试试。',
      )
    }
    throw error instanceof Error ? error : new Error('小游没能回应，稍后再试。')
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', relay)
  }
}
