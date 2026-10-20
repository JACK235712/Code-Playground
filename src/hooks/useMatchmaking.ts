import { useCallback, useEffect, useRef, useState } from 'react'
import { rollOpponent } from '../data/arena'
import type { ModeId, Opponent } from '../data/arena'
import { getRankInfo } from '../data/ranks'
import { useStats } from '../context/AuthContext'

/** 匹配耗时：演示用的 3 秒，接真实服务后由服务端推 WS 事件取代 */
export const MATCH_TOTAL_MS = 3000
const TICK_MS = 50

export type MatchStage = 'idle' | 'searching' | 'found'

/**
 * 1v1 匹配的状态机：idle → searching（雷达 + 进度条 + 已等待秒数）→ found（拿到对手）。
 * 计时读的是墙上时钟而不是「tick 数 × 间隔」：页面切到后台时浏览器会把 interval 节流到 1 秒一次，
 * 按 tick 累加会让进度慢二十倍，学生切走标签页再切回来就对不上。
 *
 * mode 记的是「这一场是从哪个入口发起的」：弹窗文案按玩法换，抽题范围也按它收窄。
 * 对手按当前登录账号的段位 ±1 抽，三个入口共用同一条规则。
 * found 之后由弹窗上的「进入对战」把 opponent 交给对战舱，整个流程不出 /arena 这一屏。
 */
export function useMatchmaking() {
  const stats = useStats()
  const [stage, setStage] = useState<MatchStage>('idle')
  const [mode, setMode] = useState<ModeId>('debug')
  const [elapsed, setElapsed] = useState(0)
  const [opponent, setOpponent] = useState<Opponent | null>(null)
  const startedAt = useRef(0)
  const timers = useRef<number[]>([])

  const clear = useCallback(() => {
    for (const id of timers.current) {
      window.clearInterval(id)
      window.clearTimeout(id)
    }
    timers.current = []
  }, [])

  const start = useCallback(
    (next: ModeId) => {
      clear()
      setMode(next)
      startedAt.current = Date.now()
      setStage('searching')
      setElapsed(0)
      timers.current.push(
        window.setInterval(() => setElapsed(Date.now() - startedAt.current), TICK_MS),
      )
      timers.current.push(
        window.setTimeout(() => {
          clear()
          setElapsed(MATCH_TOTAL_MS)
          setOpponent(rollOpponent(getRankInfo(stats.xp).index))
          setStage('found')
        }, MATCH_TOTAL_MS),
      )
    },
    [clear, stats.xp],
  )

  const cancel = useCallback(() => {
    clear()
    setStage('idle')
    setElapsed(0)
  }, [clear])

  useEffect(() => clear, [clear])

  return { stage, mode, elapsed, opponent, start, cancel }
}

export type Matchmaking = ReturnType<typeof useMatchmaking>
