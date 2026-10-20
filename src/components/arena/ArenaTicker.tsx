import { useEffect, useMemo, useState } from 'react'
import { Radio } from 'lucide-react'
import { reportsOf } from '../../data/arenaHost'
import { useStats } from '../../context/AuthContext'
import { Typed } from '../Typed'

/** 一条战报读完再换下一条：打字机自己要走两秒左右，间隔留出余量 */
const DWELL_MS = 5200

/**
 * AI 实时战报：一次只播一条，播完往下换。
 * 内容全部来自 reportsOf(stats)——榜上的名字、段位、自己上一场的结果都是真数据，
 * 不是滚动的假字幕；打完全场回来，这里会出现你自己那条。
 */
export function ArenaTicker() {
  const stats = useStats()
  const lines = useMemo(() => reportsOf(stats), [stats])
  const [index, setIndex] = useState(0)

  // 战绩一变（比如刚打完一场），从头重播而不是停在原来那条
  useEffect(() => setIndex(0), [lines])

  useEffect(() => {
    if (lines.length < 2) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % lines.length), DWELL_MS)
    return () => window.clearInterval(id)
  }, [lines])

  const line = lines[index % lines.length]

  return (
    <section className="neon-frame">
      <div className="glass relative overflow-hidden rounded-2xl p-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full bg-neon-pink/15 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <span className="relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-neon-pink/15 ring-1 ring-neon-pink/30">
            <Radio className="h-4 w-4 text-neon-pink" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-neon-lime" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
              深度战术分析 · 全服
            </p>
            {/* 轮换的字幕对读屏是噪音，所以视觉层保持 aria-hidden，完整战报另给一份 sr-only */}
            <p className="mt-1.5 text-sm leading-relaxed text-slate-200" aria-hidden="true">
              <Typed key={line} text={line} speed={22} caret="bg-neon-pink" />
            </p>
            <ul className="sr-only">
              {lines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <span className="mt-1 flex shrink-0 gap-1" aria-hidden="true">
            {lines.map((item, i) => (
              <span
                key={item}
                className={
                  i === index % lines.length
                    ? 'h-1.5 w-4 rounded-full bg-neon-pink'
                    : 'h-1.5 w-1.5 rounded-full bg-white/15'
                }
              />
            ))}
          </span>
        </div>
      </div>
    </section>
  )
}
