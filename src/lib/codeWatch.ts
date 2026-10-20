import { LANGUAGES } from '../data/languages'
import type { LangId } from '../data/languages'
import type { Problem } from '../data/problems'

/**
 * 管家在编辑器旁边「看」学生写代码——纯前端启发式，一次正则都不碰网络：
 * 输出三类东西：状态球用的事实、轻提示 / 诊断句、通关后的评审报告。
 * 之所以不做成 AI 调用，是因为这些东西每次敲键都要重算，
 * 而且必须「只给方向、不给答案」——规则引擎比模型更守规矩。
 */

export type ButlerState = 'idle' | 'observing' | 'diagnosing' | 'reviewing'

export type CodeFacts = {
  /** 真正有内容的代码行（空行、纯注释行都不算） */
  codeLines: number
  /** 带注释的行数（整行注释 + 行尾注释） */
  commentLines: number
  /** 疑似魔法数字：既不是 0/1/2，也不住在有名字的变量里 */
  magic: number
  /** 魔法数字所在行号（1-based，最多记 4 个） */
  magicLines: number[]
  whileLoops: number
  forLoops: number
  hasFunction: boolean
  /** 第一处循环 / 第一处打印 / 第一处分支所在行，用来指认「第 X 行」 */
  loopLine: number | null
  printLine: number | null
  conditionLine: number | null
  lastCodeLine: number
  /** 缩进是不是都踩着 4 格走 */
  tidyIndent: boolean
}

const STRING = /"""[\s\S]*?"""|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g
const BLOCK = /\/\*[\s\S]*?\*\//g
const NUMBER = /\d+(?:\.\d+)?/g
/** `int LIMIT = 100;` / `limit = 100` —— 数字已经住进有名字的变量，不算魔法数字 */
const NAMED_CONSTANT =
  /^\s*(?:(?:const|final|static|public|private|int|long|float|double|bool|auto|var|let)\s+)*[A-Za-z_]\w*(?:\s*\[[^\]]*\])?\s*[:=]\s*[-+]?[\d.]+\s*[;)]?$/

/** 剥掉字符串和注释：只有真的会参与运算的数字才算魔法数字 */
function bare(lang: LangId, line: string) {
  const noString = line.replace(STRING, '""')
  return lang === 'python' ? noString : noString.replace(/\/\/[^\n]*/, '')
}

/** 只把块注释里的字换成空格，换行留着，后面的行号才不会错位 */
function dropBlocks(source: string) {
  return source.replace(BLOCK, (m) => m.replace(/[^\n]/g, ' '))
}

export function factsOf(lang: LangId, source: string): CodeFacts {
  const spec = LANGUAGES[lang]
  const blocks = lang === 'python' ? source : dropBlocks(source)
  let codeLines = 0
  let commentLines = 0
  let magic = 0
  const magicLines: number[] = []
  let whileLoops = 0
  let forLoops = 0
  let loopLine: number | null = null
  let printLine: number | null = null
  let conditionLine: number | null = null
  let lastCodeLine = 0
  let untidy = 0

  blocks.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (!line) return
    const code = bare(lang, line)
    if (spec.lineComment === '#' ? code.includes('#') : code.includes('//')) commentLines += 1
    const executable = code.replace(spec.lineComment === '#' ? /#.*/ : /\/\/.*/, '').trim()
    if (!executable) return

    codeLines += 1
    lastCodeLine = index + 1
    const indent = raw.length - raw.trimStart().length
    if (indent > 0 && !/^\t/.test(raw) && indent % 4 !== 0) untidy += 1
    if (/\bwhile\b/.test(executable)) whileLoops += 1
    if (/\bfor\b/.test(executable)) forLoops += 1
    if (loopLine === null && (/\bwhile\b/.test(executable) || /\bfor\b/.test(executable))) loopLine = index + 1
    if (printLine === null && /(\bcout\b|System\s*\.\s*out|System\.out|\bprint\s*\()/.test(executable)) {
      printLine = index + 1
    }
    if (conditionLine === null && /(\bif\b|\belse\b|\belif\b|\bswitch\b)/.test(executable)) {
      conditionLine = index + 1
    }
    if (executable.includes('[') || NAMED_CONSTANT.test(executable)) return
    const hits = executable.match(NUMBER)?.map(Number).filter((n) => n > 2) ?? []
    if (hits.length) {
      magic += hits.length
      if (magicLines.length < 4) magicLines.push(index + 1)
    }
  })

  return {
    codeLines,
    commentLines,
    magic,
    magicLines,
    whileLoops,
    forLoops,
    hasFunction: spec.has.function(spec.stripComments(source)),
    loopLine,
    printLine,
    conditionLine,
    lastCodeLine,
    tidyIndent: untidy === 0,
  }
}

export type HintKind = 'comment' | 'magic' | 'indent'

export type Hint = {
  kind: HintKind
  /** 管家在面板里说的这句轻提示 */
  text: string
  line?: number
  /** 点「问小游」时代为提问的完整句子 */
  ask: string
}

/** 代码写到 8 行以上才提注释的事，免得对着起手模板一直唠叨 */
const LONG_ENOUGH = 8

export type SyntaxIssue = 'brace' | 'paren'

const SYNTAX_TEXT: Record<SyntaxIssue, string> = {
  brace: '大括号没有配对',
  paren: '小括号没有配对',
}

/**
 * 浏览器里跑不了真编译器，但括号对不对得上是可以本地数出来的——
 * 这是「控制台报错」在这个演示里唯一诚实的触发条件。
 */
export function syntaxIssue(lang: LangId, source: string): SyntaxIssue | null {
  const stripped = dropBlocks(source)
    .split('\n')
    .map((line) => bare(lang, line))
    .join('\n')
  const count = (ch: string) => (stripped.match(new RegExp(`\\${ch}`, 'g')) ?? []).length
  if (count('{') !== count('}')) return 'brace'
  if (count('(') !== count(')')) return 'paren'
  return null
}

export function hintsOf(facts: CodeFacts): Hint[] {
  const hints: Hint[] = []
  if (facts.codeLines >= LONG_ENOUGH && facts.commentLines === 0) {
    hints.push({
      kind: 'comment',
      text: '你的代码写得很好，如果加点注释就更完美啦。',
      line: facts.loopLine ?? facts.printLine ?? undefined,
      ask: `我写了 ${facts.codeLines} 行，一句注释都没有。这道题里哪一行最值得加注释——以后的我看不太懂的那种？`,
    })
  }
  if (facts.magic >= 3) {
    const line = facts.magicLines[0]
    hints.push({
      kind: 'magic',
      text: '试试用变量代替这些魔法数字吧，代码可读性会更高哦。',
      line,
      ask: `我代码里有 ${facts.magic} 个数字是直接写在判断和循环里的，比如第 ${line} 行。给它们起名字的话，应该怎么命名、放在哪里？`,
    })
  }
  if (!facts.tidyIndent) {
    hints.push({
      kind: 'indent',
      text: '有几行缩进没踩在 4 格上，逻辑容易错位——特别是循环里的边界。',
      line: facts.lastCodeLine,
      ask: `我的缩进有点乱（第 ${facts.lastCodeLine} 行附近），怎么判断哪几行其实应该往右挪一格？`,
    })
  }
  return hints
}

export type SuspectReason = 'error' | 'timeout' | 'missing' | 'no-output' | 'forbidden'

export type Diagnosis = {
  /** 主动播报的那一句，不用等学生开口 */
  text: string
  /** 指认的行号；说不准时为 null，只说「整段代码」 */
  line: number | null
  ask: string
}

/** 模拟判题没有真堆栈，只能按启发式指认「最可疑的一行」 */
export function suspectLine(facts: CodeFacts, reason: SuspectReason): number | null {
  if (reason === 'timeout') return facts.loopLine
  if (reason === 'no-output') return facts.printLine ?? facts.loopLine ?? facts.lastCodeLine
  // 报错时优先指认学生真的写了逻辑的那一行，最后一行常常只是个花括号
  return facts.magicLines[0] ?? facts.conditionLine ?? facts.loopLine ?? facts.printLine ?? facts.lastCodeLine
}

export function diagnose(
  facts: CodeFacts,
  reason: SuspectReason,
  detail?: { missing?: string[]; issue?: SyntaxIssue | null; line?: number | null; hit?: string | null },
): Diagnosis {
  // 规则引擎直接报了行号（命中的禁用词就在某一行上），不用再猜
  const line = detail?.line ?? suspectLine(facts, reason)
  const where = line ? `第 ${line} 行` : '这一段代码'
  const head =
    reason === 'timeout'
      ? '我刚刚看到程序被 2 秒看门狗中止了'
      : reason === 'no-output'
        ? '我刚刚看到你的控制台什么都没打印'
        : reason === 'missing'
          ? `我刚刚看到运行结果里还没出现「${detail?.missing?.[0] ?? '目标输出'}」`
          : reason === 'forbidden'
            ? `规则判题把这段拦下了：${detail?.hit ?? '有一处写法是这道题禁用的'}`
            : detail?.issue
              ? `我刚刚看到你的控制台报错了（${SYNTAX_TEXT[detail.issue]}）`
              : '我刚刚看到你的控制台报错了'
  return {
    text: `${head}，需要我帮你看看${where}吗？`,
    line,
    ask: line
      ? `我运行失败了（${head.replace('我刚刚看到', '')}）。我第 ${line} 行写的是循环或判断，你猜问题更可能出在边界条件还是执行顺序上？`
      : `我运行了但${head.replace('我刚刚看到', '')}，帮我从思路上看看该先检查哪一行？`,
  }
}

export type ReviewLine = { kind: 'ok' | 'tip'; text: string }

export type Review = {
  title: string
  lines: ReviewLine[]
  /** 「把这条建议拿去问小游」时发出去的句子 */
  ask: string
}

/** 通关后的 AI 代码评审：两条打勾的事实 + 一条按代码实际情况挑出来的优化建议 */
export function reviewOf(facts: CodeFacts, problem: Problem): Review {
  const tips: string[] = []
  if (facts.whileLoops > 0 && facts.forLoops === 0) {
    tips.push('你可以尝试用 for 循环替代 while 循环，让代码更简洁。')
  }
  if (facts.magic >= 3) {
    tips.push(`第 ${facts.magicLines[0]} 行那几个数字重复出现在判断里，提成一个有名字的常量会更好读。`)
  }
  if (facts.commentLines === 0) {
    tips.push('在循环头上补一行注释，写清楚它每圈在做什么。')
  }
  if (!facts.hasFunction && facts.codeLines >= 18) {
    tips.push(`已经 ${facts.codeLines} 行了，把重复的那一段抽成一个函数，主流程会立刻清爽。`)
  }
  if (!facts.tidyIndent) {
    tips.push('有几行缩进没踩在 4 的倍数上，顺手对齐一下。')
  }
  if (tips.length === 0) {
    tips.push('把变量名换成能说明意图的英文单词，这段代码就可以直接进你的作品集了。')
  }

  return {
    title: `代码评审 · ${problem.title}`,
    lines: [
      {
        kind: 'ok',
        text: `逻辑正确。${problem.expectIncludes.length} 个目标全部在运行结果里出现了。`,
      },
      {
        kind: 'ok',
        text: `语法规范。${facts.codeLines} 行代码${facts.tidyIndent ? '缩进都按 4 格对齐' : '结构完整'}，没有多余的空分支。`,
      },
      ...tips.slice(0, 2).map((text) => ({ kind: 'tip' as const, text })),
    ],
    ask: `我通关了《${problem.title}》，小游给的建议是「${tips[0]}」——具体到我这段代码，该动哪一行？`,
  }
}
