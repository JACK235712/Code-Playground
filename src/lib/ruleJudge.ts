import { LANGUAGES } from '../data/languages'
import type { LangId } from '../data/languages'
import type { Problem } from '../data/problems'
import { syntaxIssue } from './codeWatch'
import type { SuspectReason } from './codeWatch'
import type { LogLine, RunOutcome } from './simulateRun'

/**
 * 统一的前端规则判题引擎：挑战页的运行 / 提交都只认这里的结论。
 *
 * 为什么需要它——simulateRun 看的是「结构信号 + 源码字面量」，不真的执行代码，
 * 所以一个把累乘初值写成 0、或者干脆把答案硬编码进 print 的解法，在它眼里和标准答案一模一样。
 * 这类「逻辑错但输出碰巧对」只有题库里逐题登记的 forbiddenKeywords 能拦下来，
 * 拦下来之后把命中的错词交给 AI 导师，让它说一句针对这一行的话，而不是泛泛地夸。
 *
 * 三道闸门按从严到宽排：禁用错词 → 跑不起来（超时 / 语法 / 什么都没打印）→ 输出行覆盖标准答案。
 * 任何一道没过都算 isSuccess = false。
 */

/** 一次命中的禁用错词：题里登记的那串写法，加上学生真的写了它的那一行 */
export type RuleHit = { keyword: string; line: number; text: string }

export type JudgeVerdict = {
  passed: boolean
  /** 'ok' 之外都是失败原因码，直接写进任务账本的 lastFailCode */
  reason: SuspectReason | 'ok'
  hits: RuleHit[]
  /** 运行结果里还缺的标准输出行 */
  missing: string[]
  /** 这道题的标准输出，一行一条 */
  expected: string[]
  /** 一句话讲清这次为什么过 / 为什么没过：既是给学生的，也是喂给 AI 的上下文 */
  explain: string
  /** 控制台该显示的行（引擎会在判定失败时往里补一条 error 行） */
  lines: LogLine[]
}

const dropSpace = (text: string) => text.replace(/\s+/g, '')

/**
 * 判题用的归一化：先剥掉注释（起手模板里「// 目标 1：…」那几行不算学生写的），
 * 再抹掉所有空白——这样 'fact = 0'、'fact=0'、'fact  =  0' 是同一种写法，
 * 题库里的禁用词只需要登记不带空格的那一种。
 */
export function normalizeCode(langId: LangId, source: string): string {
  return dropSpace(LANGUAGES[langId].stripComments(source))
}

/** 逐行归一化后比对禁用词，命中就记下题面登记的原词和行号（1-based） */
export function scanForbidden(problem: Problem, langId: LangId, source: string): RuleHit[] {
  const stripped = LANGUAGES[langId].stripComments(source).split('\n')
  const hits: RuleHit[] = []
  for (const keyword of problem.forbiddenKeywords) {
    const needle = dropSpace(keyword)
    if (!needle) continue
    const index = stripped.findIndex((line) => dropSpace(line).includes(needle))
    if (index >= 0) hits.push({ keyword, line: index + 1, text: stripped[index].trim() })
  }
  return hits
}

export function expectedLines(problem: Problem): string[] {
  return problem.expectedOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** 交给 AI 导师的那句错词描述；没错词时返回 null，让提示词里不出现空块 */
export function describeHits(hits: RuleHit[]): string | null {
  if (hits.length === 0) return null
  return hits
    .map((hit) => `第 ${hit.line} 行写着「${hit.text || hit.keyword}」，命中的禁用写法是「${hit.keyword}」`)
    .join('；')
}

function toErrorLine(hits: RuleHit[]): LogLine {
  const first = hits[0]
  const rest = hits.length > 1 ? `（另外还有 ${hits.length - 1} 处）` : ''
  return {
    level: 'error',
    text: `✕ 规则判题：第 ${first.line} 行命中本题禁用写法「${first.keyword}」${rest}——输出也许碰巧对，但这个写法本身是错的。`,
  }
}

export type JudgeInput = {
  problem: Problem
  lang: LangId
  /** 学生此刻编辑器里的完整源码 */
  source: string
  /** simulateRun 跑出来的那份输出 */
  outcome: RunOutcome
}

/** 唯一的判题入口：不带任何题号分支，题目差异全部来自题库里的两个新字段 */
export function judgeSubmission({ problem, lang, source, outcome }: JudgeInput): JudgeVerdict {
  const expected = expectedLines(problem)
  const joined = outcome.lines.map((line) => line.text).join('\n')
  const silent =
    outcome.lines.length === 0 || outcome.lines.every((line) => line.level === 'warn' || !line.text.trim())
  const hits = scanForbidden(problem, lang, source)
  const issue = syntaxIssue(lang, source)
  const missing = expected.filter((line) => !joined.includes(line))

  const fail = (reason: SuspectReason, explain: string, lines: LogLine[]): JudgeVerdict => {
    if (reason === 'forbidden') {
      // 「在控制台输出错误提示」：浏览器控制台留一条，运行结果面板也补一条 error 行
      const errorLine = toErrorLine(hits)
      console.error(`[规则判题] 《${problem.title}》${explain}`)
      return {
        passed: false,
        reason,
        hits,
        missing,
        expected,
        explain,
        lines: [...lines, errorLine],
      }
    }
    return { passed: false, reason, hits, missing, expected, explain, lines }
  }

  if (hits.length > 0) {
    return fail('forbidden', `命中题目禁用写法：${describeHits(hits)}。`, outcome.lines)
  }
  if (outcome.timedOut) {
    return fail('timeout', '循环停不下来，2 秒看门狗把程序中止了。', outcome.lines)
  }
  if (issue || outcome.lines.some((line) => line.level === 'error')) {
    return fail(
      'error',
      issue ? `${issue === 'brace' ? '大括号' : '小括号'}没有配对，程序跑不起来。` : '运行时报错了。',
      outcome.lines,
    )
  }
  if (silent) {
    return fail('no-output', '控制台里一行有效输出都没有。', outcome.lines)
  }
  if (missing.length > 0) {
    return fail('missing', `标准输出里还缺：${missing.join(' 、 ')}。`, outcome.lines)
  }

  return {
    passed: true,
    reason: 'ok',
    hits: [],
    missing: [],
    expected,
    explain: `${expected.length} 行标准输出都出现了，而且没有命中任何禁用写法。`,
    lines: outcome.lines,
  }
}
