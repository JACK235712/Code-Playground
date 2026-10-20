import { Bot } from 'lucide-react'
import type { ButlerState } from '../../lib/codeWatch'
import { cn } from '../../lib/cn'

/**
 * 状态球的四种样子：呼吸频率本身就是信息——
 * 待机慢、观察快、诊断最快，学生不用读字也能感觉到「它在动」。
 */
const LOOK: Record<
  ButlerState,
  { label: string; face: string; halo: string; beat: number; ping: boolean }
> = {
  idle: {
    label: '小游待命',
    face: 'from-neon-cyan to-neon-blue',
    halo: '45 226 230',
    beat: 2.6,
    ping: false,
  },
  observing: {
    label: '正在观察',
    face: 'from-neon-violet to-neon-cyan',
    halo: '155 92 255',
    beat: 1.4,
    ping: true,
  },
  diagnosing: {
    label: '正在诊断',
    face: 'from-neon-pink to-neon-amber',
    halo: '255 92 168',
    beat: 0.7,
    ping: true,
  },
  reviewing: {
    label: '正在评审',
    face: 'from-neon-lime to-neon-cyan',
    halo: '166 255 87',
    beat: 1.1,
    ping: true,
  },
}

export function ButlerOrb({
  state,
  hint,
  onPoke,
}: {
  state: ButlerState
  /** 状态球旁边那句说明，没有提示时显示事实数字 */
  hint: string
  onPoke: () => void
}) {
  const look = LOOK[state]
  const glow = `rgb(${look.halo} / 0.6)`

  return (
    <button
      type="button"
      onClick={onPoke}
      title="点我，让小游开口"
      aria-label={`导师状态：${look.label}。${hint}`}
      className={cn(
        'pointer-events-auto absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-full',
        'border border-white/10 bg-ink-950/80 py-1.5 pl-1.5 pr-3 backdrop-blur-md',
        'transition-all duration-300 hover:border-white/25 hover:bg-ink-900/90 active:scale-[0.97]',
      )}
    >
      <span className="relative grid h-7 w-7 shrink-0 place-items-center">
        {look.ping && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-60"
            style={{ background: `rgb(${look.halo} / 0.35)` }}
          />
        )}
        <span
          className={cn(
            'relative grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br ring-1 ring-white/25',
            look.face,
          )}
          style={{
            animation: `orb-breathe ${look.beat}s ease-in-out infinite`,
            boxShadow: `0 0 14px -2px ${glow}`,
          }}
        >
          <Bot className="h-4 w-4 text-ink-950" />
        </span>
      </span>

      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{ color: glow }}
        >
          {look.label}
        </span>
        <span className="max-w-[150px] truncate text-[10px] text-slate-400">{hint}</span>
      </span>
    </button>
  )
}
