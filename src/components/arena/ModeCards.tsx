import { Bug, Flag, Route, Swords } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ARENA_MODES } from '../../data/arena'
import type { ModeId } from '../../data/arena'
import { cn } from '../../lib/cn'

const MODE_STYLE: Record<
  ModeId,
  { icon: LucideIcon; tile: string; text: string; play: string; glow: string }
> = {
  debug: {
    icon: Bug,
    tile: 'from-neon-pink/30 to-neon-violet/10',
    text: 'text-neon-pink',
    play: 'border-neon-pink/50 text-neon-pink hover:bg-neon-pink hover:text-ink-950',
    glow: 'hover:shadow-glow-violet',
  },
  golf: {
    icon: Flag,
    tile: 'from-neon-lime/30 to-neon-cyan/10',
    text: 'text-neon-lime',
    play: 'border-neon-lime/50 text-neon-lime hover:bg-neon-lime hover:text-ink-950',
    glow: 'hover:shadow-glow',
  },
  maze: {
    icon: Route,
    tile: 'from-neon-violet/30 to-neon-blue/10',
    text: 'text-neon-violet',
    play: 'border-neon-violet/50 text-neon-violet hover:bg-neon-violet hover:text-ink-950',
    glow: 'hover:shadow-glow-violet',
  },
}

export function ModeCards({ onPlay, busy }: { onPlay: (mode: ModeId) => void; busy: boolean }) {
  return (
    <section className="flex h-full flex-col">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Swords className="h-4 w-4 text-neon-pink" />
          竞速玩法
        </h2>
        <p className="font-mono text-[10px] text-slate-500">换个玩法，匹配到的对手就按这个规则打</p>
      </header>

      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ARENA_MODES.map((mode) => {
          const style = MODE_STYLE[mode.id]
          const Icon = style.icon
          return (
            <article
              key={mode.id}
              className={cn(
                'glass flex flex-col gap-3 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1',
                mode.live ? style.glow : 'opacity-90',
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-white/15',
                    style.tile,
                  )}
                >
                  <Icon className={cn('h-5 w-5', style.text)} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold">{mode.name}</h3>
                  <p className="mt-0.5 text-xs leading-snug text-slate-300">{mode.tagline}</p>
                </div>
              </div>

              <p className="flex-1 text-[11px] leading-relaxed text-slate-500">{mode.rule}</p>

              <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                <span className="truncate font-mono text-[10px] text-slate-600">{mode.players}</span>
                {mode.live ? (
                  <button
                    type="button"
                    onClick={() => onPlay(mode.id)}
                    className={cn(
                      'h-8 shrink-0 rounded-lg border bg-white/5 px-3 text-xs font-bold transition-all active:scale-95',
                      busy ? 'border-white/10 text-slate-500' : style.play,
                    )}
                  >
                    立即体验
                  </button>
                ) : (
                  <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] text-slate-500">
                    敬请期待
                  </span>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
