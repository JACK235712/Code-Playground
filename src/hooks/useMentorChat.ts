import { useCallback, useEffect, useRef, useState } from 'react'
import type { WireMessage } from '../lib/aiMentor'

export type ChatMsg = { role: 'mentor' | 'me'; text: string }

/**
 * 一次导师回复：拿到本轮问题、之前的对话和一个 onDelta，
 * onDelta 每被调一次界面就跟着长一段字（打字机效果由它驱动）。
 * 返回最终全文；出错直接抛，由 hook 换成气泡里的人话。
 */
export type MentorReply = (input: {
  question: string
  history: WireMessage[]
  onDelta: (accumulated: string) => void
  signal: AbortSignal
}) => Promise<string>

function patchLast(msgs: ChatMsg[], text: string): ChatMsg[] {
  return [...msgs.slice(0, -1), { role: 'mentor', text }]
}

export function useMentorChat(opening: string, reply: MentorReply) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([{ role: 'mentor', text: opening }])
  const [draft, setDraft] = useState('')
  /** 请求已发出、还没吐第一个字 */
  const [thinking, setThinking] = useState(false)
  /** 正在一个字一个字往外冒 */
  const [streaming, setStreaming] = useState(false)
  const ctrlRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)
  const replyRef = useRef(reply)
  replyRef.current = reply

  useEffect(
    () => () => {
      ctrlRef.current?.abort()
    },
    [],
  )

  const busy = thinking || streaming

  const send = useCallback(
    (text: string) => {
      const clean = text.trim()
      if (!clean || ctrlRef.current) return

      const history: WireMessage[] = msgs.map((msg) => ({
        role: msg.role === 'me' ? 'user' : 'assistant',
        content: msg.text,
      }))

      cancelledRef.current = false
      const ctrl = new AbortController()
      ctrlRef.current = ctrl
      setMsgs((prev) => [...prev, { role: 'me', text: clean }, { role: 'mentor', text: '' }])
      setDraft('')
      setThinking(true)

      replyRef
        .current({
          question: clean,
          history,
          onDelta: (accumulated) => {
            setThinking(false)
            setStreaming(true)
            setMsgs((prev) => patchLast(prev, accumulated))
          },
          signal: ctrl.signal,
        })
        .then((final) => {
          setMsgs((prev) => patchLast(prev, final || '（这次没话说）'))
        })
        .catch((error: unknown) => {
          const note = cancelledRef.current
            ? '已经停了，想问的时候再开口。'
            : error instanceof Error && error.message
              ? error.message
              : '小游没能回应，稍后再试。'
          setMsgs((prev) => {
            const last = prev[prev.length - 1]
            const kept = last && last.role === 'mentor' ? last.text : ''
            return patchLast(prev, kept ? `${kept}\n\n${note}` : note)
          })
        })
        .finally(() => {
          ctrlRef.current = null
          setThinking(false)
          setStreaming(false)
        })
    },
    [msgs],
  )

  const stop = useCallback(() => {
    cancelledRef.current = true
    ctrlRef.current?.abort()
  }, [])

  /**
   * 本地插一条小游的主动气泡（不请求模型、不烧 token）：
   * 编辑器里刚报错、刚通关，小游先在对话里说一声，学生点头才真的开口问。
   */
  const note = useCallback((text: string) => {
    setMsgs((prev) => {
      if (!text || ctrlRef.current) return prev
      if (prev[prev.length - 1]?.text === text) return prev
      return [...prev, { role: 'mentor', text }]
    })
  }, [])

  return { msgs, draft, setDraft, thinking, streaming, busy, send, stop, note }
}
