import { INFINITE_PATTERNS, LANGUAGES, isCommentOnly } from '../data/languages'
import type { LangId } from '../data/languages'
import type { Problem, Signal } from '../data/problems'

export type LogLevel = 'log' | 'info' | 'warn' | 'error'
export type LogLine = { level: LogLevel; text: string }
export type RunOutcome = { lines: LogLine[]; timedOut: boolean }

const SIGNAL_LABEL: Record<Signal, string> = {
  print: '一句打印输出',
  loop: '一个循环',
  nestedLoop: '两层嵌套循环',
  condition: '一个条件判断',
  accumulate: '把结果累计进变量',
  array: '用到数组 / 列表',
  function: '一个自定义函数',
}

/** 让「运行中」状态真的可见一秒，模拟编译 + 执行的时间 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function unmetSignals(problem: Problem, langId: LangId, code: string): string[] {
  const lang = LANGUAGES[langId]
  const missing = new Set<string>()
  for (const rule of problem.sim) {
    for (const signal of rule.need ?? []) {
      if (!lang.has[signal](code)) missing.add(SIGNAL_LABEL[signal])
    }
    for (const needle of rule.text ?? []) {
      if (!code.includes(needle)) missing.add(`源码里出现「${needle}」`)
    }
  }
  return [...missing]
}

/**
 * C++ / Java / Python 都没法在浏览器里真跑，所以这里做一次「结构模拟」：
 * 剥掉注释后，按题库里登记的信号（打印 / 循环 / 累加……）推断运行结果。
 * 它只是前端演示，真实判题要接后端沙箱，UI 上必须标成「模拟」。
 */
export async function runProblem(
  langId: LangId,
  problem: Problem,
  source: string,
): Promise<RunOutcome> {
  const code = LANGUAGES[langId].stripComments(source)
  await sleep(420)

  if (INFINITE_PATTERNS[langId].test(code)) return { lines: [], timedOut: true }

  if (isCommentOnly(langId, source)) {
    return {
      lines: [{ level: 'warn', text: '这里还只有注释——把第一行真正会跑的代码写下来吧。' }],
      timedOut: false,
    }
  }

  const lines: LogLine[] = []
  for (const rule of problem.sim) {
    const signalsOk = (rule.need ?? []).every((signal) => LANGUAGES[langId].has[signal](code))
    const textOk = (rule.text ?? []).every((needle) => code.includes(needle))
    if (signalsOk && textOk) {
      for (const text of rule.out) lines.push({ level: 'log', text })
    }
  }

  if (lines.length === 0) {
    const missing = unmetSignals(problem, langId, code)
    lines.push({
      level: 'warn',
      text: missing.length
        ? `（没有输出）大概还缺：${missing.slice(0, 3).join('、')}。`
        : '（没有输出）检查一下打印语句有没有真的被执行到。',
    })
  }

  return { lines, timedOut: false }
}
