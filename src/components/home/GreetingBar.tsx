import { Bot, Timer } from 'lucide-react'
import { codingMinutesOf } from '../../data/stats'
import { greetingOf, profileOf } from '../../data/butler'
import { getRankInfo, withAlpha } from '../../data/ranks'
import { useStats, useUser } from '../../context/AuthContext'
import { Typed } from '../Typed'

function formatMinutes(min: number) {
  if (min < 60) return `${min} 分钟`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export function GreetingBar() {
  const user = useUser()
  const stats = useStats()
  const now = new Date()

  /** 管家说什么全看这个账号的真实数据，组件这边一个字都不写死 */
  const greeting = greetingOf(now.getHours(), stats)
  const p = profileOf(stats)
  const rank = getRankInfo(stats.xp)

  const facts = [
    `${p.cleared} 题通关`,
    p.streak > 0 ? `连续打卡 ${p.streak} 天` : '今天还没动笔',
    p.matches > 0 ? `对战 ${p.wins} 胜 ${p.losses} 负` : '对战 0 场',
  ]

  return (
    <section className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <h1 className="text-xl font-bold leading-tight sm:text-2xl">
          {greeting.lead}，
          <span className="bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-violet bg-clip-text text-transparent">
            {user.nickname}
          </span>
        </h1>

        <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-slate-400 sm:text-[13px]">
          <span
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1"
            style={{
              background: `linear-gradient(135deg, ${rank.color}, ${rank.colorTo})`,
              boxShadow: `0 0 12px -2px ${withAlpha(rank.color, '99')}`,
            }}
          >
            <Bot className="h-3 w-3 text-ink-950" />
          </span>
          <Typed text={greeting.text} caret="bg-neon-violet" />
        </p>

        <p className="mt-2 font-mono text-[11px] tracking-wide text-slate-500">
          <span className="text-slate-600">
            {now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })} ·{' '}
          </span>
          <span className="font-bold" style={{ color: rank.color }}>
            {rank.name}
          </span>
          <span className="text-slate-400"> Lv.{p.level}</span>
          <span className="text-slate-600"> · </span>
          {facts.join(' · ')}
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-ink-900/60 px-3 py-2 ring-1 ring-white/10">
        <Timer className="h-5 w-5 text-neon-cyan" />
        <div>
          <p className="text-[11px] leading-none text-slate-400">今日已写代码时间</p>
          <p className="mt-1 font-mono text-base font-bold leading-none tabular-nums text-neon-cyan text-glow">
            {formatMinutes(codingMinutesOf(stats))}
          </p>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-neon-lime/70" />
          <span className="relative h-2 w-2 rounded-full bg-neon-lime" />
        </span>
      </div>
    </section>
  )
}
