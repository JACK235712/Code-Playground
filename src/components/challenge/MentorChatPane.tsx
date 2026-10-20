import { useEffect, useRef } from 'react'
import { Mic, Square } from 'lucide-react'
import type { LangId } from '../../data/languages'
import type { Problem } from '../../data/problems'
import { useMentorChat } from '../../hooks/useMentorChat'
import { AI_CORE_LABEL, streamMentorReply } from '../../lib/aiMentor'
import { cn } from '../../lib/cn'
import { ChatComposer } from '../mentor/ChatComposer'
import { ChatLog } from '../mentor/ChatLog'

const OPENING =
  '我是小游。这道题我不给答案，只负责在你卡住的地方问一句——先说说：你打算让哪一行代码第一个跑起来？'

const CHAT_CHIPS = ['怎么做这道题？', '什么是循环？', '我已经写好了，帮我看看思路']

/** 编辑器递过来的动作：note = 小游自己说一句，ask = 替学生把问题发出去 */
export type Proactive = { mode: 'note' | 'ask'; text: string; nonce: number }

export function MentorChatPane({
  problem,
  lang,
  getCode,
  getRuleHit,
  proactive,
  className,
}: {
  problem: Problem
  lang: LangId
  getCode: () => string
  /** 规则判题引擎最近拦下的错词；没有则 null。小游要靠它说针对性的话 */
  getRuleHit?: () => string | null
  proactive?: Proactive
  className?: string
}) {
  const { msgs, draft, setDraft, thinking, streaming, busy, send, stop, note } = useMentorChat(
    OPENING,
    ({ question, history, onDelta, signal }) =>
      // 每次提问都现取编辑器里的代码，学生刚改的那一行也在里面
      streamMentorReply({
        question,
        history,
        onDelta,
        signal,
        ctx: { problem, lang, code: getCode(), ruleHit: getRuleHit?.() ?? null },
      }),
  )

  const rootRef = useRef<HTMLElement>(null)
  const sendRef = useRef(send)
  sendRef.current = send
  const noteRef = useRef(note)
  noteRef.current = note
  const seenRef = useRef(0)

  /**
   * 延后一拍再开口：StrictMode 会把 effect 跑两遍，
   * 立刻 send 会让真实提问发出去两次（第二次的回答还会盖住第一次）。
   */
  useEffect(() => {
    if (!proactive || proactive.nonce === seenRef.current) return
    const id = window.setTimeout(() => {
      if (proactive.nonce === seenRef.current) return
      seenRef.current = proactive.nonce
      if (proactive.mode === 'ask') {
        sendRef.current(proactive.text)
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else {
        noteRef.current(proactive.text)
      }
    }, 120)
    return () => window.clearTimeout(id)
  }, [proactive])

  return (
    <section ref={rootRef} className={cn('glass flex flex-col overflow-hidden rounded-2xl', className)}>
      <header className="flex items-center gap-2.5 border-b border-white/10 px-3 py-2.5">
        <span className="bg-gradient-to-br from-neon-pink to-neon-violet grid h-8 w-8 place-items-center rounded-full ring-1 ring-white/20">
          <Mic className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">小游 · 在线导师</p>
          <p className="flex items-center gap-1.5 text-[11px] text-neon-lime">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-neon-lime" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-neon-lime" />
            </span>
            {busy ? '正在组织语言…' : '在线 · 只提问，不给答案'}
          </p>
        </div>
        {busy && (
          <button
            type="button"
            onClick={stop}
            className="flex h-7 items-center gap-1 rounded-full border border-neon-pink/40 bg-neon-pink/10 px-2.5 text-[11px] font-bold text-neon-pink transition-colors hover:bg-neon-pink/20"
          >
            <Square className="h-3 w-3" />
            停止
          </button>
        )}
        <span
          title={AI_CORE_LABEL}
          className="rounded-full bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-500 ring-1 ring-white/10"
        >
          智能中枢 · 实时
        </span>
      </header>

      <ChatLog msgs={msgs} thinking={thinking} streaming={streaming} className="px-3 py-3" />

      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
        {CHAT_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={busy}
            onClick={() => send(chip)}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-neon-pink/40 hover:text-neon-pink disabled:opacity-40"
          >
            {chip}
          </button>
        ))}
      </div>

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSend={send}
        disabled={busy}
        placeholder="随时问我，比如「这道题该怎么入手」"
        className="pb-3"
      />
    </section>
  )
}
