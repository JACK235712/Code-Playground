import { Link } from 'react-router-dom'
import { Coins, LogOut } from 'lucide-react'
import { PlayerAvatar } from '../PlayerAvatar'
import { useAuth, useStats } from '../../context/AuthContext'
import { getRankInfo, levelOf, rankGradient, withAlpha } from '../../data/ranks'

/**
 * 全局状态栏：品牌在左，当前登录者的金币 / 头像 / 昵称 / 等级在右。
 * 身份和等级金币都来自这个账号自己的 userStats，退出按钮也在这里——四大页面共用一份。
 */
export function Header() {
  const { user, logout } = useAuth()
  const stats = useStats()
  if (!user) return null

  const rank = getRankInfo(stats.xp)
  const level = levelOf(stats.xp)

  return (
    <header className="pt-safe fixed inset-x-0 top-0 z-40">
      <div className="glass mx-auto flex h-14 w-full max-w-6xl items-center gap-2 border-x-0 border-t-0 px-3 md:rounded-b-2xl md:border-x md:px-5">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="relative shrink-0">
            <span className="bg-gradient-to-br from-neon-cyan to-neon-violet grid h-8 w-8 place-items-center rounded-lg font-mono text-sm font-bold text-ink-900 shadow-glow">
              CP
            </span>
            <span className="absolute inset-0 overflow-hidden rounded-lg">
              <span className="animate-sheen-x absolute inset-y-0 w-1/3 bg-white/25 blur-sm" />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-wide">
              代码<span className="text-neon-cyan text-glow">游乐场</span>
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 sm:block">
              Code Playground
            </span>
          </span>
        </Link>

        <div className="min-w-0 flex-1" />

        <div className="glass flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1">
          <Coins className="h-4 w-4 text-neon-amber" />
          <span className="font-mono text-xs font-semibold tabular-nums text-neon-amber">
            {stats.coins.toLocaleString()}
          </span>
        </div>

        <Link
          to="/profile"
          title="我的荣誉室"
          className="glass flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-all hover:border-neon-cyan/40 sm:pr-3"
        >
          <PlayerAvatar name={user.nickname} xp={stats.xp} size="h-7 w-7 text-[10px]" />
          <span className="min-w-0 max-w-[6.5rem] sm:max-w-[8rem]">
            <span className="block truncate text-[11px] font-bold leading-none">{user.nickname}</span>
            <span className="mt-1 flex items-center gap-1.5">
              <span className="font-mono text-[9px] font-semibold leading-none text-neon-cyan">
                Lv.{level}
              </span>
              <span
                className="flex min-w-0 items-center gap-1 text-[9px] font-bold leading-none"
                style={{ color: rank.color }}
              >
                {/* 段位发光圆点：颜色和段位文字同源，一眼就能认出现在是哪一段 */}
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: rank.color,
                    boxShadow: `0 0 6px ${withAlpha(rank.color, 'e6')}, 0 0 12px ${withAlpha(rank.color, '80')}`,
                  }}
                />
                <span className="truncate">{rank.name}</span>
              </span>
              <span className="hidden h-1 w-12 shrink-0 overflow-hidden rounded-full bg-white/10 sm:block">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${rank.pct}%`, backgroundImage: rankGradient(rank, 90) }}
                />
              </span>
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={logout}
          title="退出登录"
          aria-label="退出登录"
          className="glass grid h-9 shrink-0 place-items-center rounded-full text-slate-400 transition-all hover:text-rose-300 hover:ring-rose-400/40 active:scale-95 lg:flex lg:gap-1.5 lg:px-3"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden text-xs font-semibold lg:inline">退出</span>
        </button>
      </div>
    </header>
  )
}
