/**
 * AI 数据分析师 · 训练报告页（模块二）。
 *
 * 这一页是智能体的「脑子对外那张脸」：读雷达和行为数据 → 打包给 glm-4-flash-250414
 * → 模型自己决定要不要调用 assign_training_task → 复盘 / 【AI 思考过程】逐字打印 / 总结
 * → 学生点任务卡片，才生成 activeTaskId 挂进挑战页。
 *
 * 点卡片这件事是「查重后再生成」：账本里已经有同一维度的 pending 卡时，
 * claimTask 不会写第二条，按钮也会提前变成「⏳ 继续完成该特训」并直接跳过去的那条路由。
 *
 * 三件事按需求写死，不接受顺手优化：
 *   并发锁——同一时刻只允许一个分析请求，按钮点下即禁用，请求结束（含失败）才恢复；
 *   打字机——思考过程每 30 毫秒露一个字，打完自动展开折叠面板；
 *   容错——lib/aiAnalyst 里所有失败都退成本地教练稿，这一页永远有东西可渲染。
 *
 * 追踪的「收尾」不在这页：进挑战页起表、点提交答案写回，见 ChallengePage 的埋点
 * 和 CodeEditorPane 里 execute() 那一段 try/catch。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Brain,
  ChevronDown,
  CircleAlert,
  Cpu,
  Loader2,
  Radar,
  Search,
  ShieldCheck,
  Target,
  Timer,
  Wrench,
} from 'lucide-react'
import { useStats, useUser } from '../context/AuthContext'
import { ANALYST_CALL_LABEL, ANALYST_STEPS, ANALYST_TITLE } from '../data/analyst'
import {
  activeTaskId,
  claimTask,
  clearActiveTaskId,
  formatElapsed,
  readTasks,
  startTask,
} from '../data/agentTasks'
import type { AgentTask } from '../data/agentTasks'
import { getRankInfo, levelOf } from '../data/ranks'
import { AI_CORE_LABEL } from '../lib/aiMentor'
import { buildBrief, requestAnalysis } from '../lib/aiAnalyst'
import type { AnalystOutput } from '../lib/aiAnalyst'
import { useTypewriter } from '../hooks/useTypewriter'
import { cn } from '../lib/cn'

type Phase = 'idle' | 'packing' | 'calling' | 'typing' | 'ready'

function liveIndexOf(phase: Phase): number {
  if (phase === 'packing') return 0
  if (phase === 'calling') return 1
  if (phase === 'typing') return 2
  return phase === 'ready' ? ANALYST_STEPS.length : -1
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * 雷达图那一跳带过来的东西。location.state 是外部可伪造的，所以逐字段验类型，
 * 只把它当「学生关心哪一维」的提示，正式画像仍旧从 userStats 现算。
 */
function readEntry(state: unknown): { focus: string | null } {
  const raw = (state as { focus?: unknown } | null)?.focus
  return { focus: typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 12) : null }
}

export default function AnalystReportPage() {
  const navigate = useNavigate()
  const user = useUser()
  const stats = useStats()
  const rank = getRankInfo(stats.xp)

  const location = useLocation()
  const entry = useMemo(() => readEntry(location.state), [location.state])
  const brief = useMemo(
    () =>
      buildBrief({
        nickname: user.nickname,
        rankName: rank.name,
        level: levelOf(stats.xp),
        stats,
        tasks: readTasks(user.id),
        focus: entry.focus,
      }),
    [user.id, user.nickname, stats, rank.name, entry.focus],
  )

  const [phase, setPhase] = useState<Phase>('idle')
  const [output, setOutput] = useState<AnalystOutput | null>(null)
  const [fallbackNote, setFallbackNote] = useState<string | null>(null)
  const [tasks, setTasks] = useState<AgentTask[]>(() => readTasks(user.id))
  const [tracking, setTracking] = useState<string | null>(() => activeTaskId(user.id))
  const [claimed, setClaimed] = useState<string | null>(null)
  const [openThinking, setOpenThinking] = useState(true)
  const [openSummary, setOpenSummary] = useState(false)

  /** 并发锁用 ref：state 要等一次渲染才生效，连点两下会在同一拍里都放行 */
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  /** 思考过程逐字 30ms；打完那一刻自动展开「总结」折叠面板 */
  const thinking = useTypewriter(output?.thinking ?? '', 30)
  useEffect(() => {
    if (!output || !thinking.done) return
    setOpenSummary(true)
    setPhase((prev) => (prev === 'typing' ? 'ready' : prev))
  }, [output, thinking.done])

  const summon = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setFallbackNote(null)
    setClaimed(null)
    setOutput(null)
    setOpenThinking(true)
    setOpenSummary(false)
    setPhase('packing')
    try {
      /** 让「读取数据」这一步亮半拍，不然管线灯会一闪而过看不出顺序 */
      await sleep(260)
      setPhase('calling')
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const result = await requestAnalysis(brief, { signal: ctrl.signal })
      setOutput(result)
      setPhase('typing')
    } catch (error) {
      // 走到这里说明接口层之外的地方炸了（比如浏览器把定时器掐了），页面不能留白
      setFallbackNote(
        `${error instanceof Error ? error.message : '分析器出了岔子'}。可以回「我的」页面再召唤一次。`,
      )
      setPhase('idle')
    } finally {
      runningRef.current = false
      abortRef.current = null
    }
  }, [brief])

  /**
   * 并发锁只认真正在飞的请求：打字机是本机播放，不该把按钮再锁二十秒。
   * runningRef 才是真锁，phase 只负责把这件事画出来。
   */
  const inflight = phase === 'packing' || phase === 'calling'

  /**
   * 这一维是否已经有一张还没练完的卡。只看 tasks 这份 state，不再读一次存储：
   * 它跟着 setTasks(readTasks()) 一起刷新，所以账本一改这里就跟着改。
   * 真正的拦截在 claimTask 里面做，这里只负责把按钮文案提前说对。
   */
  const pendingSame = useMemo(() => {
    if (!output) return null
    return tasks.find((task) => task.status === 'pending' && task.taskKey === output.plan.taskKey) ?? null
  }, [output, tasks])

  function claim() {
    if (!output) return
    /** 写入前查重在 claimTask 里：同 taskKey 的 pending 卡存在就不写新记录 */
    const { task, reused } = claimTask(user.id, {
      axis: output.plan.axis,
      goal: output.plan.goal,
      reason: output.plan.reason,
      minutes: output.plan.minutes,
      taskKey: output.plan.taskKey,
      target_route: output.plan.target_route,
      /** 难度只用来给这张卡配一道目标题，题号由数据层定，模型填不了 */
      difficulty: output.plan.difficulty,
    })
    setTasks(readTasks(user.id))
    setTracking(task.id)
    setClaimed(task.id)
    // 已经练过一半了就没必要再停在这页：直接接着上次那张卡走
    if (reused) navigate(task.target_route)
  }

  /**
   * 账本里那张 pending 卡上的「▶ 去完成」：只做两件事——
   * startTask 把这张卡的 activeTaskId 和它自带的 problemId 一起写进 LocalStorage，
   * 然后按卡片自带的 target_route 跳过去。
   * 这里一个字节都不碰 lib/aiAnalyst：不召唤分析师、不重新出卡，
   * 所以从账本进去永远不会又生成一条重复任务；起表仍由挑战页的 armActiveTask 负责。
   */
  function resume(task: AgentTask) {
    const started = startTask(user.id, task.id)
    setTracking(started ? started.id : task.id)
    setTasks(readTasks(user.id))
    navigate((started ?? task).target_route)
  }

  function release() {
    clearActiveTaskId(user.id)
    setTracking(null)
    setClaimed(null)
  }

  const live = liveIndexOf(phase)
  const typedTail = output ? thinking.typed : ''

  return (
    <div className="space-y-4 py-2">
      <header className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-cyan/20 ring-1 ring-white/10">
            <Brain className="h-4 w-4 text-neon-violet" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">{ANALYST_TITLE}</h1>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
              {AI_CORE_LABEL}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-400 ring-1 ring-white/10 sm:inline">
              {rank.name} Lv.{levelOf(stats.xp)}
            </span>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
            >
              回「我的」
            </button>
          </div>
        </div>

        {/* 打包清单：让学生先看见分析师读走了什么，再决定要不要花这次请求 */}
        <ul className="mt-3 flex flex-wrap gap-1.5">
          <Chip icon={<Radar className="h-3 w-3" />} text={`五维 ${brief.skills.map((s) => s.score).join(' / ')}`} />
          <Chip icon={<Activity className="h-3 w-3" />} text={`${brief.wins}胜${brief.losses}负 · 胜率 ${brief.winRate}%`} />
          <Chip icon={<Timer className="h-3 w-3" />} text={`连续打卡 ${brief.streak} 天`} />
          <Chip icon={<Target className="h-3 w-3" />} text={`通关 ${brief.cleared} 题 · ${brief.codeLines} 行`} />
          <Chip icon={<Wrench className="h-3 w-3" />} text={`历史任务 ${tasks.length} 条`} />
          {entry.focus && <Chip icon={<Search className="h-3 w-3" />} text={`关注 ${entry.focus}`} />}
        </ul>

        <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {ANALYST_STEPS.map((step, index) => {
            const state = index < live ? 'done' : index === live ? 'live' : 'wait'
            return (
              <li
                key={step.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2.5 py-2 font-mono text-[11px] ring-1 transition-colors',
                  state === 'done' && 'bg-neon-lime/10 text-neon-lime ring-neon-lime/25',
                  state === 'live' && 'bg-neon-cyan/10 text-neon-cyan ring-neon-cyan/30',
                  state === 'wait' && 'bg-white/5 text-slate-500 ring-white/10',
                )}
              >
                <span className="w-4 shrink-0 text-center">{state === 'done' ? '✔' : index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{step.label}</span>
                {state === 'live' && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
              </li>
            )
          })}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={summon}
            disabled={inflight}
            className="group relative flex h-10 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-neon-violet to-neon-blue px-5 text-sm font-bold text-ink-950 shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/25 blur-[6px]"
              style={{ animation: 'agent-scan 2.2s linear infinite' }}
            />
            <span className="relative flex items-center gap-2">
              {inflight ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {inflight ? '分析师正在推理…' : output ? '重新生成报告' : ANALYST_CALL_LABEL}
            </span>
          </button>
          {output && !inflight && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
              <ShieldCheck className="h-3 w-3 text-neon-lime" />
              一次只发一个请求，结束即可重新召唤
            </span>
          )}
        </div>

        {fallbackNote && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-neon-amber/10 p-3 text-xs leading-relaxed text-neon-amber ring-1 ring-neon-amber/25">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {fallbackNote}
          </p>
        )}
      </header>

      {output && (
        <section className="glass rounded-2xl p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Cpu className="h-4 w-4 text-neon-cyan" />
            复盘 · 历史记录
            <Chip
              className="ml-auto"
              icon={<Wrench className="h-3 w-3" />}
              text={output.toolCalled ? '中枢已下单任务卡' : '未走中枢 · 本地战术库补全'}
            />
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
            {output.recap || '（中枢这次没写复盘，直接进了推导）'}
          </p>
          {output.notice && (
            <p className="mt-3 rounded-xl bg-neon-amber/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-neon-amber ring-1 ring-neon-amber/25">
              {output.notice}
            </p>
          )}
        </section>
      )}

      {output && (
        <Collapse
          title="深度洞察与推导过程"
          subtitle={thinking.done ? '逐字输出已完成，可折叠' : `正在逐字输出 · 已露出 ${typedTail.length} 字`}
          open={openThinking}
          onToggle={() => setOpenThinking((prev) => !prev)}
          tone="violet"
        >
          <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-200">
            {typedTail}
            {!thinking.done && <span className="animate-pulse text-neon-violet">▍</span>}
          </p>
        </Collapse>
      )}

      {output && (
        <Collapse
          title="总结"
          subtitle={thinking.done ? '思考跑完自动展开' : '等思考过程打完自动展开'}
          open={openSummary}
          onToggle={() => setOpenSummary((prev) => !prev)}
          tone="cyan"
        >
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{output.summary}</p>
        </Collapse>
      )}

      {output && (
        <section className="neon-frame rounded-2xl">
          <div className="rounded-[calc(1rem-1px)] bg-ink-900/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-neon-lime">
                <Target className="h-4 w-4" />
                追踪任务卡 · {output.plan.axis}
              </h2>
              <span className="ml-auto flex flex-wrap gap-1.5">
                <Chip text={`${output.plan.minutes} 分钟`} />
                <Chip text={`难度 ${output.plan.difficulty}`} />
                <Chip text={output.plan.fromTool ? '中枢点的名' : '本地补的名'} />
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold leading-relaxed">{output.plan.goal}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">依据：{output.plan.reason}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={claim}
                className="flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-neon-lime to-neon-cyan px-4 text-sm font-bold text-ink-950 transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Target className="h-4 w-4" />
                {pendingSame ? '⏳ 继续完成该特训' : '点卡片领取追踪'}
              </button>
              {claimed && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(output.plan.target_route)}
                    className="flex h-9 items-center gap-2 rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 px-4 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/20"
                  >
                    去挑战页作答
                  </button>
                  <button
                    type="button"
                    onClick={release}
                    className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
                  >
                    取消追踪
                  </button>
                </>
              )}
            </div>

            <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-500">
              {pendingSame
                ? `这一维的特训${pendingSame.createdLabel ? `（${pendingSame.createdLabel}）` : ''}已经在账本里等你，点一下直接接着练，不会再存一条重复的。`
                : tracking
                  ? '账本里已经有一条特训正在进行。这张练的是另一维，领之后追踪会切到这张；回去点旧的那张随时能接着练。'
                  : '点一下卡片，这条特训就挂进挑战页开始计时；写完点「提交答案」，耗时和你写的代码会自动记进账本，不用你手写日志。'}
            </p>
          </div>
        </section>
      )}

      <section className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Activity className="h-4 w-4 text-neon-amber" />
            任务账本
          </h2>
          <span className="ml-auto font-mono text-[10px] text-slate-500">最多留 20 条 · 现在 {tasks.length} 条</span>
        </div>

        {tasks.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            还没有追踪记录。上面点一次「点卡片领取追踪」，这条账本就会开始攒你的耗时、判定结果和真实代码。
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={cn(
                  'rounded-xl px-3 py-2.5 ring-1',
                  task.status === 'completed'
                    ? 'bg-neon-lime/5 ring-neon-lime/20'
                    : 'bg-neon-amber/5 ring-neon-amber/25',
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 ring-1',
                      task.status === 'completed'
                        ? 'bg-neon-lime/10 text-neon-lime ring-neon-lime/30'
                        : 'bg-neon-amber/10 text-neon-amber ring-neon-amber/30',
                    )}
                  >
                    {task.status === 'completed' ? 'completed' : 'pending'}
                  </span>
                  <span className="text-slate-500">{task.createdLabel}</span>
                  <span className="text-slate-500">{task.axis}</span>
                  {task.attemptTitle && <span className="text-slate-500">《{task.attemptTitle}》</span>}
                  {task.id === tracking && (
                    <span className="rounded-full bg-neon-violet/10 px-2 py-0.5 text-neon-violet ring-1 ring-neon-violet/30">
                      正在追踪
                    </span>
                  )}
                  {/* 右侧靠 ml-auto 顶过去；窄屏上 flex-wrap 自然把它换行到卡片底部 */}
                  {task.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => resume(task)}
                      className="ml-auto flex h-7 shrink-0 items-center gap-1 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 text-[11px] font-bold text-neon-cyan shadow-glow transition-all hover:bg-neon-cyan/20 hover:brightness-125 active:scale-[0.97]"
                    >
                      ▶ 去完成
                    </button>
                  ) : (
                    <span className="ml-auto flex h-7 shrink-0 items-center rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11px] font-semibold text-slate-500">
                      已完成
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs font-semibold leading-relaxed">{task.goal}</p>
                {task.verdict && (
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-neon-cyan">判定：{task.verdict}</p>
                )}
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  耗时 {formatElapsed(task.elapsedMs) ?? '—'} · 预计 {task.minutes} 分钟
                  {task.failCount > 0 && ` · 已提交 ${task.failCount} 次没通过`}
                </p>
                {task.code && (
                  <details className="mt-2 rounded-lg bg-ink-950/60 px-2.5 py-2 ring-1 ring-white/10">
                    <summary className="cursor-pointer font-mono text-[10px] text-slate-400">
                      提交时抓走的代码（{task.code.split('\n').length} 行）
                    </summary>
                    <pre className="mt-1.5 max-h-40 overflow-auto font-mono text-[11px] leading-relaxed text-slate-300">
                      {task.code}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Chip({
  icon,
  text,
  className,
}: {
  icon?: ReactNode
  text: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-300 ring-1 ring-white/10',
        className,
      )}
    >
      {icon}
      {text}
    </span>
  )
}

function Collapse({
  title,
  subtitle,
  open,
  onToggle,
  tone,
  children,
}: {
  title: string
  subtitle: string
  open: boolean
  onToggle: () => void
  tone: 'violet' | 'cyan'
  children: ReactNode
}) {
  return (
    <section className={cn('glass overflow-hidden rounded-2xl', tone === 'violet' ? 'ring-1 ring-neon-violet/25' : '')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5 sm:px-5"
      >
        <h2
          className={cn(
            'flex items-center gap-2 text-sm font-bold',
            tone === 'violet' ? 'text-neon-violet' : 'text-neon-cyan',
          )}
        >
          {title}
        </h2>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{subtitle}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <div className={cn('grid transition-all duration-300', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
        </div>
      </div>
    </section>
  )
}
