import { useState } from 'react'
import { Bug, Crown, Flame, Lock, Moon, Repeat2, Shield, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStats } from '../../context/AuthContext'
import { BADGE_CATALOG } from '../../data/player'
import type { BadgeIconId } from '../../data/player'
import { earnedBadgeCount } from '../../data/stats'
import { cn } from '../../lib/cn'

const ICON: Record<BadgeIconId, LucideIcon> = {
  spark: Sparkles,
  loop: Repeat2,
  bug: Bug,
  flame: Flame,
  crown: Crown,
  moon: Moon,
  shield: Shield,
}

export function BadgeWall({ className }: { className?: string }) {
  const stats = useStats()
  const [activeId, setActiveId] = useState<string | null>(null)
  const earned = earnedBadgeCount(stats)

  return (
    <section className={cn('glass flex h-full flex-col rounded-2xl p-4 sm:p-5', className)}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Sparkles className="h-4 w-4 text-neon-amber" />
          荣誉徽章墙
        </h2>
        <span className="ml-auto font-mono text-[11px] text-slate-500">
          <b className="text-neon-amber">{earned}</b> / {BADGE_CATALOG.length} 已解锁
        </span>
      </header>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-amber to-neon-pink transition-[width] duration-500"
          style={{ width: `${(earned / BADGE_CATALOG.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 grid flex-1 grid-cols-2 gap-3">
        {BADGE_CATALOG.map((badge) => {
          const Icon = ICON[badge.icon]
          const open = activeId === badge.id
          const when = stats.badges[badge.id]
          const unlocked = Boolean(when)
          const progress = stats.badgeProgress[badge.id] ?? badge.hint
          return (
            <button
              key={badge.id}
              type="button"
              aria-describedby={open ? `badge-tip-${badge.id}` : undefined}
              onMouseEnter={() => setActiveId(badge.id)}
              onMouseLeave={() => setActiveId((cur) => (cur === badge.id ? null : cur))}
              onFocus={() => setActiveId(badge.id)}
              onBlur={() => setActiveId((cur) => (cur === badge.id ? null : cur))}
              onClick={() => setActiveId((cur) => (cur === badge.id ? null : badge.id))}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-2xl p-3.5 text-center ring-1 transition-all duration-300',
                unlocked
                  ? 'bg-gradient-to-br from-neon-amber/20 via-neon-pink/8 to-transparent ring-neon-amber/30 hover:-translate-y-1 hover:shadow-glow-violet'
                  : 'bg-white/[0.03] ring-white/10 grayscale',
              )}
            >
              <span
                className={cn(
                  'grid h-11 w-11 place-items-center rounded-full ring-1',
                  unlocked ? 'bg-ink-950/70 ring-neon-amber/40' : 'bg-ink-900/80 ring-white/10',
                )}
              >
                {unlocked ? (
                  <Icon className="h-5 w-5 text-neon-amber" />
                ) : (
                  <Lock className="h-4 w-4 text-slate-600" />
                )}
              </span>

              <span className="min-w-0">
                <span
                  className={cn(
                    'block truncate text-xs font-bold',
                    unlocked ? 'text-slate-100' : 'text-slate-500',
                  )}
                >
                  {badge.name}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">
                  {unlocked ? when : progress}
                </span>
              </span>

              {open && (
                <span
                  role="tooltip"
                  id={`badge-tip-${badge.id}`}
                  className="glass pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-40 -translate-x-1/2 rounded-xl p-2.5 text-left text-[11px] leading-snug text-slate-200 ring-white/20"
                >
                  <b className={unlocked ? 'text-neon-amber' : 'text-slate-400'}>
                    {unlocked ? '已解锁' : '未解锁'}
                  </b>
                  <span className="mt-1 block text-slate-300">{badge.desc}</span>
                  <span className="mt-1 block font-mono text-[10px] text-slate-500">
                    {unlocked ? `获得于 ${when}` : `怎么拿：${progress}`}
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="mt-3 font-mono text-[10px] text-slate-600">
        {earned
          ? '悬浮或点一下徽章，看它是怎么来的'
          : '一枚都还没解锁——通第一关就会点亮「初出茅庐」'}
      </p>
    </section>
  )
}
