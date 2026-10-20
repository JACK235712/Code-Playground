import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, Coins, Sparkles, Users, Zap } from 'lucide-react'
import { LANGUAGES } from '../../data/languages'
import { DAILY_PREVIEW, DAILY_PROBLEM } from '../../data/home'
import { DIFFICULTY_ACCENT, DIFFICULTY_LABEL } from '../../data/problems'
import { cn } from '../../lib/cn'
import { DifficultyStars } from '../DifficultyStars'

export function DailyChallengeCard() {
  const navigate = useNavigate()
  const problem = DAILY_PROBLEM
  const lang = LANGUAGES[problem.suggestLang ?? 'cpp']

  function start() {
    // 路由传参：把这一道题的 ID 交给挑战页，它会自动选中并高亮
    navigate('/challenge', { state: { problemId: problem.id } })
  }

  return (
    <div className="neon-frame w-full">
      <article className="glass flex h-full flex-col gap-5 rounded-2xl bg-ink-900/70 p-5 sm:p-6 lg:flex-row lg:items-stretch lg:gap-7">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-neon-violet/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-neon-violet ring-1 ring-neon-violet/30">
              <Zap className="h-3.5 w-3.5" />
              今日推荐
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[11px] text-slate-300 ring-1 ring-white/10">
              {problem.suggestLang ? `建议 ${lang.label}` : 'C++ · Java · Python'}
            </span>
            <span
              className={cn(
                'font-mono text-[11px] font-bold',
                DIFFICULTY_ACCENT[problem.difficulty],
              )}
            >
              {DIFFICULTY_LABEL[problem.difficulty]}
            </span>
          </div>

          <h2 className="mt-3 text-xl font-bold leading-snug sm:text-2xl">{problem.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{problem.description}</p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] text-slate-500">难度</dt>
              <dd className="mt-1.5 flex items-center gap-1.5">
                <DifficultyStars value={problem.stars} />
                <span className="font-mono text-[11px] text-slate-500">{problem.stars}/5</span>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">预计耗时</dt>
              <dd className="mt-1.5 flex items-center gap-1.5 font-mono text-neon-cyan">
                <Clock className="h-4 w-4" />
                {problem.minutes} 分钟
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">已挑战</dt>
              <dd className="mt-1.5 flex items-center gap-1.5 font-mono text-slate-200">
                <Users className="h-4 w-4 text-slate-400" />
                {problem.players}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-slate-500">通关奖励</dt>
              <dd className="mt-1.5 flex items-center gap-2 font-mono text-xs">
                <span className="flex items-center gap-1 text-neon-amber">
                  <Coins className="h-4 w-4" />+{problem.rewardCoins}
                </span>
                <span className="flex items-center gap-1 text-neon-lime">
                  <Sparkles className="h-4 w-4" />+{problem.rewardXp}
                </span>
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={start}
            className="group mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet font-bold text-ink-950 shadow-glow transition-all duration-300 hover:brightness-110 active:scale-[0.98] sm:mt-auto sm:w-fit sm:px-7"
          >
            开始挑战
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>

        {/* faux editor preview — 只是氛围，真正的编辑器在挑战页 */}
        <div className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl bg-ink-950/80 ring-1 ring-white/10 lg:flex">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-neon-pink/80" />
            <span className="h-2 w-2 rounded-full bg-neon-amber/80" />
            <span className="h-2 w-2 rounded-full bg-neon-lime/80" />
            <span className="ml-2 font-mono text-[10px] text-slate-500">{lang.fileName}</span>
          </div>
          <pre className="flex-1 overflow-hidden p-3 font-mono text-[11px] leading-relaxed text-slate-300">
            {DAILY_PREVIEW.map((line, i) => (
              <div key={line}>
                <span className="mr-3 select-none text-slate-600">{i + 1}</span>
                {line}
              </div>
            ))}
            <span className="mt-1 inline-block h-3.5 w-1.5 animate-pulse bg-neon-cyan align-middle" />
          </pre>
        </div>
      </article>
    </div>
  )
}
