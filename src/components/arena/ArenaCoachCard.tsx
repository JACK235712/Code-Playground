import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrainCircuit, Flame, Target } from 'lucide-react'
import type { ModeId } from '../../data/arena'
import { coachPick } from '../../data/arenaHost'
import { useStats } from '../../context/AuthContext'
import { Typed } from '../Typed'

/**
 * AI 教练推荐：竞技场上面这张卡只说一句——依据写在右上角，两个去处直接能点。
 * 依据和去处都出自 coachPick(stats)，连败几场、练哪道题是从账号战绩里数出来的，
 * 所以不会出现「推荐你去补递归，按钮却跳去写 Hello World」。
 */
export function ArenaCoachCard({ onPlay }: { onPlay: (mode: ModeId) => void }) {
  const stats = useStats()
  const navigate = useNavigate()
  const pick = useMemo(() => coachPick(stats), [stats])

  function go(action: { label: string; mode?: ModeId; to?: string; state?: { problemId?: string } }) {
    if (action.mode) {
      onPlay(action.mode)
      return
    }
    if (action.to) navigate(action.to, action.state ? { state: action.state } : undefined)
  }

  return (
    <section className="neon-frame">
      <div className="glass relative overflow-hidden rounded-2xl p-4 sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-20 h-44 w-44 rounded-full bg-neon-amber/15 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-amber/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-neon-amber ring-1 ring-neon-amber/30">
            <Target className="h-3.5 w-3.5" />
            智能战术推荐
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 font-mono text-[10px] text-slate-400 ring-1 ring-white/10">
            <Flame className="h-3.5 w-3.5 text-neon-pink" />
            {pick.badge}
          </span>
        </div>

        <p className="relative mt-3 text-sm leading-relaxed text-slate-200">
          <Typed text={pick.speech} caret="bg-neon-amber" />
        </p>

        <div className="relative mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => go(pick.primary)}
            className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet px-4 text-sm font-bold text-ink-950 shadow-glow transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <BrainCircuit className="h-4 w-4" />
            {pick.primary.label}
          </button>
          <button
            type="button"
            onClick={() => go(pick.secondary)}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-300 transition-colors hover:border-neon-amber/40 hover:text-neon-amber"
          >
            {pick.secondary.label}
          </button>
        </div>
      </div>
    </section>
  )
}
