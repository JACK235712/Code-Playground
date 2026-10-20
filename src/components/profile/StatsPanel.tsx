import { Code2, Flame, Target, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStats } from '../../context/AuthContext'
import { codeLinesOf, recordOf, streakOf, winRateOf } from '../../data/stats'
import { cn } from '../../lib/cn'

type Stat = {
  icon: LucideIcon
  value: string
  unit: string
  label: string
  note: string
  color: string
  tile: string
}

const STATS: Omit<Stat, 'value' | 'note'>[] = [
  {
    icon: Code2,
    label: '累计手写代码',
    unit: '行',
    color: 'text-neon-cyan',
    tile: 'from-neon-cyan/25 to-transparent',
  },
  {
    icon: Trophy,
    label: '通关数',
    unit: '题',
    color: 'text-neon-lime',
    tile: 'from-neon-lime/25 to-transparent',
  },
  {
    icon: Target,
    label: '竞技场胜率',
    unit: '%',
    color: 'text-neon-pink',
    tile: 'from-neon-pink/25 to-transparent',
  },
  {
    icon: Flame,
    label: '连续打卡',
    unit: '天',
    color: 'text-neon-amber',
    tile: 'from-neon-amber/25 to-transparent',
  },
]

export function StatsPanel({ className }: { className?: string }) {
  const stats = useStats()
  const record = recordOf(stats)
  const streak = streakOf(stats)

  const values: Pick<Stat, 'value' | 'note'>[] = [
    {
      value: codeLinesOf(stats).toLocaleString(),
      note: streak ? '一行行敲的，复制粘贴不计数' : '写下第一行，这里就亮起来',
    },
    {
      value: String(stats.cleared),
      note: stats.cleared ? '只算首通 · 困难题也算' : '去挑战页通第一关',
    },
    {
      value: String(winRateOf(stats)),
      note: record.total ? `${record.wins} 胜 ${record.losses} 负` : '还没打过竞速',
    },
    {
      value: String(streak),
      note: streak > 1 ? '一天没断' : streak === 1 ? '才第 1 天，明天也别断' : '今天写一次就开第 1 天',
    },
  ]

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4', className)}>
      {STATS.map((stat, index) => {
        const Icon = stat.icon
        const { value, note } = values[index]
        return (
          <div
            key={stat.label}
            className="glass flex flex-col gap-3 rounded-2xl p-4 transition-transform duration-300 hover:-translate-y-1 sm:p-5"
          >
            <span
              className={cn(
                'grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/10',
                stat.tile,
              )}
            >
              <Icon className={cn('h-5 w-5', stat.color)} />
            </span>
            <p className="flex items-baseline gap-1">
              <span className={cn('font-mono text-2xl font-black tabular-nums', stat.color)}>
                {value}
              </span>
              <span className="text-xs text-slate-500">{stat.unit}</span>
            </p>
            <div>
              <p className="text-sm font-bold">{stat.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{note}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
