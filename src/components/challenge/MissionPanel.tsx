import { useState } from 'react'
import { ChevronDown, Clock, Coins, Lightbulb, Sparkles, Target, Users } from 'lucide-react'
import type { Problem } from '../../data/problems'
import { DIFFICULTY_ACCENT, DIFFICULTY_LABEL } from '../../data/problems'
import { cn } from '../../lib/cn'
import { DifficultyStars } from '../DifficultyStars'

export function MissionPanel({ problem, className }: { problem: Problem; className?: string }) {
  const [hintOpen, setHintOpen] = useState(false)

  return (
    <section className={cn('glass flex flex-col rounded-2xl p-4 sm:p-5', className)}>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neon-violet">
        {problem.chapter}
      </p>
      <h1 className="mt-2 text-lg font-bold leading-snug sm:text-xl">{problem.title}</h1>

      <p className="mt-2 flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'font-mono text-[11px] font-bold',
            DIFFICULTY_ACCENT[problem.difficulty],
          )}
        >
          {DIFFICULTY_LABEL[problem.difficulty]}
        </span>
        <DifficultyStars value={problem.stars} />
        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          {problem.minutes} 分钟
        </span>
        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
          <Users className="h-3.5 w-3.5" />
          {problem.players}
        </span>
      </p>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
        {problem.description}
      </p>

      <ul className="mt-4 space-y-2">
        {problem.goals.map((goal) => (
          <li key={goal} className="flex items-start gap-2 text-sm text-slate-400">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" />
            <span>{goal}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {problem.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-400 ring-1 ring-white/10"
          >
            #{tag}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setHintOpen((v) => !v)}
        aria-expanded={hintOpen}
        aria-controls="mission-hint"
        className={cn(
          'mt-5 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
          hintOpen
            ? 'bg-neon-amber/10 text-neon-amber ring-1 ring-neon-amber/30'
            : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10',
        )}
      >
        <span className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          查看提示
        </span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform duration-300', hintOpen && 'rotate-180')}
        />
      </button>

      <div
        id="mission-hint"
        className={cn(
          'grid transition-all duration-300 ease-out',
          hintOpen ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="rounded-xl border-l-2 border-neon-amber/60 bg-ink-900/60 p-3">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-neon-amber/80">
              <Sparkles className="h-3 w-3" />
              小游的提示
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{problem.hint}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{problem.hintExtra}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 pt-5 font-mono text-xs">
        <span className="flex items-center gap-1 text-neon-amber">
          <Coins className="h-4 w-4" />+{problem.rewardCoins}
        </span>
        <span className="flex items-center gap-1 text-neon-lime">
          <Sparkles className="h-4 w-4" />+{problem.rewardXp} XP
        </span>
      </div>
    </section>
  )
}
