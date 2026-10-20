import { useCallback, useEffect, useRef, useState } from 'react'
import { useUser } from '../context/AuthContext'
import { clearDrawLog, drawBatch } from '../data/drawLog'
import type { Batch } from '../data/drawLog'
import { DIFFICULTY_LABEL } from '../data/problems'
import type { Problem } from '../data/problems'

/** 卡片翻出去要多久——超过这个时间才真的换数据，视觉上就是「先合上再翻开」 */
const FLIP_MS = 220

function noticeOf(batch: Batch): string | null {
  if (batch.resetTiers.length === 0) return null
  const names = batch.resetTiers.map((tier) => `「${DIFFICULTY_LABEL[tier]}」`).join('')
  return `${names}难度的题库已被你刷完啦，去竞技场练练手吧！（已自动重置本题池）`
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * 今日题池：抽题、恢复上一批、换一批的动画节奏都收在这里，
 * 页面只负责把 problems / notice / phase 画出来。
 */
export function useProblemBatch(pinned?: Problem) {
  const user = useUser()
  const [batch, setBatch] = useState(() => drawBatch(user.id, { pinnedId: pinned?.id }))
  const [selectedId, setSelectedId] = useState(() => pinned?.id ?? batch.problems[0].id)
  const [phase, setPhase] = useState<'idle' | 'out'>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const commit = useCallback(
    (opts: { pinnedId?: string; reshuffle?: boolean }) => {
      const next = drawBatch(user.id, opts)
      setBatch(next)
      setNotice(noticeOf(next))
      setSelectedId((current) =>
        next.problems.some((item) => item.id === current) ? current : next.problems[0].id,
      )
    },
    [user.id],
  )

  /** 首页带来的题：即使不在本批里，也要把它塞进题池并选中 */
  useEffect(() => {
    if (!pinned) return
    setSelectedId(pinned.id)
    setBatch((current) =>
      current.problems.some((item) => item.id === pinned.id)
        ? current
        : drawBatch(user.id, { pinnedId: pinned.id, reshuffle: true }),
    )
  }, [pinned, user.id])

  function refresh() {
    setPhase('out')
    window.clearTimeout(timer.current)
    const delay = prefersReducedMotion() ? 0 : FLIP_MS
    timer.current = window.setTimeout(() => {
      // 换一批不再锁定首页带来的题，纯按 2:2:1 重抽
      commit({ reshuffle: true })
      setPhase('idle')
    }, delay)
  }

  /** 手动清空抽取记录：把三个难度的「已抽过」一起归零，重新从最简单的开始 */
  function resetLog() {
    clearDrawLog(user.id)
    setPhase('out')
    window.clearTimeout(timer.current)
    const delay = prefersReducedMotion() ? 0 : FLIP_MS
    timer.current = window.setTimeout(() => {
      commit({})
      setPhase('idle')
    }, delay)
  }

  return {
    problems: batch.problems,
    left: batch.left,
    notice,
    phase,
    selectedId,
    dismissNotice: () => setNotice(null),
    pick: setSelectedId,
    refresh,
    resetLog,
  }
}
