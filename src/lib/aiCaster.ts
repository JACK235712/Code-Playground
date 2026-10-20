/**
 * 竞技场 AI 解说员：接智谱 glm-4-flash-250414，对战舱顶部那一句话战况播报由它生成。
 *
 * 输入只有「对手是谁 + 什么段位 + 手速多快 + 刚刚发生了什么」，输出被压成一行短句。
 * 和助教共用同一条同源代理路径（密钥只在 vite.config.ts 的代理里，浏览器拿不到），
 * 但提示词是另一套：解说要激情和短，不引导、不给代码、不安慰。
 *
 * 这里只负责「问一次、拿一句」，不流式：解说每句不到 20 字，流式只会让气泡抖。
 * 请求失败（没配密钥、限流、超时）一律抛给调用处，由 useCaster 退回本地台词，
 * 所以断网时对战舱照样能打，只是解说变成写死的那几句。
 */
import { AI_CHAT_PATH, AI_MODEL, maskModelIdentity } from './aiMentor'

/** 需求原文，照抄不改 */
export const CASTER_SYSTEM_PROMPT =
  '你是竞技场解说，风格激情热血。根据当前对局情况（比如对手是王者段位、手速极快），用一句话解说，不超过20字。'

/** 值得让模型开口的时刻都是「战况变了」；玩家自己的失误由本地台词说清，也省下这些 token */
export type CasterEvent =
  | 'intro'
  | 'start'
  | 'idle'
  | 'idleFinished'
  | 'run'
  | 'switchLang'
  | 'finished'
  | 'emptyRun'
  | 'timeout'

const MODEL_EVENTS: ReadonlySet<CasterEvent> = new Set<CasterEvent>([
  'start',
  'idle',
  'idleFinished',
  'run',
  'switchLang',
  'finished',
])

export function casterNeedsModel(event: CasterEvent): boolean {
  return MODEL_EVENTS.has(event)
}

/** 一次解说的全部依据：段位和手速由对手 XP 折算而来，不在这里再算一遍 */
export type CasterScene = {
  event: CasterEvent
  opponent: string
  rankName: string
  level: number
  /** 每露一个字符的间隔，越小越凶 */
  charMs: number
  speedLabel: string
  problemTitle: string
  /** 刚刚发生了什么（就是本地那句兜底台词），模型照着它改写，不许编新事实 */
  fact: string
}

export function casterUserPrompt(scene: CasterScene): string {
  return [
    `对局：玩家正与 ${scene.opponent} 打 1v1 代码竞速，本局题目《${scene.problemTitle}》。`,
    `对手段位：${scene.rankName}（Lv.${scene.level}），${scene.speedLabel}，敲一个字停顿 ${scene.charMs} 毫秒。`,
    `此刻实况：${scene.fact}`,
    '就照这条实况解说，别改成别的事。',
  ].join('\n')
}

/** 一句解说的长度上限：提示词要求 20 字，模型偶尔多说几个字，这里兜住不给气泡撑高 */
const MAX_CAST_CHARS = 40

/**
 * 把模型返回的杂讯压成一行：换行、引号、markdown 星号都去掉，
 * 只在「确实超了」才截断——20 字本来就在限内，正常返回不会被切掉尾巴。
 */
export function cleanCast(raw: string): string {
  const oneLine = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/["“”'`*]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (oneLine.length === 0) throw new Error('解说员没给出内容')
  const masked = maskModelIdentity(oneLine)
  return masked.length > MAX_CAST_CHARS ? masked.slice(0, MAX_CAST_CHARS) : masked
}

/** 解说只有一句话，6 秒还没回来就不如直接播本地台词，别让气泡空转 */
const TIMEOUT_MS = 6000

function casterError(status: number): string {
  if (status === 401 || status === 403) return '解说台接不上智能中枢：本地代理没带上密钥，配好之后重启一次服务。'
  if (status === 429) return '解说被限流了。'
  return `智能中枢这次没答上来（${status}）。`
}

/** 发一次解说请求，返回那句播报；任何失败都 throw，由调用处退回本地台词 */
export async function requestCasterLine(scene: CasterScene, signal?: AbortSignal): Promise<string> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort('timeout'), TIMEOUT_MS)
  const relay = () => ctrl.abort('cancelled')
  signal?.addEventListener('abort', relay)

  try {
    const res = await fetch(AI_CHAT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: CASTER_SYSTEM_PROMPT },
          { role: 'user', content: casterUserPrompt(scene) },
        ],
        stream: false,
        temperature: 1,
        max_tokens: 48,
      }),
      signal: ctrl.signal,
    })

    if (!res.ok) throw new Error(casterError(res.status))
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      error?: { message?: string }
    }
    if (json.error) throw new Error(`解说台报错：${json.error.message}`)
    return cleanCast(json.choices?.[0]?.message?.content ?? '')
  } catch (error) {
    if (ctrl.signal.aborted) throw new Error(signal?.aborted ? '这次解说被取消。' : '解说台 6 秒没吭声。')
    throw error instanceof Error ? error : new Error('解说台没能开口。')
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', relay)
  }
}
