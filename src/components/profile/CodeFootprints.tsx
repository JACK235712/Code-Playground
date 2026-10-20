import { useMemo, useState } from 'react'
import { CalendarDays, Flame, Keyboard } from 'lucide-react'
import { useStats } from '../../context/AuthContext'
import { busiestOf, codeLinesOf, footprintOf, streakOf, WEEKDAY_LABELS } from '../../data/stats'
import type { FootprintCell } from '../../data/stats'
import { cn } from '../../lib/cn'

const SHADES = [
  'bg-white/[0.05] ring-1 ring-inset ring-white/10',
  'bg-neon-lime/20',
  'bg-neon-lime/40',
  'bg-neon-lime/65',
  'bg-neon-lime/90 shadow-[0_0_10px_rgba(166,255,87,0.45)]',
]

function formatDate(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/** 下标 0 是这一周的第一天（周一），只画「一 / 三 / 五」三个刻度，格子小才不挤 */
const WEEKDAY_TICKS = [0, 2, 4]

function Summary({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <b className={cn('font-mono text-xs font-bold tabular-nums', accent)}>{value}</b>
    </div>
  )
}

export function CodeFootprints() {
  const stats = useStats()
  const [active, setActive] = useState<FootprintCell | null>(null)

  const cells = useMemo(() => footprintOf(stats).flat(), [stats])
  const past = cells.filter((cell) => !cell.future)
  const lastPast = past[past.length - 1] ?? cells[0]
  const windowLines = past.reduce((sum, cell) => sum + cell.lines, 0)
  // 出勤按这段窗口数，别用全档案的天数——王者账号窗口外还有几十天老足迹
  const windowDays = past.filter((cell) => cell.lines > 0).length
  const totalLines = codeLinesOf(stats)
  const streak = streakOf(stats)
  const busiest = busiestOf(stats)
  const focused = active !== null && !active.future ? active : null

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <CalendarDays className="h-4 w-4 text-neon-lime" />
          代码足迹
        </h2>
        <span className="font-mono text-[10px] text-slate-500">
          {formatDate(cells[0].date)} – {formatDate(lastPast.date)}
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-neon-amber/10 px-2.5 py-1 font-mono text-[10px] font-bold text-neon-amber ring-1 ring-neon-amber/25">
          <Flame className="h-3 w-3" />
          {streak ? `连续 ${streak} 天` : '今天写一次就开卡'}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="flex gap-1.5">
          <div className="grid shrink-0 grid-rows-[repeat(7,minmax(0,1fr))] gap-1.5 text-[9px] leading-none text-slate-500">
            {WEEKDAY_LABELS.map((label, index) => (
              <span
                key={label}
                className={cn(
                  'flex h-8 items-center sm:h-9',
                  !WEEKDAY_TICKS.includes(index) && 'opacity-0',
                )}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-flow-col grid-rows-[repeat(7,minmax(0,1fr))] gap-1.5">
            {cells.map((cell) => (
              <button
                key={cell.date.toISOString()}
                type="button"
                disabled={cell.future}
                onMouseEnter={() => setActive(cell)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(cell)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(cell)}
                aria-label={
                  cell.future
                    ? `${formatDate(cell.date)} 还没到`
                    : `${formatDate(cell.date)} 写了 ${cell.lines} 行`
                }
                className={cn(
                  'h-8 w-8 rounded-[6px] transition-transform duration-150 sm:h-9 sm:w-9',
                  cell.future
                    ? 'cursor-default border border-dashed border-white/10 opacity-40'
                    : cn(SHADES[cell.level], 'hover:scale-110'),
                  focused && focused.date.getTime() === cell.date.getTime() && 'scale-110 ring-2 ring-white/70',
                )}
              />
            ))}
          </div>
        </div>

        <div className="min-w-[9.5rem] flex-1 space-y-2">
          <Summary
            label="出勤天数"
            value={`${windowDays} / ${past.length} 天`}
            accent="text-neon-cyan"
          />
          <Summary
            label="近 6 周手写"
            value={`${windowLines.toLocaleString()} 行`}
            accent="text-neon-lime"
          />
          <Summary
            label="最猛一天"
            value={busiest ? `${formatDate(busiest.date)} · ${busiest.lines} 行` : '还没有'}
            accent="text-neon-amber"
          />
          <span className="flex items-center gap-1.5 pt-1 font-mono text-[10px] text-slate-500">
            少
            {SHADES.map((shade) => (
              <span key={shade} className={cn('h-3 w-3 rounded-[3px]', shade)} aria-hidden />
            ))}
            多
          </span>
        </div>
      </div>

      <p className="mt-4 flex min-h-[1.25rem] flex-wrap items-center gap-1.5 border-t border-white/5 pt-3 font-mono text-[10px] text-slate-500">
        {focused ? (
          <>
            <b className="text-slate-200">{formatDate(focused.date)}</b>
            <span>手写</span>
            <b className="text-neon-lime">{focused.lines}</b>
            <span>行</span>
          </>
        ) : totalLines === 0 ? (
          <>
            <Keyboard className="h-3 w-3" />
            整片都是灰的——今天提交一次，就会点亮第一格。累计 {totalLines} 行。
          </>
        ) : (
          <>
            <Keyboard className="h-3 w-3" />
            悬浮或点一下格子看那天的行数——这里每一行都是手敲的，复制粘贴不会把格子点亮。
          </>
        )}
      </p>
    </section>
  )
}
