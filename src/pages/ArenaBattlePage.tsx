import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GhostBattle } from '../components/arena/GhostBattle'
import type { ModeId, Opponent } from '../data/arena'
import type { Battle } from '../data/ghost'
import { createBattle, makeBattle } from '../data/ghost'
import { getRankInfo } from '../data/ranks'
import { useStats } from '../context/AuthContext'

/** 大厅带过来的玩法；直接输网址或刷新就没有，退回 1v1 竞速那个默认玩法 */
function readMode(state: unknown): ModeId {
  const mode = (state as { mode?: ModeId } | null)?.mode
  return mode === 'golf' || mode === 'maze' ? mode : 'debug'
}

/**
 * 匹配弹窗递过来的对手。location.state 是外部能伪造的东西（手输 URL、旧书签），
 * 所以逐字段验一遍：形状不对就当作没带，当场摇一个，别把 undefined 送进对战舱。
 */
function readOpponent(state: unknown): Opponent | null {
  const raw = (state as { opponent?: unknown } | null)?.opponent
  if (!raw || typeof raw !== 'object') return null
  const { player, xp, streak } = raw as { player?: unknown; xp?: unknown; streak?: unknown }
  if (typeof player !== 'string' || !player.trim()) return null
  if (typeof xp !== 'number' || !Number.isFinite(xp) || xp < 0) return null
  return { player: player.trim(), xp: Math.floor(xp), streak: typeof streak === 'number' ? Math.floor(streak) : 0 }
}

/**
 * /arena/battle：对战舱的独立全屏路由，在 AppShell 外面，没顶栏也没 Dock。
 * 大厅匹配成功后带着刚摇到的对手跳进来，右上角「退出对战舱」navigate('/arena') 回大厅。
 * 直接输网址或刷新时 state 是空的，就按 ±1 段位规则当场重新摇一个，这页永远能开打。
 */
export default function ArenaBattlePage() {
  const navigate = useNavigate()
  const stats = useStats()
  const state = useLocation().state
  const mode = readMode(state)
  const opponent = readOpponent(state)
  /** 只算一次：打到一半 XP 因为别的原因变了，也不能把对手和题目换掉 */
  const [battle] = useState<Battle>(() =>
    opponent ? createBattle(mode, opponent) : makeBattle(mode, getRankInfo(stats.xp).index),
  )

  return (
    <div className="h-dvh bg-ink-950">
      <GhostBattle battle={battle} onClose={() => navigate('/arena')} />
    </div>
  )
}
