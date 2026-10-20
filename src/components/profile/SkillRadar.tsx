import { Brain } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { useStats } from '../../context/AuthContext'
import { ANALYST_CALL_LABEL } from '../../data/analyst'
import { hasSkillData, radarOf } from '../../data/stats'
import { cn } from '../../lib/cn'

export function SkillRadar({ className }: { className?: string }) {
  const stats = useStats()
  const navigate = useNavigate()
  const skills = radarOf(stats)
  const scored = hasSkillData(stats)
  const total = skills.reduce((sum, item) => sum + item.score, 0)
  const avg = Math.round(total / skills.length)
  const strongest = skills.reduce((a, b) => (b.score > a.score ? b : a))
  const weakest = skills.reduce((a, b) => (b.score < a.score ? b : a))

  /**
   * 原来这一行是「综合 X · 最强 Y · 待练 Z」的静态文本，现在换成召唤按钮：
   * 同样这几个数字不再只是印在页上看，而是打包成 location.state 送进报告页，
   * 分析师拿它当「学生最关心哪一维」。
   */
  function summon() {
    navigate('/profile/report', {
      state: { from: 'radar', focus: weakest.axis, strongest: strongest.axis, avg, scored },
    })
  }

  return (
    <section className={cn('glass flex h-full flex-col rounded-2xl p-4 sm:p-5', className)}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Brain className="h-4 w-4 text-neon-violet" />
          能力雷达
        </h2>
        <span className="ml-auto rounded-full bg-neon-violet/10 px-2 py-1 font-mono text-[10px] text-neon-violet ring-1 ring-neon-violet/25">
          系统评分，基于你的近期表现
        </span>
      </header>
      <p className="mt-1 text-xs text-slate-500">
        按最近 20 次提交打分，满分 100——助教看的是你怎么写，不是写多快
      </p>

      <div className="mt-3 flex flex-1 flex-col gap-4 lg:flex-row lg:items-center">
        {/* 背景保持透明，网格线和顶点都走全站霓虹色 */}
        <div className="min-w-0 flex-1">
          <div className="h-60 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={skills} outerRadius="74%">
                <PolarGrid stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="axis"
                  tickLine={false}
                  tick={{ fill: '#8FA0C4', fontSize: 12, fontWeight: 700 }}
                />
                <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
                <Radar
                  dataKey="score"
                  stroke="#9B5CFF"
                  strokeWidth={2}
                  fill="#2DE2E6"
                  fillOpacity={0.2}
                  dot={{ r: 3, fill: '#2DE2E6', strokeWidth: 0 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <ul className="w-full shrink-0 space-y-2.5 lg:w-56">
          {skills.map((skill) => (
            <li key={skill.axis}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-300">{skill.axis}</span>
                <span className="font-mono font-bold tabular-nums text-neon-cyan">{skill.score}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet"
                  style={{ width: `${skill.score}%` }}
                />
              </div>
            </li>
          ))}

          <li className="border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={summon}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-neon-violet/40 bg-gradient-to-r from-neon-violet/15 via-neon-blue/10 to-neon-cyan/15 px-3 py-2.5 text-xs font-bold text-neon-violet transition-all hover:brightness-125 hover:shadow-glow active:scale-[0.98]"
            >
              {/* 扫描光带：一条竖向高光从左边扫到右边，关键帧在 index.css 的 agent-scan */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-neon-cyan/35 to-transparent"
                style={{ animation: 'agent-scan 2.8s linear infinite' }}
              />
              <span className="relative tracking-wide">{ANALYST_CALL_LABEL}</span>
            </button>
          </li>
        </ul>
      </div>
    </section>
  )
}
