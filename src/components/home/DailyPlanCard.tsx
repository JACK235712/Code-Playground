import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Coins, Sparkles } from 'lucide-react'
import { dailyPlan } from '../../data/butler'
import type { PlanStep } from '../../data/butler'
import { getRankInfo, levelOf } from '../../data/ranks'
import { useStats } from '../../context/AuthContext'
import { cn } from '../../lib/cn'
import { Typed } from '../Typed'

/** 序号圈、光标和「刚露出来的那一条」的发光色，按步骤顺序轮换；类名必须原样写死，Tailwind 才扫得到 */
const STEP_ACCENT = [
  { text: 'text-neon-cyan', ring: 'ring-neon-cyan/40', caret: 'bg-neon-cyan' },
  { text: 'text-neon-violet', ring: 'ring-neon-violet/40', caret: 'bg-neon-violet' },
  { text: 'text-neon-amber', ring: 'ring-neon-amber/40', caret: 'bg-neon-amber' },
]

export function DailyPlanCard() {
  const stats = useStats()
  const navigate = useNavigate()
  const plan = useMemo(() => dailyPlan(stats), [stats])
  const rank = getRankInfo(stats.xp)

  /** 露出到第几段：1 = 只有开场白，之后每打完一段往前挪一格 */
  const [revealed, setRevealed] = useState(1)
  const total = plan.steps.length + 2
  const reveal = () => setRevealed((n) => Math.min(n + 1, total))

  // 账号数据一变（比如刚通关拿经验），计划就重新逐段播一遍，像是管家重新想了一遍
  useEffect(() => setRevealed(1), [plan])

  const shown = Math.min(Math.max(revealed - 1, 0), plan.steps.length)

  function go(step: PlanStep) {
    navigate(step.to, step.state ? { state: step.state } : undefined)
  }

  return (
    <section className="neon-frame">
      <div className="glass relative overflow-hidden rounded-2xl p-4 sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-neon-violet/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-14 h-44 w-44 rounded-full bg-neon-cyan/15 blur-3xl"
        />

        <header className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-violet/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-neon-violet ring-1 ring-neon-violet/30">
              <Bot className="h-3.5 w-3.5" />
              专属管家定制的今日计划
            </span>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              <Typed text={plan.intro} onDone={reveal} />
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              第一步奖励
            </span>
            <span className="flex items-center gap-2 font-mono text-xs">
              <span className="flex items-center gap-1 text-neon-lime">
                <Sparkles className="h-3.5 w-3.5" />+{plan.rewardXp} XP
              </span>
              <span className="flex items-center gap-1 text-neon-amber">
                <Coins className="h-3.5 w-3.5" />+{plan.rewardCoins}
              </span>
            </span>
          </div>
        </header>

        <ol className="relative mt-4 space-y-2">
          {plan.steps.slice(0, shown).map((step, i) => {
            const accent = STEP_ACCENT[i % STEP_ACCENT.length]
            const isFrontier = i === shown - 1 && revealed < total
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => go(step)}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-xl bg-ink-900/50 p-3 text-left ring-1 transition-all duration-300 hover:bg-ink-800/60 hover:ring-white/25',
                    isFrontier ? cn(accent.ring, 'animate-glow-pulse') : 'ring-white/5',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/5 font-mono text-[11px] font-bold ring-1',
                      accent.text,
                      accent.ring,
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-slate-500">
                      {step.label}
                    </span>
                    <Typed
                      text={step.text}
                      caret={accent.caret}
                      className="mt-1 block text-sm leading-relaxed text-slate-200"
                      onDone={reveal}
                    />
                  </span>
                  <span
                    className={cn(
                      'mt-3 flex shrink-0 items-center gap-1 text-[11px] font-bold opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
                      accent.text,
                    )}
                  >
                    去完成
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {revealed >= total && (
          <p className="relative mt-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-violet/15 to-neon-pink/10 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-200 ring-1 ring-neon-violet/25">
            <Sparkles className="h-4 w-4 shrink-0 text-neon-pink" />
            <Typed text={plan.outro} caret="bg-neon-pink" speed={24} />
            <span
              className="ml-auto hidden shrink-0 font-mono text-[10px] sm:block"
              style={{ color: rank.color }}
            >
              {rank.name} · Lv.{levelOf(stats.xp)}
            </span>
          </p>
        )}
      </div>
    </section>
  )
}
