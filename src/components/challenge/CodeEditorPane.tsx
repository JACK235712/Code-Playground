import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { indentUnit } from '@codemirror/language'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { CheckCircle2, CircleAlert, Loader2, Play, RotateCcw, Terminal } from 'lucide-react'
import { useAuth, useStats, useUser } from '../../context/AuthContext'
import type { AgentTask } from '../../data/agentTasks'
import { reportActiveTask } from '../../data/agentTasks'
import { describeClear, settleClearReward } from '../../data/rewards'
import type { ClearResult } from '../../data/rewards'
import { addCodingSeconds, grantProgress } from '../../data/stats'
import { useCodingTimer } from '../../hooks/useCodingTimer'
import { LANGUAGES, initialCode } from '../../data/languages'
import type { LangId } from '../../data/languages'
import type { Problem } from '../../data/problems'
import { LANG_PARSER, cpNeonTheme, editorExtensions } from '../../lib/codemirror'
import { diagnose, factsOf, hintsOf, reviewOf, syntaxIssue } from '../../lib/codeWatch'
import type { ButlerState, Diagnosis, HintKind, Review, SuspectReason } from '../../lib/codeWatch'
import { runProblem } from '../../lib/simulateRun'
import type { LogLine } from '../../lib/simulateRun'
import { judgeSubmission } from '../../lib/ruleJudge'
import { cn } from '../../lib/cn'
import { ButlerNotes } from './ButlerNotes'
import { ButlerOrb } from './ButlerOrb'
import { LanguagePicker } from './LanguagePicker'

type Status = 'idle' | 'running' | 'printed' | 'error' | 'timeout'
/** explain 只在规则引擎拦下提交时有值：那种失败不是「少打印了什么」，得换一句话说 */
type Verdict = { passed: boolean; missing: string[]; explain?: string; payout: ClearResult | null }

const LEVEL_COLOR: Record<LogLine['level'], string> = {
  log: 'text-slate-200',
  info: 'text-neon-cyan',
  warn: 'text-neon-amber',
  error: 'text-neon-pink',
}

const STATUS_TEXT: Record<Status, string> = {
  idle: '待编写',
  running: '运行中',
  printed: '已运行',
  error: '有报错',
  timeout: '已中止',
}

/** 写进任务账本的那句判定结果：下一轮分析读的就是它，所以要说清差在哪而不是只说「失败」 */
const VERDICT_LABEL: Record<SuspectReason, string> = {
  error: '未通关：跑挂了（语法或运行报错）',
  timeout: '未通关：循环停不下来，超过 2 秒被中止',
  missing: '未通关：输出里缺了题目要求的关键字',
  'no-output': '未通关：什么都没打印',
  forbidden: '未通关：命中本题禁用写法（输出碰巧对，逻辑是错的）',
}

/** 敲完最后一次键多久之后，状态球从「正在观察」退回待机 */
const QUIET_MS = 1600

export function CodeEditorPane({
  problem,
  lang,
  onLangChange,
  onSourceChange,
  onCoach,
  onAsk,
  onRuleHit,
  className,
}: {
  problem: Problem
  lang: LangId
  onLangChange: (lang: LangId) => void
  /** 把编辑器当前内容同步给外层：AI 助教提问时要带上学生刚写的那几行 */
  onSourceChange: (source: string) => void
  /** 小游主动播报（运行失败、刚通关）：只在本地盘一条气泡，不请求模型 */
  onCoach: (text: string) => void
  /** 学生点了「问小游」：把这句话真的发进对话 */
  onAsk: (text: string) => void
  /** 规则引擎这次拦下了什么错词（没拦住传 null）：小游的回答要跟着有针对性 */
  onRuleHit: (explain: string | null) => void
  className?: string
}) {
  const user = useUser()
  const { patchStats } = useAuth()
  const stats = useStats()
  const [source, setSource] = useState(() => initialCode(lang, problem))
  const [lines, setLines] = useState<LogLine[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [typing, setTyping] = useState(false)
  const [dismissed, setDismissed] = useState<HintKind[]>([])
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [review, setReview] = useState<Review | null>(null)
  /** 编辑器有没有拿到焦点：计时心跳只在真的对着代码的时候跑 */
  const [writing, setWriting] = useState(false)
  useCodingTimer(writing, (seconds) => patchStats((prev) => addCodingSeconds(prev, seconds)))
  const runRef = useRef(execute)
  const quietRef = useRef<number | undefined>(undefined)
  const coachRef = useRef(onCoach)
  coachRef.current = onCoach

  const facts = useMemo(() => factsOf(lang, source), [lang, source])
  const hints = useMemo(
    () => hintsOf(facts).filter((hint) => !dismissed.includes(hint.kind)),
    [facts, dismissed],
  )

  const butlerState: ButlerState = review
    ? 'reviewing'
    : diagnosis && !typing
      ? 'diagnosing'
      : typing
        ? 'observing'
        : 'idle'

  const orbHint =
    butlerState === 'reviewing'
      ? `✔ ${review?.lines.filter((l) => l.kind === 'ok').length ?? 0} 项 · 建议 ${review?.lines.filter((l) => l.kind === 'tip').length ?? 0} 条`
      : butlerState === 'diagnosing'
        ? diagnosis?.line
          ? `最想问你第 ${diagnosis.line} 行`
          : '想找你说的代码'
        : butlerState === 'observing'
          ? `已经敲到第 ${facts.lastCodeLine} 行`
          : hints.length > 0
            ? `有 ${hints.length} 条轻提示`
            : '先不打扰你'

  /** 状态球和面板的「问小游」共用一个出口：谁最紧急就替学生问谁 */
  function pokeMentor() {
    if (review) return onAsk(review.ask)
    if (diagnosis) return onAsk(diagnosis.ask)
    if (hints[0]) return onAsk(hints[0].ask)
    return onAsk(
      facts.codeLines === 0
        ? `我还不知道《${problem.title}》从哪一行开始写，先问我一个问题帮我起步？`
        : `我在《${problem.title}》上写了 ${facts.codeLines} 行，先问我一个问题，定位我卡在哪。`,
    )
  }

  useEffect(() => () => window.clearTimeout(quietRef.current), [])

  function trackTyping(next: string) {
    setSource(next)
    onSourceChange(next)
    // 学生一改代码，上一次命中的错词就过期了，别让它继续污染小游的下一次回答
    onRuleHit(null)
    setTyping(true)
    window.clearTimeout(quietRef.current)
    quietRef.current = window.setTimeout(() => setTyping(false), QUIET_MS)
  }

  // Mod-Enter 已被 basicSetup 的换行命令占用，必须用 Prec.high 抢在它前面，否则只会多出一个空行
  const extensions = useMemo(
    () => [
      ...editorExtensions,
      LANG_PARSER[lang](),
      indentUnit.of(LANGUAGES[lang].indent),
      Prec.high(
        keymap.of([
          {
            key: 'Mod-Enter',
            preventDefault: true,
            run: () => {
              runRef.current(false)
              return true
            },
          },
        ]),
      ),
    ],
    [lang],
  )

  // 换题或换语言：语法高亮跟着换，代码模板也重置成这道题在这门语言下的起手式
  useEffect(() => {
    const seed = initialCode(lang, problem)
    setSource(seed)
    onSourceChange(seed)
    onRuleHit(null)
    setLines([])
    setStatus('idle')
    setVerdict(null)
    setDiagnosis(null)
    setReview(null)
    setDismissed([])
  }, [lang, problem, onSourceChange, onRuleHit])

  async function execute(submitting: boolean) {
    if (status === 'running') return
    setStatus('running')
    if (submitting) setVerdict(null)
    // 旧的诊断先收起来；通关报告只在重新提交时重算，不然「再跑一次」会把奖励动画吃掉
    setDiagnosis(null)
    if (submitting) setReview(null)

    const outcome = await runProblem(lang, problem, source)
    /**
     * 判题不再在这组件里凑规则，一律交给统一的规则引擎（src/lib/ruleJudge.ts）：
     * 禁用错词 → 跑不起来（超时 / 括号不配对 / 什么都没打印）→ 输出是否覆盖 expectedOutput 每一行。
     * 「结构齐全 + 字面量对得上」并不等于逻辑正确，所以第一道闸门专抓那种输出碰巧对的写法。
     */
    const result = judgeSubmission({ problem, lang, source, outcome })
    setLines(result.lines)
    /** 命中的错词同步给外层：小游下一次回答（包括学生自己开口问）都带着它 */
    onRuleHit(result.hits.length > 0 ? result.explain : null)

    /** 行号和括号都要按刚跑完的这份源码现算，不能用上一次 memo 里的旧事实 */
    const now = factsOf(lang, source)
    const issue = syntaxIssue(lang, source)
    const hit = result.hits[0] ?? null
    /** 引擎用 passed 表态，这里跟着 reason 收窄，好让下面 VERDICT_LABEL[reason] 过得去类型 */
    const reason = result.reason
    const passed = reason === 'ok'

    setStatus(
      reason === 'timeout' ? 'timeout' : reason === 'error' || reason === 'forbidden' ? 'error' : 'printed',
    )

    /**
     * 智能体埋点（模块三）：只有点「提交答案」才记账，而且无论成败都要记一笔。
     * reportActiveTask 内部负责查 activeTaskId、算耗时（进入挑战页那一刻由 ChallengePage 起表）、
     * 写回判定结果和这份 source、把题号存进 attemptId：
     * 通关 → 状态转 completed 并清空 activeTaskId；
     * 没通关 → 保持 pending，failCount 累加、lastFailCode 记下差在哪，activeTaskId 不动，
     *          下次进来还是这道题，重试会接着攒。
     * 没在追踪、或这张卡早已封账时它直接返回 null，所以这里不需要任何分支。
     * 整段包 try/catch：账本写坏了也不能拖累判题。返回值留着——它是「任务首次完成」的凭据。
     */
    let settledTask: AgentTask | null = null
    if (submitting) {
      try {
        settledTask = reportActiveTask(user.id, {
          problemId: problem.id,
          problemTitle: problem.title,
          verdict: passed ? '通关：全部目标都跑出来了' : VERDICT_LABEL[reason],
          code: source,
          passed,
          failCode: passed ? null : reason,
        })
      } catch {
        /* 存储不可用（无痕模式）时静默跳过 */
      }
    }

    /**
     * 经济结算排在记账之后，但两者互不牵连：账本该转 completed 已经转了，
     * 这里只管这次到底发多少钱（防刷名单 + 任务封账两道闸门都在 data/rewards 里过）。
     * 发出去的钱、这次写的行数、通关数和涨的那一维雷达分一起写回 userStats，
     * 等级和段位由累计 xp 自己长出来，顶栏和【我的】页那几个面板跟着刷新。
     */
    const payout = passed && submitting ? settleClearReward(user.id, stats, problem.id, settledTask, source) : null
    if (payout) {
      if (payout.coins > 0 || payout.xp > 0 || payout.lines > 0 || payout.cleared > 0 || payout.skill) {
        patchStats((prev) =>
          grantProgress(prev, {
            coins: payout.coins,
            xp: payout.xp,
            lines: payout.lines,
            cleared: payout.cleared,
            skill: payout.skill ? { id: payout.skill.id, gain: payout.skill.gain } : undefined,
          }),
        )
      }
      for (const line of describeClear(problem.title, payout)) console.info(`[奖励] ${line}`)
    }

    if (submitting)
      setVerdict({
        passed,
        missing: result.missing,
        payout,
        explain: hit ? `第 ${hit.line} 行命中本题禁用写法「${hit.keyword}」，输出碰巧对但逻辑是错的` : undefined,
      })

    if (passed) {
      if (submitting) {
        const report = reviewOf(now, problem)
        setReview(report)
        coachRef.current(
          `✔ 通关了！${LANGUAGES[lang].label} 版全部目标都跑出来了，我把代码评审写在编辑器下面了。`,
        )
      } else if (hints[0] && !review) {
        coachRef.current(`这次跑通了。顺便说一句：${hints[0].text}`)
      }
      return
    }

    // 这次跑挂了，那份「逻辑正确」的报告就不再挂着
    setReview(null)
    const next = diagnose(now, reason, {
      missing: result.missing,
      issue,
      line: hit?.line ?? null,
      hit: hit ? `第 ${hit.line} 行命中本题禁用写法「${hit.keyword}」` : null,
    })
    setDiagnosis(next)

    /**
     * 被禁用词拦住，说明「模拟判题看不出逻辑错」这一类问题被抓到了：
     * 这时候不替学生总结，直接把命中的错词问进对话，让小游针对那一行点评。
     * 其余失败原因照旧只在本地盘一条气泡，省一次模型调用。
     */
    if (submitting && hit) {
      onAsk(
        `我提交《${problem.title}》被规则判题拦下了：${hit.text ? `第 ${hit.line} 行是「${hit.text}」` : ''}命中的禁用写法「${hit.keyword}」。别说答案，先问我这一行想让谁停下来。`,
      )
      return
    }
    coachRef.current(next.text)
  }

  runRef.current = execute

  const running = status === 'running'
  const spec = LANGUAGES[lang]

  return (
    <section className={cn('glass flex flex-col overflow-hidden rounded-2xl', className)}>
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] text-neon-cyan ring-1 ring-white/10">
          {spec.fileName}
        </span>
        <LanguagePicker value={lang} onChange={onLangChange} />
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === 'error' || status === 'timeout' ? 'bg-neon-pink' : 'bg-neon-lime',
            )}
          />
          {STATUS_TEXT[status]}
        </span>
      </header>

      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onFocus={() => setWriting(true)}
        onBlur={() => setWriting(false)}
      >
        <CodeMirror
          value={source}
          onChange={trackTyping}
          theme={cpNeonTheme}
          extensions={extensions}
          basicSetup={{ foldGutter: false, autocompletion: false }}
          height="100%"
          className="h-full"
        />
        <ButlerOrb state={butlerState} hint={orbHint} onPoke={pokeMentor} />
      </div>

      <ButlerNotes
        facts={facts}
        hints={hints}
        diagnosis={diagnosis}
        review={review}
        onAsk={onAsk}
        onDismiss={(kind) => setDismissed((prev) => [...prev, kind])}
        onClear={() => {
          setDiagnosis(null)
          setReview(null)
        }}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => execute(false)}
          disabled={running}
          className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-blue px-5 text-sm font-bold text-ink-950 shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          运行代码
        </button>

        <button
          type="button"
          onClick={() => execute(true)}
          disabled={running}
          className="flex h-10 items-center gap-2 rounded-xl border border-neon-violet/40 bg-neon-violet/10 px-5 text-sm font-bold text-neon-violet transition-all hover:bg-neon-violet/20 active:scale-[0.98] disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          提交答案
        </button>

        <span className="ml-auto hidden items-center gap-1 font-mono text-[10px] text-slate-600 sm:flex">
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">Ctrl</kbd>+
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 ring-1 ring-white/10">Enter</kbd> 运行
        </span>
      </div>

      {verdict && (
        <div
          className={cn(
            'mx-3 mb-2 flex items-start gap-2 rounded-xl p-3 text-sm ring-1',
            verdict.passed
              ? 'bg-neon-lime/10 text-neon-lime ring-neon-lime/30'
              : 'bg-neon-pink/10 text-neon-pink ring-neon-pink/30',
          )}
        >
          {verdict.passed ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p className="leading-relaxed">
            {verdict.passed ? (
              <>
                通关！{spec.label} 版全部目标都跑出来了，
                {verdict.payout && verdict.payout.coins + verdict.payout.xp > 0 ? (
                  <>
                    奖励 <b>+{verdict.payout.coins} 金币</b>、<b>+{verdict.payout.xp} XP</b>。
                  </>
                ) : (
                  <>这道题早就通关了，这次不再发奖励。</>
                )}
              </>
            ) : (
              <>
                还差一点：
                {verdict.explain ?? (
                  <>
                    运行结果里没看到 <b className="font-mono">{verdict.missing.join(' 、 ')}</b>
                  </>
                )}
                。回到卡住的那一行，想想它少了什么。
              </>
            )}
          </p>
        </div>
      )}

      <div className="border-t border-white/10 bg-ink-950/70">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Terminal className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            运行结果
          </span>
          <span className="rounded-full bg-neon-amber/10 px-2 py-0.5 font-mono text-[10px] text-neon-amber ring-1 ring-neon-amber/25">
            模拟判题
          </span>
          {status === 'timeout' && (
            <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-neon-amber">
              <RotateCcw className="h-3 w-3" />
              超过 2 秒已自动中止
            </span>
          )}
        </div>

        <div className="max-h-32 min-h-[72px] overflow-y-auto px-3 pb-3 font-mono text-xs leading-relaxed">
          {status === 'timeout' ? (
            <p className="text-neon-amber">
              程序停不下来啦——多半是循环的条件永远成立。检查一下：计数器有没有在每次循环里变大？
            </p>
          ) : lines.length === 0 ? (
            <p className="text-slate-600">// 点击「运行代码」，控制台输出会出现在这里</p>
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
  )
}
