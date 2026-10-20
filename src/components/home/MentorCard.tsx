import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { ArrowRight, MessageCircle, Mic, Sparkles, Square, X } from 'lucide-react'
import { HOME_QUICK_PROMPTS, MENTOR_PROMPTS } from '../../data/home'
import { AI_CORE_LABEL, streamMentorReply } from '../../lib/aiMentor'
import { useMentorChat } from '../../hooks/useMentorChat'
import { ChatComposer } from '../mentor/ChatComposer'
import { ChatLog } from '../mentor/ChatLog'

const OPENING = '嗨，我是小游。我不替你写代码，只在你卡住时给提示。今天卡在哪儿了？'

export function MentorCard() {
  const [open, setOpen] = useState(false)
  /** 从气泡带进对话框的那句话：弹窗一打开就替学生把它发出去 */
  const [seed, setSeed] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function ask(text: string | null) {
    setSeed(text)
    setOpen(true)
  }

  return (
    <>
      <section className="glass relative flex h-full flex-col overflow-hidden rounded-2xl px-5 py-6">
        <div className="bg-gradient-to-b from-neon-pink/45 to-neon-violet/45 absolute inset-x-10 -top-16 h-40 blur-3xl" />

        <div className="relative flex items-center gap-4">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => ask(null)}
            aria-haspopup="dialog"
            aria-label="召唤导师小游"
            className="group relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-pink via-neon-violet to-neon-blue text-white shadow-glow-violet transition-transform duration-300 hover:scale-105 active:scale-95"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-neon-violet/25" />
            <span className="absolute inset-2 rounded-full ring-1 ring-white/25" />
            <Mic className="relative h-8 w-8" strokeWidth={1.8} />
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-neon-lime ring-2 ring-ink-900" />
          </button>

          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight">
              小游 · <span className="text-neon-pink text-glow">你的专属向导</span>
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              7×24 待命，只给思路提示和下一步动作，绝不上来就甩答案。
            </p>
          </div>
        </div>

        <ul className="relative mt-5 space-y-2">
          {HOME_QUICK_PROMPTS.map((text) => (
            <li key={text}>
              <button
                type="button"
                onClick={() => ask(text)}
                aria-haspopup="dialog"
                /* 左下角收成小圆角，三个气泡看起来就像小游发过来的消息 */
                style={{ borderBottomLeftRadius: 6 }}
                className="group flex w-full items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-left text-xs text-slate-300 ring-1 ring-white/10 transition-all duration-300 hover:bg-neon-violet/15 hover:text-neon-violet hover:ring-neon-violet/40"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-neon-violet" />
                <span className="min-w-0 flex-1">{text}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => ask(null)}
          aria-haspopup="dialog"
          className="relative mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neon-pink/35 bg-neon-pink/10 text-sm font-bold text-neon-pink transition-all hover:bg-neon-pink/20 active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          直接开口问
        </button>
      </section>

      {open && <MentorDialog seed={seed} onClose={() => setOpen(false)} restoreFocusTo={triggerRef} />}
    </>
  )
}

function MentorDialog({
  seed,
  onClose,
  restoreFocusTo,
}: {
  seed: string | null
  onClose: () => void
  restoreFocusTo: RefObject<HTMLButtonElement | null>
}) {
  const { msgs, draft, setDraft, thinking, streaming, busy, send, stop } = useMentorChat(
    OPENING,
    ({ question, history, onDelta, signal }) =>
      // 首页弹窗没有编辑器可带，只把问题本身交给小游
      streamMentorReply({ question, history, onDelta, signal, ctx: { problem: null, lang: null, code: '' } }),
  )
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  /**
   * 气泡带进来的问题要替学生代发一次。延迟到下一个宏任务再发：
   * StrictMode 会「挂载—卸载—再挂载」跑两遍，而在 effect 里当场发出的那个请求，
   * 会被第一遍卸载时的 abort 顺手掐死，界面上就只剩一句「这次提问被取消了」。
   * 计时器在卸载时被清掉，所以真的只发一次。
   */
  const seededRef = useRef(false)
  const sendRef = useRef(send)
  sendRef.current = send
  useEffect(() => {
    if (!seed || seededRef.current) return
    const id = window.setTimeout(() => {
      if (seededRef.current) return
      seededRef.current = true
      sendRef.current(seed)
    }, 120)
    return () => window.clearTimeout(id)
  }, [seed])

  useEffect(() => {
    inputWrapRef.current?.querySelector('input')?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
      restoreFocusTo.current?.focus()
    }
  }, [restoreFocusTo])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/75 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={inputWrapRef}
        role="dialog"
        aria-modal="true"
        aria-label="召唤在线导师"
        className="glass flex max-h-[82dvh] w-full flex-col rounded-t-3xl border-neon-violet/25 sm:max-w-md sm:rounded-3xl"
      >
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="bg-gradient-to-br from-neon-pink to-neon-violet grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/20">
            <Mic className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">小游 · 在线导师</p>
            <p className="flex items-center gap-1.5 text-[11px] text-neon-lime">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-lime" />
              {busy ? '正在组织语言…' : '在线'}
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
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <ChatLog msgs={msgs} thinking={thinking} streaming={streaming} className="px-4 py-4" />

        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {MENTOR_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => send(p)}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-neon-violet/40 hover:text-neon-violet disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>

        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          disabled={busy}
          placeholder="说说你卡在哪里…"
        />
      </div>
    </div>
  )
}
