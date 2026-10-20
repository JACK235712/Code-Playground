import { useEffect, useState } from 'react'

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 打一段字：文本一变就重新从第一个字数起，只返回露出来的那一截。
 * 「管家正在说话」的氛围全靠它，所以关掉动效偏好时要直接给全文而不是闪一下。
 */
export function useTypewriter(text: string, speed = 28) {
  const [count, setCount] = useState(() => (reducedMotion() ? text.length : 0))

  useEffect(() => {
    if (reducedMotion() || speed <= 0) {
      setCount(text.length)
      return
    }
    setCount(0)
    /**
     * 露出多少字按「过了多久」算，不是按「跳了多少次」数：
     * 后台标签页里 setInterval 会被压到每秒一次，数次数会让管家越说越慢，
     * 而切回来时应该一眼看到他已经说完了。
     */
    const startedAt = Date.now()
    const id = window.setInterval(() => {
      const shown = Math.min(Math.floor((Date.now() - startedAt) / speed) + 1, text.length)
      setCount(shown)
      if (shown >= text.length) window.clearInterval(id)
    }, speed)
    return () => window.clearInterval(id)
  }, [text, speed])

  return { typed: text.slice(0, count), done: count >= text.length }
}
