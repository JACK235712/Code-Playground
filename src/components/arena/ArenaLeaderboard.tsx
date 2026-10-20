import { Crown, Minus, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { WEEKLY_BOARD, boardPosition, gapToBoard } from '../../data/arena'
import { getRankInfo, levelOf, withAlpha } from '../../data/ranks'
import { useUser, useStats } from '../../context/AuthContext'
import { recordOf } from '../../data/stats'
import { cn } from '../../lib/cn'
import { PlayerAvatar } from '../PlayerAvatar'

const TREND = {
  up: { icon: TrendingUp, className: 'text-neon-lime' },
  flat: { icon: Minus, className: 'text-slate-500' },
  down: { icon: TrendingDown, className: 'text-neon-pink' },
}

export function ArenaLeaderboard() {
  const user = useUser()
  const stats = useStats()
  const record = recordOf(stats)
  const myRank = getRankInfo(stats.xp)
  const position = boardPosition(stats.xp)

  return (
    <section className="glass flex h-full flex-col rounded-2xl p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Trophy className="h-4 w-4 text-neon-amber" />
          本周极客榜
        </h2>
        <span className="ml-auto rounded-full bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-500 ring-1 ring-white/10">
          周一 00:00 刷新
        </span>
      </header>
      <p className="mt-1 text-xs text-slate-500">累计 XP 决定段位与排位，前 5 名进赛季决赛</p>

      <ol className="mt-4 flex-1 space-y-2">
        {WEEKLY_BOARD.map((row, index) => {
          const top = index === 0
          const rank = getRankInfo(row.xp)
          const trend = TREND[row.trend]
          const TrendIcon = trend.icon
          return (
            <li
              key={row.id}
              className={cn(
                'relative flex items-center gap-3 rounded-xl p-2.5 ring-1 transition-all duration-300',
                top
                  ? 'bg-gradient-to-r from-neon-amber/25 via-neon-amber/8 to-transparent ring-neon-amber/45'
                  : 'bg-white/5 ring-white/10 hover:bg-white/10 hover:ring-white/20',
              )}
            >
              {top && (
                <Crown
                  aria-hidden="true"
                  className="animate-float text-glow absolute -top-2.5 right-3 h-5 w-5 text-neon-amber"
                />
              )}

              <span
                className={cn(
                  'w-4 shrink-0 text-center font-mono text-xs font-bold',
                  top ? 'text-neon-amber' : 'text-slate-500',
                )}
              >
                {index + 1}
              </span>

              <PlayerAvatar
                name={row.player}
                xp={row.xp}
                size={top ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs'}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-sm font-bold leading-snug',
                    top && 'text-neon-amber text-glow',
                  )}
                >
                  {row.player}
                </p>
                {/* 段位文字与颜色由同一份门槛折算，跟名片、顶栏不可能对不上 */}
                <p
                  className="mt-0.5 truncate font-mono text-[10px] font-bold"
                  style={{ color: rank.color, textShadow: `0 0 10px ${withAlpha(rank.color, '66')}` }}
                >
                  {rank.name}
                  <span className="ml-1 font-normal text-slate-500">Lv.{levelOf(row.xp)}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <TrendIcon className={cn('h-3.5 w-3.5', trend.className)} />
                <span
                  className={cn(
                    'font-mono font-bold tabular-nums',
                    top ? 'text-sm text-neon-amber' : 'text-xs text-slate-300',
                  )}
                >
                  {row.xp.toLocaleString()}
                </span>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed border-white/15 px-3 py-2">
        <span className="font-mono text-xs font-bold text-slate-500">我</span>
        <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
          {user.nickname} ·{' '}
          <span className="font-bold" style={{ color: myRank.color }}>
            {myRank.name}
          </span>
        </span>
        <span className="font-mono text-xs font-bold tabular-nums text-neon-cyan">
          {stats.xp.toLocaleString()}
        </span>
        <span className="w-full font-mono text-[10px] text-slate-600 sm:w-auto">
          {position
            ? `本周第 ${position} 名 · ${record.total} 场`
            : record.total === 0
              ? '还没有 XP · 赢一场竞速就上榜'
              : `距上榜还差 ${gapToBoard(stats.xp)} XP · 本周 ${record.total} 场`}
        </span>
      </div>
    </section>
  )
}
