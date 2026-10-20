import { Bot, CheckCircle2, Lightbulb, Sparkles, Stethoscope, X } from 'lucide-react'
import type { CodeFacts, Diagnosis, Hint, HintKind, Review } from '../../lib/codeWatch'
import { cn } from '../../lib/cn'

const HINT_ACCENT: Record<HintKind, { text: string; ring: string; bg: string }> = {
  comment: { text: 'text-neon-cyan', ring: 'ring-neon-cyan/30', bg: 'bg-neon-cyan/10' },
  magic: { text: 'text-neon-amber', ring: 'ring-neon-amber/30', bg: 'bg-neon-amber/10' },
  indent: { text: 'text-neon-violet', ring: 'ring-neon-violet/30', bg: 'bg-neon-violet/10' },
}

/** 面板现在在说什么：评审 > 诊断 > 轻提示，标题跟着内容走，不看状态球 */
const MODE = {
  review: { title: '代码评审报告', accent: 'text-neon-lime' },
  diagnosis: { title: '主动诊断', accent: 'text-neon-pink' },
  hints: { title: '实时轻提示', accent: 'text-neon-violet' },
} as const

type Mode = keyof typeof MODE

/**
 * 编辑器下方的结对编程面板：平时只出一句话，
 * 学生敲出问题输出时它会自己开口，通关后自动变成评审报告。
 * 这里的一切都是本地启发式，不会偷偷调 AI 接口烧 token。
 */
export function ButlerNotes({
  facts,
  hints,
  diagnosis,
  review,
  onAsk,
  onDismiss,
  onClear,
}: {
  facts: CodeFacts
  hints: Hint[]
  diagnosis: Diagnosis | null
  review: Review | null
  onAsk: (text: string) => void
  onDismiss: (kind: HintKind) => void
  /** 「先不用」/「收起报告」：把当前这条主动播报关掉 */
  onClear: () => void
}) {
  const mode: Mode = review ? 'review' : diagnosis ? 'diagnosis' : 'hints'
  const { title, accent } = MODE[mode]

  return (
    <section className="border-t border-white/10 bg-ink-900/50 px-3 py-2.5">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest">
        {mode === 'diagnosis' ? (
          <Stethoscope className={cn('h-3.5 w-3.5', accent)} />
        ) : mode === 'review' ? (
          <Sparkles className={cn('h-3.5 w-3.5', accent)} />
        ) : (
          <Bot className={cn('h-3.5 w-3.5', accent)} />
        )}
        <span className={accent}>{title}</span>
        <span className="ml-auto hidden text-slate-600 sm:inline">
          {facts.codeLines} 行 · 注释 {facts.commentLines} · 疑似魔法数字 {facts.magic}
        </span>
      </p>

      <div className="mt-2 space-y-2">
        {review && (
          <div className="rounded-xl bg-ink-950/60 p-3 ring-1 ring-neon-lime/30">
            <ul className="space-y-1.5">
              {review.lines.map((line) => (
                <li key={line.text} className="flex items-start gap-2 text-xs leading-relaxed">
                  {line.kind === 'ok' ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-lime" />
                  ) : (
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-amber" />
                  )}
                  <span className={line.kind === 'ok' ? 'text-slate-300' : 'text-neon-amber'}>
                    {line.kind === 'ok' ? '✔ ' : '💡 '}
                    {line.text}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onAsk(review.ask)}
              className="mt-2.5 flex h-7 items-center gap-1.5 rounded-lg border border-neon-lime/40 bg-neon-lime/10 px-3 text-[11px] font-bold text-neon-lime transition-colors hover:bg-neon-lime/20 active:scale-[0.97]"
            >
              <Sparkles className="h-3 w-3" />
              把这条建议拿去问小游
            </button>
            <button
              type="button"
              onClick={onClear}
              className="mt-2.5 ml-2 flex h-7 items-center rounded-lg border border-white/10 px-2.5 text-[11px] text-slate-400 transition-colors hover:text-slate-200"
            >
              收起报告
            </button>
          </div>
        )}

        {!review && diagnosis && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-neon-pink/10 p-3 ring-1 ring-neon-pink/30">
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-neon-pink">
              {diagnosis.text}
            </p>
            <button
              type="button"
              onClick={() => onAsk(diagnosis.ask)}
              className="flex h-7 items-center gap-1.5 rounded-lg bg-gradient-to-r from-neon-pink to-neon-violet px-3 text-[11px] font-bold text-ink-950 transition-all hover:brightness-110 active:scale-[0.97]"
            >
              <Bot className="h-3 w-3" />
              {diagnosis.line ? `看看第 ${diagnosis.line} 行` : '帮我看看'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="flex h-7 items-center rounded-lg border border-white/10 px-2.5 text-[11px] text-slate-400 transition-colors hover:text-slate-200"
            >
              先不用
            </button>
          </div>
        )}

        {!review && !diagnosis && hints.length === 0 && (
          <p className="text-xs leading-relaxed text-slate-500">
            {facts.codeLines === 0
              ? '还没有代码——写下第一行会跑的东西，我就开始跟着看。'
              : '目前没挑出问题。卡住了点右下角的状态球，我随时接话。'}
          </p>
        )}

        {!review &&
          !diagnosis &&
          hints.map((hint) => {
            const tone = HINT_ACCENT[hint.kind]
            return (
              <div
                key={hint.kind}
                className={cn('flex items-start gap-2 rounded-xl p-2.5 ring-1', tone.bg, tone.ring)}
              >
                <Lightbulb className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tone.text)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-slate-200">{hint.text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {hint.line && (
                      <span className="rounded-md bg-ink-950/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 ring-1 ring-white/10">
                        第 {hint.line} 行
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onAsk(hint.ask)}
                      className={cn(
                        'text-[11px] font-bold underline-offset-4 transition-colors hover:underline',
                        tone.text,
                      )}
                    >
                      问小游怎么改
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(hint.kind)}
                  aria-label="关闭这条提示"
                  className="rounded-md p-0.5 text-slate-500 transition-colors hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
      </div>
    </section>
  )
}
