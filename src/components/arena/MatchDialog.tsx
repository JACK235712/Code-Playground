import { useEffect } from 'react'
import { Check, Loader2, Swords, Trophy, X } from 'lucide-react'
import { ARENA_MODES, MODE_SEARCH_LINES, POOL_ONLINE } from '../../data/arena'
import type { ModeId, Opponent } from '../../data/arena'
import { ghostCharMs, ghostSpeedLabel } from '../../data/ghost'
import { getRankInfo, levelOf, withAlpha } from '../../data/ranks'
import { useUser, useStats } from '../../context/AuthContext'
import { MATCH_TOTAL_MS } from '../../hooks/useMatchmaking'
import type { Matchmaking } from '../../hooks/useMatchmaking'
import { PlayerAvatar } from '../PlayerAvatar'

/** 段位牌：颜色和「你是什么段位」永远由 getRankInfo 单点折算，不跟别处对不上 */
function RankChip({ xp }: { xp: number }) {
  const rank = getRankInfo(xp)
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold ring-1"
      style={{
        color: rank.color,
        backgroundColor: withAlpha(rank.color, '14'),
        borderColor: withAlpha(rank.color, '59'),
        textShadow: `0 0 10px ${withAlpha(rank.color, '66')}`,
      }}
    >
      {rank.name}
    </span>
  )
}

function Radar() {
  return (
    <div className="relative mx-auto grid h-36 w-36 place-items-center">
      <span className="absolute inset-0 rounded-full border border-neon-cyan/20" />
      <span className="absolute inset-5 rounded-full border border-neon-cyan/25" />
      <span className="absolute inset-10 rounded-full border border-neon-cyan/30" />
      <span
        className="animate-spin absolute inset-0 rounded-full border-2 border-dashed border-neon-cyan/50"
        style={{ animationDuration: '4s' }}
      />
      <span className="absolute inset-0 rounded-full bg-neon-cyan/5 blur-xl" />
      <Swords className="h-9 w-9 text-neon-cyan" />
    </div>
  )
}

/**
 * 匹配弹窗的两态：searching 放雷达、进度条和已等待秒数；found 换成对手名片 + 进入对战。
 *
 * 这一层只负责「把人找到并让你看清」，对战舱是下一页的事，所以「进入对战」把对手交出去
 * （onEnter，由大厅 navigate 到 /arena/battle 并带上这个对手）——弹窗里看清了是谁，
 * 舱里打字的就是谁，两段之间不会换人。
 */
export function MatchDialog({
  match,
  onEnter,
}: {
  match: Matchmaking
  onEnter: (mode: ModeId, opponent: Opponent) => void
}) {
  const user = useUser()
  const stats = useStats()
  const { stage, mode, elapsed, opponent, cancel } = match
  const searching = stage === 'searching'
  const modeName = ARENA_MODES.find((item) => item.id === mode)?.name ?? ''

  /* Esc 和点遮罩都能收掉弹窗——这一屏还没写过任何代码，关掉不心疼 */
  useEffect(() => {
    if (stage === 'idle') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [stage, cancel])

  if (stage === 'idle') return null

  const seconds = Math.min(Math.floor(elapsed / 1000), 3)
  const lines = MODE_SEARCH_LINES[mode]
  const line = lines[Math.min(seconds, lines.length - 1)]
  const mine = getRankInfo(stats.xp)
  const theirs = opponent ? getRankInfo(opponent.xp) : null
  const gap = theirs ? theirs.index - mine.index : 0
  const gapLabel = gap === 0 ? '和你同段位' : gap > 0 ? `比你高 ${gap} 段` : `比你低 ${-gap} 段`

  return (
    <div
      role="presentation"
      onClick={cancel}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-950/85 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={searching ? `正在匹配${modeName}对手` : '匹配成功'}
        onClick={(event) => event.stopPropagation()}
        className="neon-frame w-full max-w-sm"
      >
        <div className="glass relative max-h-[calc(100dvh-2.5rem)] overflow-y-auto rounded-2xl p-6">
          <button
            type="button"
            onClick={cancel}
            aria-label="关闭匹配窗口"
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>

          {searching ? (
            <>
              <Radar />
              <p className="mt-5 text-center text-base font-bold text-neon-cyan text-glow">{line}</p>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-[width] duration-75 ease-linear"
                  style={{ width: `${Math.min((elapsed / MATCH_TOTAL_MS) * 100, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-center font-mono text-[11px] text-slate-500">
                已等待 {(elapsed / 1000).toFixed(1)} 秒 · 池内 {POOL_ONLINE} 人 · {modeName}
              </p>
              <button
                type="button"
                onClick={cancel}
                className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-300 transition-colors hover:border-neon-pink/40 hover:text-neon-pink"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                取消匹配
              </button>
            </>
          ) : opponent && theirs ? (
            <>
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-neon-lime">
                <Trophy className="h-4 w-4" />
                匹配成功！
              </p>
              <p className="mt-1 text-center font-mono text-[10px] text-slate-500">玩法 · {modeName}</p>

              <div className="mt-5 flex items-center justify-center gap-3">
                <PlayerAvatar name={user.nickname} xp={stats.xp} size="h-12 w-12 text-sm" />
                <span className="font-mono text-lg font-black text-neon-pink text-glow">VS</span>
                <PlayerAvatar name={opponent.player} xp={opponent.xp} size="h-12 w-12 text-sm" />
              </div>

              {/* 需求点名的那行：段位 + 名字，例如「白银 Ctrl_Alt_Dog」 */}
              <p className="mt-4 flex items-center justify-center gap-2 text-base font-bold">
                <RankChip xp={opponent.xp} />
                <span className="min-w-0 truncate text-neon-cyan">{opponent.player}</span>
                <span className="font-mono text-sm text-slate-400">Lv.{levelOf(opponent.xp)}</span>
              </p>
              <p className="mt-1 text-center font-mono text-[11px] text-slate-500">
                当前 {opponent.streak} 连胜 · 手速 {ghostSpeedLabel(opponent.xp).replace('手速 · ', '')}（每字 {ghostCharMs(opponent.xp)}ms）
              </p>
              {/* 把 ±1 规则写在脸上：学生能核对系统确实按段位找的人 */}
              <p className="mt-1 text-center font-mono text-[10px] text-slate-600">
                你是 <span style={{ color: mine.color }}>{mine.name}</span> · 对手{gapLabel}
              </p>

              <button
                type="button"
                autoFocus
                onClick={() => onEnter(mode, opponent)}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-violet text-base font-bold text-ink-950 shadow-glow transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Check className="h-5 w-5" />
                进入对战
              </button>
              <button
                type="button"
                onClick={cancel}
                className="mt-2 h-9 w-full text-xs font-semibold text-slate-500 transition-colors hover:text-slate-300"
              >
                先不了
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
