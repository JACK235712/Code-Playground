import { Loader2, Swords, Users } from 'lucide-react'
import { POOL_ONLINE } from '../../data/arena'
import type { ModeId } from '../../data/arena'
import { levelOf } from '../../data/ranks'
import { useUser, useStats } from '../../context/AuthContext'
import { bestTimeOf, recordOf } from '../../data/stats'
import { cn } from '../../lib/cn'
import { PlayerAvatar } from '../PlayerAvatar'

/**
 * 大厅中央的开战面板。点了「随机匹配对手」先进匹配弹窗（转圈 → 匹配成功），
 * 弹窗上的「进入对战」才路由跳进全屏对战舱 /arena/battle，舱右上角退出回这屏。
 */
export function MatchQueue({ onPlay, busy }: { onPlay: (mode: ModeId) => void; busy: boolean }) {
  const user = useUser()
  const stats = useStats()
  const record = recordOf(stats)
  const bestTime = bestTimeOf(stats)

  return (
    <section className="neon-frame">
      <div className="glass relative overflow-hidden rounded-2xl p-5 sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-neon-violet/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-neon-cyan/15 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-neon-pink/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-neon-pink ring-1 ring-neon-pink/30">
                <Swords className="h-3.5 w-3.5" />
                1V1 代码竞速
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 font-mono text-[11px] text-slate-300 ring-1 ring-white/10">
                <Users className="h-3.5 w-3.5 text-neon-lime" />
                {POOL_ONLINE} 人在线等对手
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">
              同一道题，
              <span className="text-neon-cyan text-glow">谁先跑通谁赢</span>
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              系统给你找一个段位相近的对手，题目同时下发。不用背模板，比的是谁先把想法敲成能跑的代码。
            </p>

            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs">
              <div className="flex items-center gap-1.5">
                <dt className="text-slate-500">我的战绩</dt>
                {record.total === 0 ? (
                  <dd className="text-slate-500">还没开场 · 胜率 0%</dd>
                ) : (
                  <>
                    <dd className="font-bold text-neon-lime">{record.wins} 胜</dd>
                    <dd className="text-rose-400/80">{record.losses} 负</dd>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-slate-500">最快通关</dt>
                <dd className="font-bold text-neon-amber">{bestTime ?? '打一场就有'}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onPlay('debug')}
                className={cn(
                  'group relative flex h-16 w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-violet px-6 text-lg font-black text-ink-950 transition-all active:scale-[0.98] sm:h-[4.5rem] sm:w-auto sm:min-w-[19rem] sm:px-10 sm:text-xl',
                  busy ? 'opacity-80' : 'animate-glow-pulse shadow-glow hover:brightness-110',
                )}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    匹配中…
                    <span className="animate-sheen-x absolute inset-y-0 w-1/3 bg-white/30 blur-md" />
                  </>
                ) : (
                  <>
                    <Swords className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" />
                    随机匹配对手
                  </>
                )}
              </button>
            </div>
            <p className="mt-3 font-mono text-[11px] text-slate-600">
              匹配约需 3 秒 · 对手按你的段位 ±1 段 · 进入对战才切到对战舱页面，退出就回到大厅
            </p>
          </div>

          {/* 对战席位预览，纯氛围；真房间会把它换成双方实时进度 */}
          <div className="hidden shrink-0 items-center gap-4 rounded-2xl bg-ink-950/50 px-5 py-6 ring-1 ring-white/10 lg:flex">
            <div className="flex flex-col items-center gap-2">
              <PlayerAvatar name={user.nickname} xp={stats.xp} size="h-14 w-14 text-base" />
              <span className="font-mono text-[10px] text-slate-500">
                你 · Lv.{levelOf(stats.xp)}
              </span>
            </div>
            <span className="font-mono text-xl font-black text-neon-pink text-glow">VS</span>
            <div className="flex flex-col items-center gap-2">
              <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-white/20 text-2xl font-black text-slate-600">
                ?
              </span>
              <span className="font-mono text-[10px] text-slate-600">等待匹配</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
