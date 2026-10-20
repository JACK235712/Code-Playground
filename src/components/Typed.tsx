import { useEffect, useRef } from 'react'
import { useTypewriter } from '../hooks/useTypewriter'

/**
 * 管家开口的那句话：一个字一个字冒出来，末尾拖一个霓虹光标，说完光标就收掉。
 * onDone 用来串起「这段说完才露下一段」的节奏。它只跟 done 走、用 ref 取最新的回调，
 * 否则父组件每次 re-render 都会换个箭头函数进来，效果被反复触发、下一段直接跳帧。
 */
export function Typed({
  text,
  speed = 28,
  className,
  caret = 'bg-neon-cyan',
  onDone,
}: {
  text: string
  speed?: number
  className?: string
  caret?: string
  onDone?: () => void
}) {
  const { typed, done } = useTypewriter(text, speed)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (done) doneRef.current?.()
  }, [done])

  return (
    <span className={className}>
      {/* 打字过程只给眼睛看，读屏拿到的是完整一句，不会一个词一个词地念 */}
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {typed}
        {!done && <span className={`ml-0.5 inline-block h-3.5 w-1.5 animate-pulse align-middle ${caret}`} />}
      </span>
    </span>
  )
}
