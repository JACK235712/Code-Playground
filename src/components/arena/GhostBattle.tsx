import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { indentUnit } from '@codemirror/language'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { Bot, CheckCircle2, CircleAlert, Ghost, Loader2, Play, Radio, Timer, X } from 'lucide-react'
import { ARENA_MODES } from '../../data/arena'
import {
  CAST,
  GHOST_LEAD_IN_MS,
  IDLE_CHECK_MS,
  IDLE_MS,
  ghostCharMs,
  ghostScript,
  ghostSpeedLabel,
  linesOf,
  maskGhostScript,
} from '../../data/ghost'
import type { Battle } from '../../data/ghost'
import { LANGUAGES, initialCode } from '../../data/languages'
import type { LangId } from '../../data/languages'
import { getRankInfo, levelOf } from '../../data/ranks'
import { useStats, useUser } from '../../context/AuthContext'
import { cpNeonTheme, editorExtensions, LANG_PARSER } from '../../lib/codemirror'
import { factsOf } from '../../lib/codeWatch'
import { runProblem } from '../../lib/simulateRun'
import type { LogLine } from '../../lib/simulateRun'
import { LanguagePicker } from '../challenge/LanguagePicker'
import { PlayerAvatar } from '../PlayerAvatar'
import { GhostWindow } from './GhostWindow'
import { useCaster } from '../../hooks/useCaster'
import { useTypewriter } from '../../hooks/useTypewriter'
import { cn } from '../../lib/cn'

const DEFAULT_LANG: LangId = 'python'

type Status = 'idle' | 'running' | 'printed' | 'timeout'

const STATUS_TEXT: Record<Status, string> = {
  idle: '待编写',
  running: '运行中',
  printed: '已运行',
  timeout: '已中止',
}

const LEVEL_COLOR: Record<LogLine['level'], string> = {
  log: 'text-slate-200',
  info: 'text-neon-cyan',
  warn: 'text-neon-amber',
  error: 'text-neon-pink',
}

/**
 * 全屏对战舱：解说台在最上，左边是玩家自己的霓虹编辑器，右边对手那台「终端机」滚的是打码后的伪代码。
 *
 * 三区各说各的事实：左报你写了几行、右报它写了几行、顶上那句由大模型现写。
 * 节奏、台词、抽题、段位→手速、源码→马赛克的映射全在 data/ghost.ts，这里不写文案也不写数字表。
 * 它住在 /arena/battle 这条独立路由上，退出=回大厅，所以关闭动作是一个 prop，不由组件自己跳路由。
 */
export function GhostBattle({ battle, onClose }: { battle: Battle; onClose: () => void }) {
  const { problem, opponent, mode } = battle
  const user = useUser()
  const stats = useStats()
  const rank = getRankInfo(opponent.xp)
  /** 段位决定对手每露一个字符停多久：青铜白银 150ms，星耀王者 20ms */
  const charMs = ghostCharMs(opponent.xp)
  const speedLabel = ghostSpeedLabel(opponent.xp).replace('手速 · ', '')
  const modeName = ARENA_MODES.find((item) => item.id === mode)?.name ?? ''

  const [lang, setLang] = useState<LangId>(DEFAULT_LANG)
  const [source, setSource] = useState(() => initialCode(DEFAULT_LANG, problem))
  const [status, setStatus] = useState<Status>('idle')
  const [lines, setLines] = useState<LogLine[]>([])
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [ghostStarted, setGhostStarted] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const { cast, say } = useCaster(opponent, problem)
  const script = ghostScript(problem, lang)
  /** 对手还没就位时传空串：useTypewriter 文本一变就重头打，换语言正好让它重写一遍 */
  const { typed, done } = useTypewriter(ghostStarted ? script : '', charMs)
  const ghostDone = ghostStarted && done
  const ghostLines = linesOf(typed)
  /**
   * 防抄袭：真答案只参与进度计算，进视窗的每一行都先在这里糊成马赛克。
   * 打码的是「整篇」而不是「目前打到的部分」，雨帘的行序在一局里才稳定，滚动不抽动。
   */
  const masked = useMemo(() => maskGhostScript(script), [script])
  const ghostPct = script.length ? Math.round((typed.length / script.length) * 100) : 0
  const ghostTotalLines = linesOf(script)
  /** 已经吐到第几行（含空行）：视窗用它决定哪几行还悬着没落笔 */
  const ghostRows = typed ? typed.split('\n').length : 0
  const facts = useMemo(() => factsOf(lang, source), [lang, source])
  /** 起手式自带的那几行不算学生写的：C++ 模板光 #include 就是「可执行行」，照实数会虚高 */
  const baseline = useMemo(() => factsOf(lang, initialCode(lang, problem)).codeLines, [lang, problem])
  const addedLines = Math.max(facts.codeLines - baseline, 0)

  const startedAt = useRef(Date.now())
  const lastKeyAt = useRef(Date.now())
  const runRef = useRef(run)

  /* 就位 → 开始打字；换语言也走这一轮 */
  useEffect(() => {
    if (ghostStarted) return
    const id = window.setTimeout(() => {
      setGhostStarted(true)
      say('start', CAST.start(opponent.player))
    }, GHOST_LEAD_IN_MS)
    return () => window.clearTimeout(id)
  }, [ghostStarted, lang, say, opponent.player])

  /* 交卷那一刻播报一次 */
  useEffect(() => {
    if (!ghostDone) return
    say('finished', CAST.finished(opponent.player, linesOf(script)))
  }, [ghostDone, script, say, opponent.player])

  /* 手速监测：静默满 10 秒就提醒一次，然后重新计时，不是一句话刷屏 */
  useEffect(() => {
    if (!ghostStarted) return
    const id = window.setInterval(() => {
      if (Date.now() - lastKeyAt.current < IDLE_MS) return
      lastKeyAt.current = Date.now()
      say(ghostDone ? 'idleFinished' : 'idle', ghostDone ? CAST.idleFinished(opponent.player) : CAST.idle(opponent.player))
    }, IDLE_CHECK_MS)
    return () => window.clearInterval(id)
  }, [ghostStarted, ghostDone, say, opponent.player])

  /* 计时 + 「碰过键盘就算动手」：连粘贴、点编辑器都算，不只是打字 */
  useEffect(() => {
    const bump = () => {
      lastKeyAt.current = Date.now()
    }
    const tick = () => setElapsed(Date.now() - startedAt.current)
    window.addEventListener('keydown', bump, true)
    window.addEventListener('pointerdown', bump, true)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.removeEventListener('keydown', bump, true)
      window.removeEventListener('pointerdown', bump, true)
      window.clearInterval(id)
    }
  }, [])

  const extensions = useMemo(
    () => [
      ...editorExtensions,
      LANG_PARSER[lang](),
      indentUnit.of(LANGUAGES[lang].indent),
      // Mod-Enter 被 basicSetup 的换行占了，必须 Prec.high 抢在前面
      Prec.high(
        keymap.of([
          {
            key: 'Mod-Enter',
            preventDefault: true,
            run: () => {
              runRef.current()
              return true
            },
          },
        ]),
      ),
    ],
    [lang],
  )

  /* 换语言：起手模板跟着换，对手也重新落子（终端里的代码始终是高亮的那门语言） */
  useEffect(() => {
    setSource(initialCode(lang, problem))
    setLines([])
    setStatus('idle')
    setVerdict(null)
    setGhostStarted(false)
    if (lang !== DEFAULT_LANG) say('switchLang', CAST.switchLang(opponent.player, LANGUAGES[lang].label))
  }, [lang, problem, say, opponent.player])

  async function run() {
    if (status === 'running') return
    lastKeyAt.current = Date.now()
    // 空手按运行：起手式自带的那几行不算他写的，不夸，也不假装跑过
    if (addedLines === 0) {
      setLines([])
      setStatus('idle')
      say('emptyRun', CAST.emptyRun)
      return
    }

    setStatus('running')
    const outcome = await runProblem(lang, problem, source)
    setLines(outcome.lines)
    setStatus(outcome.timedOut ? 'timeout' : 'printed')
    const joined = outcome.lines.map((line) => line.text).join('\n')
    setVerdict(!outcome.timedOut && problem.expectIncludes.every((needle) => joined.includes(needle)))

    // 卡壳的那一枪不能报「漂亮的操作」
    if (outcome.timedOut) say('timeout', CAST.timeout)
    else say('run', CAST.run(opponent.player))
  }
  runRef.current = run

  const running = status === 'running'

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950/60">
      <header className="shrink-0 border-b border-white/10 bg-ink-950/90 px-3 py-2.5 backdrop-blur-md sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 truncate text-sm font-black">
            <span className="text-neon-cyan text-glow">全屏对战舱</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="text-slate-300">
              {modeName}《{problem.title}》
            </span>
          </h1>

          <dl className="ml-auto flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-1 text-slate-500">
              <Timer className="h-3.5 w-3.5" />
              <dd>{(elapsed / 1000).toFixed(0)}s</dd>
            </div>
            <div className="flex min-w-0 items-center gap-1 text-neon-lime">
              <Ghost className="h-3.5 w-3.5 shrink-0" />
              <dd className="max-w-[10rem] truncate">
                {opponent.player} {ghostLines} 行{ghostDone ? ' · 已交卷' : ghostStarted ? ' · 输出中' : ' · 就位中'}
              </dd>
            </div>
            <div className="flex items-center gap-1 text-neon-violet">
              <Radio className="h-3.5 w-3.5" />
              <dd>你多写 {addedLines} 行</dd>
            </div>
          </dl>

          {/* 退出放右上角，和整屏的「回到大厅」同一个方向；舱里没写多少东西，不藏二级菜单 */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-neon-pink/35 bg-neon-pink/10 px-2.5 font-mono text-[11px] text-neon-pink transition-colors hover:bg-neon-pink hover:text-ink-950"
          >
            <X className="h-3.5 w-3.5" />
            退出对战舱
          </button>
        </div>

        {/* 电竞解说台：渐变描边的气泡 + LIVE 灯 + 对手三要素小票。播报的是事实，句子由大模型现写 */}
        <div className="mt-2.5 rounded-2xl bg-gradient-to-r from-neon-violet via-neon-pink to-neon-cyan p-[1.5px] shadow-glow">
          <div className="flex items-start gap-2.5 rounded-[calc(1rem-1.5px)] bg-ink-950/92 px-3 py-2.5">
            <span className="relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-violet to-neon-pink ring-1 ring-white/25">
              <span className="absolute inset-0 animate-ping rounded-full bg-neon-violet/40" />
              <Bot className="relative h-4 w-4 text-ink-950" />
            </span>
            <p aria-live="polite" className="min-w-0 flex-1 text-sm leading-relaxed text-slate-100">
              <span className="mr-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-neon-pink">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-pink" />
                Live · {cast.fromModel ? '赛博核心' : '本地战况'}
              </span>
              <span key={cast.nonce} className="inline">
                <span className="sr-only">{cast.text}</span>
                <CastTyped text={cast.text} />
              </span>
            </p>
            <span className="hidden shrink-0 flex-col items-end gap-0.5 font-mono text-[10px] text-slate-500 sm:flex">
              <span>
                对手 <span className="text-neon-cyan">{opponent.player}</span>
              </span>
              <span>
                段位 <span style={{ color: rank.color }}>{rank.name}</span> · Lv.{levelOf(opponent.xp)}
              </span>
              <span>
                手速 <span className="text-neon-amber">{speedLabel}</span> · 每字 {charMs}ms
              </span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:gap-4 lg:overflow-hidden lg:p-4">
        {/* 左：玩家自己 */}
        <section className="glass flex min-h-[56dvh] flex-col overflow-hidden rounded-2xl lg:min-h-0 lg:flex-1">
          {/* 身份条：谁在这台机器上写、写到第几行，一眼能看到 */}
          <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-neon-cyan/12 to-transparent px-3 py-2">
            <PlayerAvatar name={user.nickname} xp={stats.xp} size="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <p className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-xs font-bold text-slate-100">{user.nickname}</span>
                <span className="font-mono text-[10px] text-slate-500">Lv.{levelOf(stats.xp)}</span>
              </p>
              <p className="font-mono text-[10px] text-neon-violet">
                你写的 {addedLines} 行 · 可执行 {facts.codeLines} 行
              </p>
            </div>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-slate-500">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  status === 'timeout' ? 'bg-neon-pink' : status === 'printed' ? 'bg-neon-lime' : 'bg-slate-500',
                )}
              />
              {STATUS_TEXT[status]}
            </span>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
            <span className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-neon-cyan ring-1 ring-white/10">
              {LANGUAGES[lang].fileName}
            </span>
            <LanguagePicker
              value={lang}
              onChange={(next) => {
                lastKeyAt.current = Date.now()
                // 同步把对手退回「就位中」，否则旧的那份字数会让交卷播报抢跑一帧
                setGhostStarted(false)
                setLang(next)
              }}
            />
            <span className="ml-auto hidden items-center gap-1 font-mono text-[10px] text-slate-600 sm:flex">
              <kbd className="rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">Ctrl</kbd>+
              <kbd className="rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">Enter</kbd> 运行
            </span>
          </div>

          {/* 编辑器：行号和语法高亮都由 CodeMirror 出，主题是对战舱这套霓虹 */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <CodeMirror
              value={source}
              onChange={(next) => {
                lastKeyAt.current = Date.now()
                setSource(next)
              }}
              theme={cpNeonTheme}
              extensions={extensions}
              basicSetup={{ foldGutter: false, autocompletion: false }}
              height="100%"
              className="h-full"
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-blue px-5 text-sm font-bold text-ink-950 shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              运行代码
            </button>
            {/* 对面那位的三要素也摆在手边：打不过的时候先看清楚是谁在打 */}
            <span className="hidden items-center gap-1.5 font-mono text-[10px] text-slate-500 md:flex">
              对面 <span className="text-neon-lime">{opponent.player}</span>
              <span style={{ color: rank.color }}>{rank.name}</span>·{speedLabel}·每字 {charMs}ms
            </span>
          </div>

          {verdict !== null && (
            <p
              className={cn(
                'mx-3 mb-2 flex shrink-0 items-start gap-2 rounded-xl p-2.5 text-xs leading-relaxed ring-1',
                verdict ? 'bg-neon-lime/10 text-neon-lime ring-neon-lime/30' : 'bg-neon-amber/10 text-neon-amber ring-neon-amber/30',
              )}
            >
              {verdict ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span>
                {verdict
                  ? `和 ${opponent.player} 的答案一样能跑出「${problem.expectIncludes.join(' 、 ')}」——这一把你的没输。`
                  : `运行结果里还没出现「${problem.expectIncludes.join(' 、 ')}」，对面那位已经交卷了。`}
              </span>
            </p>
          )}

          <div className="shrink-0 border-t border-white/10 bg-ink-950/70">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                你的运行结果
              </span>
              <span className="rounded-full bg-neon-amber/10 px-2 py-0.5 font-mono text-[10px] text-neon-amber ring-1 ring-neon-amber/25">
                模拟判题
              </span>
            </div>
            <div className="max-h-28 min-h-[52px] overflow-y-auto px-3 pb-3 font-mono text-xs leading-relaxed">
              {status === 'timeout' ? (
                <p className="text-neon-amber">程序停不下来啦——多半是循环条件永远成立，检查计数器有没有每圈都变大。</p>
              ) : lines.length === 0 ? (
                <p className="text-slate-600">// 点「运行代码」，输出出现在这里；对面那位不用等它</p>
              ) : (
                lines.map((line, i) => (
                  <p key={i} className={cn('whitespace-pre-wrap break-words', LEVEL_COLOR[line.level])}>
                    <span className="mr-2 select-none text-slate-600">›</span>
                    {line.text}
                  </p>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 右：对手那台终端机，段位和手速写在它自己的窗楣上，源码永远是打码后的马赛克 */}
        <aside className="h-[46dvh] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
          <GhostWindow
            name={opponent.player}
            rankName={rank.name}
            rankColor={rank.color}
            level={levelOf(opponent.xp)}
            speedLabel={ghostSpeedLabel(opponent.xp)}
            charMs={charMs}
            lang={lang}
            masked={masked}
            written={ghostRows}
            linesDone={ghostLines}
            pct={ghostPct}
            totalLines={ghostTotalLines}
            started={ghostStarted}
            done={ghostDone}
          />
        </aside>
      </main>
    </div>
  )
}

/**
 * 解说员的播报也走打字机，但它比管家短，光标收在句尾。
 * 换一条播报靠外层 key 重挂载，这里就不用自己管「重新起播」。
 */
function CastTyped({ text }: { text: string }) {
  const { typed, done } = useTypewriter(text, 24)
  return (
    <span aria-hidden="true">
      {typed}
      {!done && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-neon-pink align-middle" />}
    </span>
  )
}
