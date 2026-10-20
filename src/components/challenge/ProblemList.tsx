import { AlertTriangle, Clock, RefreshCw, RotateCcw, Swords, X } from 'lucide-react'
import {
  DIFFICULTY_ACCENT,
  DIFFICULTY_LABEL,
  DIFFICULTY_ORDER,
  DIFFICULTY_PLAN,
} from '../../data/problems'
import type { Difficulty, Problem } from '../../data/problems'
import { cn } from '../../lib/cn'
import { DifficultyStars } from '../DifficultyStars'

const MIX = `${DIFFICULTY_PLAN.easy} 简单 · ${DIFFICULTY_PLAN.medium} 中等 · ${DIFFICULTY_PLAN.hard} 困难`

export function ProblemList({
  problems,
  selectedId,
  left,
  notice,
  flipping,
  onPick,
  onRefresh,
  onResetLog,
  onDismissNotice,
  className,
}: {
  problems: Problem[]
  selectedId: string
  /** 每个难度还剩多少道没抽过 */
  left: Record<Difficulty, number>
  notice: string | null
  /** true = 卡片正在翻出去，此时禁用按钮 */
  flipping: boolean
  onPick: (id: string) => void
  onRefresh: () => void
  onResetLog: () => void
  onDismissNotice: () => void
  className?: string
}) {
  return (
    <section className={cn('glass flex flex-col rounded-2xl p-3 sm:p-4', className)}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Swords className="h-4 w-4 text-neon-violet" />
          今日题池
        </h2>
        <span className="font-mono text-[10px] text-slate-500">{MIX}</span>
        <button
          type="button"
          onClick={onRefresh}
          aria-busy={flipping}
          disabled={flipping}
          className={cn(
            'ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-300 transition-colors',
            'hover:border-neon-cyan/40 hover:text-neon-cyan active:scale-[0.97]',
            flipping && 'pointer-events-none opacity-50',
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', flipping && 'animate-spin')} />
          {flipping ? '抽取中' : '换一批'}
        </button>
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px]">
        {DIFFICULTY_ORDER.map((tier) => (
          <span
            key={tier}
            className={cn(
              'rounded-md bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10',
              left[tier] > 0 ? 'text-slate-500' : 'text-neon-pink',
            )}
          >
            {DIFFICULTY_LABEL[tier]}还剩 {left[tier]}
          </span>
        ))}
        <button
          type="button"
          onClick={onResetLog}
          className="ml-auto flex items-center gap-1 text-[10px] text-slate-500 transition-colors hover:text-neon-cyan"
        >
          <RotateCcw className="h-3 w-3" />
          重置抽取记录
        </button>
      </div>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 flex items-start gap-2 rounded-xl border border-neon-amber/30 bg-neon-amber/10 p-2.5"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neon-amber" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-neon-amber">{notice}</p>
          <button
            type="button"
            onClick={onDismissNotice}
            aria-label="关闭提示"
            className="rounded-md p-0.5 text-neon-amber/70 transition-colors hover:bg-neon-amber/10 hover:text-neon-amber"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ul className="mt-3 space-y-2" style={{ perspective: '720px' }}>
        {problems.map((problem, index) => {
          const selected = problem.id === selectedId
          return (
            <li key={problem.id}>
              <div
                style={{
                  transformOrigin: 'top center',
                  transform: flipping ? 'rotateX(-84deg)' : 'rotateX(0deg)',
                  opacity: flipping ? 0 : 1,
                  transition:
                    'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms ease',
                  transitionDelay: `${index * 45}ms`,
                  willChange: 'transform, opacity',
                }}
              >
                <button
                  type="button"
                  onClick={() => onPick(problem.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl p-3 text-left ring-1 transition-all duration-200',
                    selected
                      ? 'bg-gradient-to-br from-neon-violet/25 to-neon-pink/5 ring-neon-violet/50 shadow-glow-violet'
                      : 'bg-white/5 ring-white/10 hover:bg-white/10 hover:ring-white/20',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[11px] ring-1',
                      selected
                        ? 'bg-neon-violet/20 text-neon-violet ring-neon-violet/40'
                        : 'bg-ink-950/70 text-slate-500 ring-white/10',
                    )}
                  >
                    {index + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold leading-snug">
                      {problem.title}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'font-mono text-[10px] font-bold',
                          DIFFICULTY_ACCENT[problem.difficulty],
                        )}
                      >
                        {DIFFICULTY_LABEL[problem.difficulty]}
                      </span>
                      <DifficultyStars value={problem.stars} size="h-3 w-3" />
                      <span className="font-mono text-[10px] text-slate-500">
                        {problem.chapter}
                      </span>
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-slate-500">
                    <Clock className="h-3 w-3" />
                    {problem.minutes}′
                  </span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
