import { History, Swords } from 'lucide-react'
import { ARENA_MODES } from '../../data/arena'
import { useStats } from '../../context/AuthContext'
import { recordOf, winRateOf } from '../../data/stats'
import type { MatchResult } from '../../data/stats'
import { cn } from '../../lib/cn'

const RESULT: Record<MatchResult, { label: string; pill: string; accent: string }> = {
  win: {
    label: '胜',
    pill: 'bg-neon-lime/15 text-neon-lime ring-neon-lime/40',
    accent: 'text-neon-lime',
  },
  loss: {
    label: '负',
    pill: 'bg-rose-500/10 text-rose-300/80 ring-rose-500/30',
    accent: 'text-rose-300/70',
  },
}

const modeName = (id: string) => ARENA_MODES.find((mode) => mode.id === id)?.name ?? id

/** 战绩列表只展示最近 8 场，胜率和场次始终按全部战绩算 */
const RECENT = 8

export function MatchHistory() {
  const stats = useStats()
  const record = recordOf(stats)
  const recent = stats.matches.slice(0, RECENT)

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <History className="h-4 w-4 text-neon-cyan" />
          历史战绩
        </h2>
        <span className="ml-auto font-mono text-[11px] text-slate-500">
          近 {record.total} 场 · <b className="text-neon-lime">{record.wins} 胜</b>{' '}
          <b className="text-rose-300/80">{record.losses} 负</b> · 胜率{' '}
          <b className="text-neon-cyan">{winRateOf(stats)}%</b>
        </span>
      </header>

      {record.total === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-8 text-center">
          <Swords className="h-6 w-6 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">还没有一场对战</p>
          <p className="max-w-xs font-mono text-[11px] leading-relaxed text-slate-600">
            去竞技场点「随机匹配对手」，第一场胜负就记在这里，胜率也跟着算。
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {recent.map((match) => {
              const style = RESULT[match.result]
              const won = match.points > 0
              return (
                <li
                  key={match.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl bg-ink-900/50 p-3 ring-1 transition-colors hover:ring-white/20',
                    match.result === 'win' ? 'ring-neon-lime/20' : 'ring-rose-500/15',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-sm font-black ring-1',
                      style.pill,
                    )}
                  >
                    {style.label}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      <span className={style.accent}>{style.label}</span>
                      <span className="text-slate-500"> vs </span>
                      {match.opponent}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                      {modeName(match.mode)} · {match.detail}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className={cn('font-mono text-sm font-bold tabular-nums', style.accent)}>
                      {won ? '+' : ''}
                      {match.points}
                    </p>
                    <p className="font-mono text-[10px] text-slate-600">{match.when}</p>
                  </div>
                </li>
              )
            })}
          </ul>
          {record.total > recent.length && (
            <p className="mt-3 font-mono text-[10px] text-slate-600">
              只列出最近 {recent.length} 场，剩下 {record.total - recent.length} 场已经结算进胜率里
            </p>
          )}
        </>
      )}
    </section>
  )
}
