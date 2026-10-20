import { useEffect, useRef } from 'react'
import type { ChatMsg } from '../../hooks/useMentorChat'
import { cn } from '../../lib/cn'

export function ChatLog({
  msgs,
  thinking,
  streaming,
  className,
}: {
  msgs: ChatMsg[]
  /** 请求发出、第一个字还没来 */
  thinking: boolean
  /** 正在吐字 */
  streaming: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, thinking, streaming])

  return (
    <div ref={ref} className={cn('min-h-0 flex-1 space-y-3 overflow-y-auto', className)}>
      {msgs.map((m, i) =>
        m.text ? (
          <div key={i} className={cn('flex', m.role === 'me' ? 'justify-end' : 'justify-start')}>
            <p
              className={cn(
                'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                m.role === 'me'
                  ? 'bg-gradient-to-br from-neon-cyan/25 to-neon-blue/15 text-slate-100 ring-1 ring-neon-cyan/30'
                  : 'bg-white/5 text-slate-200 ring-1 ring-white/10',
              )}
            >
              {m.text}
              {/* 打字机尾巴：还在冒字就挂一个光标，学生知道它没说完 */}
              {streaming && i === msgs.length - 1 && (
                <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse text-neon-cyan">
                  ▍
                </span>
              )}
            </p>
          </div>
        ) : null,
      )}

      {thinking && (
        <div className="flex items-center gap-2 px-1" role="status" aria-live="polite">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-neon-violet"
                style={{ animationDelay: `${d * 120}ms` }}
              />
            ))}
          </span>
          <span className="font-mono text-[11px] text-neon-violet">正在思考…</span>
        </div>
      )}
    </div>
  )
}
