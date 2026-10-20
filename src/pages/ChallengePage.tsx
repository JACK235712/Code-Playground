import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useUser } from '../context/AuthContext'
import { activeTask, armActiveTask } from '../data/agentTasks'
import { CodeEditorPane } from '../components/challenge/CodeEditorPane'
import { MentorChatPane } from '../components/challenge/MentorChatPane'
import type { Proactive } from '../components/challenge/MentorChatPane'
import { MissionPanel } from '../components/challenge/MissionPanel'
import { ProblemList } from '../components/challenge/ProblemList'
import { useProblemBatch } from '../hooks/useProblemBatch'
import { findProblem } from '../data/problems'
import type { LangId } from '../data/languages'

/** 首页「开始挑战」通过 navigate('/challenge', { state: { problemId } }) 传过来的题号 */
export default function ChallengePage() {
  const user = useUser()
  const location = useLocation()
  const routeId = (location.state as { problemId?: string } | null)?.problemId

  /**
   * 智能体埋点·定位（模块三）：任务账本里正在追踪的那张卡，先认它实际作答过的那道题
   * （attemptId，失败重试就靠它回到同一道），没答过则用这张卡生成时就钉好的 problemId。
   * 两个值都是从 LocalStorage 读的，所以从账本点「▶ 去完成」过来时，
   * 即使 URL 没带 problemId，也会自动在题池里匹配并选中那一题；一个都没有才退回默认第一题。
   * 只在进入页面这一刻读一次：写账本是提交那边的事，这里读多了会把学生手挑的题抢回去。
   */
  const tracked = useMemo(() => activeTask(user.id), [user.id])
  const pinnedId = routeId ?? tracked?.attemptId ?? tracked?.problemId ?? null
  const pinned = findProblem(pinnedId)

  const { problems, left, notice, phase, selectedId, pick, refresh, resetLog, dismissNotice } =
    useProblemBatch(pinned)

  const [lang, setLang] = useState<LangId>(() => pinned?.suggestLang ?? 'cpp')
  const problem = findProblem(selectedId) ?? problems[0]

  /**
   * 智能体埋点·起表（模块三的前半段）：进入挑战页（首页「开始挑战」也是跳到这里）
   * 或换题时给正在追踪的任务记下开始时间，就是这里的 Date.now()。
   * armActiveTask 只在「挂着 activeTaskId 且 startedAt 还是空」时写字，所以重复触发是幂等的；
   * 重试时不会重置，账本里那条耗时因此是整个特训的总时长。
   * 没有追踪任务时它什么都不做。收账在 CodeEditorPane 的 execute() 里。
   */
  useEffect(() => {
    armActiveTask(user.id)
  }, [user.id, problem.id])

  /**
   * 编辑器里的代码放在 ref 里，不放进 state：
   * 每敲一个字都 re-render 整页（题库、题面、聊天）不值得，
   * 而小游只在学生开口提问的那一刻读它一次。
   */
  const codeRef = useRef('')
  const reportSource = useCallback((source: string) => {
    codeRef.current = source
  }, [])
  const getCode = useCallback(() => codeRef.current, [])

  /**
   * 规则判题引擎最近拦下的错词也放 ref：它只在提问那一刻被读一次，
   * 放进 state 会变成「每次敲键都重画整页」。学生一改代码就被清空。
   */
  const hitRef = useRef<string | null>(null)
  const reportRuleHit = useCallback((explain: string | null) => {
    hitRef.current = explain
  }, [])
  const getRuleHit = useCallback(() => hitRef.current, [])

  /**
   * 编辑器 → 聊天框的单向管道。nonce 每次都变，保证同一句话也能再递一次，
   * 聊天框自己决定是本地记一条（note）还是真的去问小游（ask）。
   */
  const [proactive, setProactive] = useState<Proactive | null>(null)
  const coach = useCallback(
    (text: string) => setProactive((prev) => ({ mode: 'note', text, nonce: (prev?.nonce ?? 0) + 1 })),
    [],
  )
  const ask = useCallback(
    (text: string) => setProactive((prev) => ({ mode: 'ask', text, nonce: (prev?.nonce ?? 0) + 1 })),
    [],
  )

  /** 带过来的题有推荐语言（比如迷宫题更适合 Python），跟着切一次 */
  useEffect(() => {
    if (pinned) setLang(pinned.suggestLang ?? 'cpp')
  }, [pinnedId]) // eslint-disable-line react-hooks/exhaustive-deps

  function onPick(id: string) {
    pick(id)
    const next = findProblem(id)
    if (next?.suggestLang) setLang(next.suggestLang)
  }

  return (
    <div className="flex flex-col gap-4 py-2 lg:h-[calc(100dvh-13rem)] lg:min-h-[620px] lg:flex-row">
      <div className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0 lg:overflow-y-auto">
        <ProblemList
          problems={problems}
          selectedId={problem.id}
          left={left}
          notice={notice}
          flipping={phase === 'out'}
          onPick={onPick}
          onRefresh={refresh}
          onResetLog={resetLog}
          onDismissNotice={dismissNotice}
        />
        <MissionPanel problem={problem} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <CodeEditorPane
          problem={problem}
          lang={lang}
          onLangChange={setLang}
          onSourceChange={reportSource}
          onCoach={coach}
          onAsk={ask}
          onRuleHit={reportRuleHit}
          className="h-[560px] lg:h-auto lg:min-h-0 lg:flex-[7]"
        />
        <MentorChatPane
          problem={problem}
          lang={lang}
          getCode={getCode}
          getRuleHit={getRuleHit}
          proactive={proactive ?? undefined}
          className="h-[440px] lg:h-auto lg:min-h-0 lg:flex-[5]"
        />
      </div>
    </div>
  )
}
