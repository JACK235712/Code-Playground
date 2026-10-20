import { useNavigate } from 'react-router-dom'
import { ArenaCoachCard } from '../components/arena/ArenaCoachCard'
import { ArenaLeaderboard } from '../components/arena/ArenaLeaderboard'
import { ArenaTicker } from '../components/arena/ArenaTicker'
import { MatchDialog } from '../components/arena/MatchDialog'
import { MatchHistory } from '../components/arena/MatchHistory'
import { MatchQueue } from '../components/arena/MatchQueue'
import { ModeCards } from '../components/arena/ModeCards'
import type { ModeId, Opponent } from '../data/arena'
import { useMatchmaking } from '../hooks/useMatchmaking'

/**
 * 竞技场大厅 = 匹配这一段全在这一屏里演完，进对战才换页：
 * ① 点「随机匹配对手」或任一「立即体验」→ 匹配中弹窗（雷达 + 进度条 + 已等待秒数）；
 * ② 三秒后同一只弹窗切成「匹配成功」，亮出对手段位与名字；
 * ③ 点「进入对战」→ 路由跳 /arena/battle，并把刚匹配到的这个对手一起递过去，
 *    舱里打字的就是弹窗里那位，不会进去又换人。
 * 退出走舱内右上角那颗按钮，navigate('/arena') 回到这屏，极客榜原样还在。
 */
export default function ArenaPage() {
  const navigate = useNavigate()
  const match = useMatchmaking()
  const busy = match.stage !== 'idle'

  /** 正在摇人时再点无效：别同时开两场匹配 */
  const play = (mode: ModeId) => {
    if (busy) return
    match.start(mode)
  }

  const enter = (mode: ModeId, opponent: Opponent) => {
    match.cancel()
    navigate('/arena/battle', { state: { mode, opponent } })
  }

  return (
    <div className="space-y-5 py-2">
      <ArenaCoachCard onPlay={play} />
      <MatchQueue onPlay={play} busy={busy} />
      <ArenaTicker />

      <div className="grid gap-5 lg:grid-cols-2">
        <ArenaLeaderboard />
        <ModeCards onPlay={play} busy={busy} />
      </div>

      <MatchHistory />

      <MatchDialog match={match} onEnter={enter} />
    </div>
  )
}
