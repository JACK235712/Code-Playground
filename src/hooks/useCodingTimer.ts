import { useEffect, useRef } from 'react'

/**
 * 编码计时心跳：编辑器真的在被用的时候（active）每 30 秒记一笔。
 *
 * 记的是墙上时钟的增量而不是「一定过了 30 秒」——后台标签页的定时器会被浏览器拖到一秒一次，
 * 要是每个 tick 硬写 30，挂机一晚上就能凭空多出好几个小时。
 * 切走标签页那段时间直接作废，从回到前台这一刻重新起算；编辑器失焦就整个停表。
 */
const TICK_MS = 30_000

export function useCodingTimer(active: boolean, onSeconds: (seconds: number) => void) {
  const sink = useRef(onSeconds)

  useEffect(() => {
    sink.current = onSeconds
  }, [onSeconds])

  useEffect(() => {
    if (!active) return
    let mark = Date.now()
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        mark = Date.now()
        return
      }
      const seconds = Math.floor((Date.now() - mark) / 1000)
      mark = Date.now()
      if (seconds > 0) sink.current(seconds)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [active])
}
