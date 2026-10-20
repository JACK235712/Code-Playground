import { useState } from 'react'
import { Coins, Pencil, ShieldHalf, Sparkles } from 'lucide-react'
import { useUser, useStats } from '../../context/AuthContext'
import { getRankInfo, levelOf, rankGradient, withAlpha } from '../../data/ranks'
import { earnedBadgeCount } from '../../data/stats'
import { cn } from '../../lib/cn'

const HALO = 'conic-gradient(from 0deg, #2DE2E6, #9B5CFF, #FF5CA8, #FFC94D, #2DE2E6)'

/** 段位色压进墨底时最容易被吃掉，所以发光一律用双层阴影：近处实、远处散 */
function rankGlow(color: string, blur = 18) {
  return `0 0 ${blur}px ${withAlpha(color, '80')}, 0 0 ${blur * 2.4}px ${withAlpha(color, '40')}`
}

export function PlayerCard({ className }: { className?: string }) {
  const user = useUser()
  const stats = useStats()
  const [hint, setHint] = useState(false)
  const rank = getRankInfo(stats.xp)
  const level = levelOf(stats.xp)
  const earned = earnedBadgeCount(stats)

  return (
    <section className={cn('neon-frame', className)}>
      <div className="glass relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl"
          style={{ backgroundColor: withAlpha(rank.color, '2E') }}
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          {/* 赛博朋克光环：一层旋转的 conic 渐变压在墨底上，中心才是头像 */}
          <div className="relative h-28 w-28 shrink-0">
            <span
              aria-hidden="true"
              className="animate-spin absolute -inset-1 rounded-full opacity-80 blur-[1px]"
              style={{ background: HALO, animationDuration: '7s' }}
            />
            <span className="absolute inset-0 rounded-full bg-ink-900" />
            <span
              className="absolute inset-2 grid place-items-center rounded-full text-3xl font-black text-ink-950 ring-2 ring-white/25"
              style={{ backgroundImage: rankGradient(rank) }}
            >
              {user.nickname.slice(0, 2)}
            </span>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-ink-950/90 px-2.5 py-0.5 font-mono text-[10px] font-bold text-neon-cyan ring-1 ring-neon-cyan/40">
              Lv.{level}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black leading-tight">{user.nickname}</h1>
              {user.guest && (
                <span className="rounded-full bg-neon-pink/10 px-2 py-0.5 font-mono text-[10px] font-bold text-neon-pink ring-1 ring-neon-pink/30">
                  游客体验中
                </span>
              )}
            </div>

            {/* 巨大的段位字：颜色由 getRankInfo 给，发光跟着主题色走 */}
            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span
                className="text-4xl font-black leading-none tracking-tight sm:text-5xl"
                style={{ color: rank.color, textShadow: rankGlow(rank.color) }}
              >
                <ShieldHalf className="mr-1.5 inline-block h-7 w-7 align-[-3px] sm:h-8 sm:w-8" />
                {rank.name}
              </span>
              <span
                className="pb-0.5 font-mono text-[11px] font-semibold"
                style={{ color: withAlpha(rank.color, 'B3') }}
              >
                {rank.title}
              </span>
            </div>

            <p className="mt-2 font-mono text-[11px] text-slate-500">
              {user.handle} · {stats.guild} · 注册于 {user.joined}
            </p>

            {/* 进度条读的是「本段位内」的百分比，王者则整条流光并标注已满级 */}
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="truncate text-slate-400">
                  {rank.isMax ? (
                    <>
                      累计 <b style={{ color: rank.color }}>{stats.xp.toLocaleString()} XP</b> · 已达封顶段位
                    </>
                  ) : (
                    <>
                      距{rank.next?.name}还需 <b style={{ color: rank.color }}>{rank.remain} XP</b>
                    </>
                  )}
                </span>
                <span className="shrink-0 text-slate-500">
                  {rank.isMax ? '已满级' : `${rank.pct}%`}
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/5">
                {rank.isMax ? (
                  <span
                    aria-hidden="true"
                    className="animate-rank-flow absolute inset-0"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${rank.color}, ${rank.colorTo}, ${rank.color}, ${rank.colorTo}, ${rank.color})`,
                      backgroundSize: '300% 100%',
                      boxShadow: `0 0 14px ${withAlpha(rank.color, '99')}`,
                    }}
                  />
                ) : (
                  <span
                    className="block h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${rank.pct}%`, backgroundImage: rankGradient(rank, 90) }}
                  />
                )}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600">
                <span>
                  {rank.name} {rank.minXp} XP
                </span>
                <span>{rank.next ? `${rank.next.name} ${rank.next.minXp} XP` : '本赛季封顶'}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full bg-neon-amber/10 px-3 py-1.5 font-mono text-xs font-bold text-neon-amber ring-1 ring-neon-amber/25">
                <Coins className="h-4 w-4" />
                {stats.coins.toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-neon-lime/10 px-3 py-1.5 font-mono text-xs font-bold text-neon-lime ring-1 ring-neon-lime/25">
                <Sparkles className="h-4 w-4" />
                {earned} 枚徽章
              </span>

              <button
                type="button"
                onClick={() => setHint((show) => !show)}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold transition-all active:scale-95',
                  hint
                    ? 'border-neon-cyan/50 text-neon-cyan'
                    : 'border-white/15 text-slate-300 hover:border-neon-cyan/50 hover:text-neon-cyan',
                )}
              >
                <Pencil className="h-4 w-4" />
                编辑资料
              </button>
            </div>

            {hint && (
              <p className="mt-2.5 font-mono text-[11px] text-slate-500">
                昵称跟着登录账号走，段位、金币和战绩都存在这个账号自己的档案里——换个账号登录，这里就是另一套数字。改资料本身还要等后端接口。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
