import { BadgeCheck, Flame, Radio, Trophy, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ACHIEVEMENTS } from '../../data/home'
import type { FeedKind } from '../../data/home'
import { cn } from '../../lib/cn'

const KIND: Record<FeedKind, { icon: LucideIcon; color: string; ring: string; verb: string }> = {
  badge: { icon: BadgeCheck, color: 'text-neon-cyan', ring: 'ring-neon-cyan/30', verb: '解锁徽章' },
  streak: { icon: Flame, color: 'text-neon-amber', ring: 'ring-neon-amber/30', verb: '达成' },
  level: { icon: TrendingUp, color: 'text-neon-violet', ring: 'ring-neon-violet/30', verb: '升到' },
  victory: { icon: Trophy, color: 'text-neon-pink', ring: 'ring-neon-pink/30', verb: '拿下' },
}

function ago(min: number) {
  if (min < 60) return `${min} 分钟前`
  return `${Math.floor(min / 60)} 小时前`
}

function initials(name: string) {
  return name.slice(0, name.length > 2 ? 1 : 2)
}

export function AchievementFeed() {
  return (
    <section className="glass flex h-full flex-col rounded-2xl p-4 sm:p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Radio className="h-4 w-4 text-neon-lime" />
          最新战报
        </h2>
        <span className="flex items-center gap-1.5 rounded-full bg-neon-lime/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-neon-lime ring-1 ring-neon-lime/25">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-neon-lime" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-neon-lime" />
          </span>
          live
        </span>
      </header>

      <p className="mt-1 text-xs text-slate-500">看看同学们刚刚搞定了什么</p>

      <ul className="mt-4 flex-1 space-y-2.5">
        {ACHIEVEMENTS.map((a, i) => {
          const k = KIND[a.kind]
          const Icon = k.icon
          return (
            <li
              key={a.id}
              className={cn(
                'group flex items-start gap-3 rounded-xl bg-ink-900/50 p-3 ring-1 ring-white/5 transition-all duration-300 hover:bg-ink-800/60 hover:ring-white/15',
                i === 0 && 'animate-glow-pulse ring-neon-cyan/25',
              )}
            >
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/10 to-transparent font-bold ring-1',
                  k.ring,
                  k.color,
                )}
              >
                {initials(a.player)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-semibold text-slate-100">{a.player}</span>
                  <span className="text-slate-500"> {k.verb} </span>
                  <span className={cn('font-semibold', k.color)}>【{a.title}】</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{a.detail}</p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <Icon className={cn('h-4 w-4', k.color)} />
                <time className="font-mono text-[10px] text-slate-600">{ago(a.minutesAgo)}</time>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
