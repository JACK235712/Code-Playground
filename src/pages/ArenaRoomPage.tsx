import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Flag, Route, Swords, Users, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ARENA_MODES, POOL_ONLINE } from '../data/arena'
import type { ModeId, Opponent } from '../data/arena'
import { getRankInfo, levelOf, withAlpha } from '../data/ranks'
import { useStats, useUser } from '../context/AuthContext'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { cn } from '../lib/cn'

const ROOM_STYLE: Record<Exclude<ModeId, 'debug'>, { icon: LucideIcon; text: string; tile: string }> = {
  golf: { icon: Flag, text: 'text-neon-lime', tile: 'from-neon-lime/30 to-neon-cyan/10' },
  maze: { icon: Route, text: 'text-neon-violet', tile: 'from-neon-violet/30 to-neon-blue/10' },
}

/** 匹配弹窗带过来的对手；直接输网址或刷新进来就没有，所以是可空的 */
function readOpponent(state: unknown): Opponent | null {
  if (!state || typeof state !== 'object') return null
  const value = (state as { opponent?: Opponent }).opponent
  return value && typeof value.player === 'string' ? value : null
}

/**
 * 高尔夫 / 迷宫的对战房间。
 * 匹配链路是真的跑通了（弹窗 → 3 秒 → 带对手进这里），但房间内的玩法本身还没实现，
 * 所以这一页只做三件事：亮出对手、说清规则、承认还在开发。
 */
export default function ArenaRoomPage({ mode }: { mode: Exclude<ModeId, 'debug'> }) {
  const info = ARENA_MODES.find((item) => item.id === mode)
  const style = ROOM_STYLE[mode]
  const Icon = style.icon
  const user = useUser()
  const stats = useStats()
  const opponent = readOpponent(useLocation().state)
  const rank = opponent ? getRankInfo(opponent.xp) : null

  if (!info) return null

  return (
    <div className="space-y-5 py-2">
      <Link
        to="/arena"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-500 transition-colors hover:text-neon-cyan"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回竞技场
      </Link>

      <section className="neon-frame">
        <div className="glass relative overflow-hidden rounded-2xl p-5 sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-neon-violet/20 blur-3xl"
          />

          <div className="relative flex flex-wrap items-center gap-3">
            <span
              className={cn(
                'grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/15',
                style.tile,
              )}
            >
              <Icon className={cn('h-6 w-6', style.text)} />
            </span>
            <div className="min-w-0">
              <h1 className={cn('text-2xl font-black leading-tight text-glow sm:text-3xl', style.text)}>
                {info.name}
              </h1>
              <p className="mt-1 text-sm text-slate-400">{info.tagline}</p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 font-mono text-[11px] text-slate-300 ring-1 ring-white/10">
              <Users className="h-3.5 w-3.5 text-neon-lime" />
              {POOL_ONLINE} 人在线
            </span>
          </div>

          <p className="relative mt-4 max-w-lg text-sm leading-relaxed text-slate-300">{info.rule}</p>

          {/* 双方席位：段位色由累计 XP 折算，和顶栏、排行榜同一套 */}
          <div className="relative mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-ink-950/50 px-5 py-6 ring-1 ring-white/10">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <PlayerAvatar name={user.nickname} xp={stats.xp} size="h-14 w-14 text-base" />
              <span className="truncate font-mono text-[10px] text-slate-500">
                {user.nickname} · Lv.{levelOf(stats.xp)}
              </span>
            </div>
            <span className="font-mono text-xl font-black text-neon-pink text-glow">VS</span>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              {opponent && rank ? (
                <>
                  <PlayerAvatar name={opponent.player} xp={opponent.xp} size="h-14 w-14 text-base" />
                  <span className="truncate font-mono text-[10px]">
                    <span className="font-bold" style={{ color: rank.color, textShadow: `0 0 10px ${withAlpha(rank.color, '66')}` }}>
                      {rank.name}
                    </span>
                    <span className="text-slate-500"> · Lv.{levelOf(opponent.xp)}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-white/20 text-2xl font-black text-slate-600">
                    ?
                  </span>
                  <span className="font-mono text-[10px] text-slate-600">对手还没进来</span>
                </>
              )}
            </div>
          </div>

          <div className="relative mt-4 flex items-start gap-3 rounded-2xl border border-neon-amber/25 bg-neon-amber/5 p-4">
            <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-neon-amber" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-neon-amber">对战房间还在开发中</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                匹配、对手和段位这条链路已经通了，缺的是房间里的玩法本身：
                {mode === 'golf'
                  ? '行数计数器和逐行对比的实时进度条。'
                  : '迷宫地图、角色走位和撞墙计数。'}
                现在进来只能先看席位，等判题沙箱接上这里就能真打。
              </p>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-3">
            <Link
              to="/arena"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet text-sm font-bold text-ink-950 shadow-glow transition-all hover:brightness-110 active:scale-[0.98] sm:flex-none sm:px-8"
            >
              <Swords className="h-4 w-4" />
              再匹配一场
            </Link>
            <Link
              to="/challenge"
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 text-sm font-semibold text-slate-300 transition-colors hover:border-neon-cyan/40 hover:text-neon-cyan sm:flex-none"
            >
              去挑战页练手
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
