/**
 * 对战舱（幽灵替身）的数据层：这一局抽哪道题、幽灵是谁、它一个字要停多久、
 * 解说员在没有大模型时该说哪一句，全在这里定；组件只管动画和布局。
 *
 * 「幽灵」不再是凭空捏的 AI：它就是 ±1 段位规则匹配到的那个对手（见 data/arena 的
 * rollOpponent），名字、段位都拿真人数据，敲的是本局题目的标准答案
 * （problems.ts 里的 solutionCode，三语齐全才允许进对战池）。
 * 手速按段位分档——青铜白银慢到让玩家轻松赢，星耀王者快到留残影。
 */
import { rollOpponent } from './arena'
import type { ModeId, Opponent } from './arena'
import type { LangId } from './languages'
import { PROBLEMS, hasFullSolution } from './problems'
import type { Problem } from './problems'
import { getRankInfo } from './ranks'
import type { RankId } from './ranks'

/**
 * 开一局对战。两种来路共用同一个形状：
 * - createBattle：弹窗匹配成功后拿现成的 opponent 开局（大厅走这条，匹配动画摇到的就是舱里打字的）
 * - makeBattle：直接输 /arena/battle 或刷新时当场摇一次
 */
export type Battle = {
  mode: ModeId
  opponent: Opponent
  problem: Problem
}

export function createBattle(mode: ModeId, opponent: Opponent): Battle {
  return { mode, opponent, problem: drawBattleProblem(mode) }
}

export function makeBattle(mode: ModeId, myRankIndex: number): Battle {
  return createBattle(mode, rollOpponent(myRankIndex))
}

/**
 * 各玩法的抽题范围。只列三语答案齐全的题：幽灵敲的是真答案，
 * 没登记 solutionCode 的题（迷宫 BFS、哆啦A梦那种几十行的）根本不进对战池。
 */
export const GHOST_POOL: Record<ModeId, string[]> = {
  debug: ['p13', 'p5', 'p11', 'p3', 'p2', 'p26', 'p27', 'p30', 'p33', 'p34', 'p35', 'p37', 'p43'],
  golf: ['p2', 'p10', 'p3', 'p11', 'p24', 'p25', 'p36', 'p38', 'p40'],
  maze: ['p6', 'p9', 'p5', 'p28', 'p29', 'p31', 'p32', 'p39', 'p41', 'p42'],
}

/** 有完整三语答案、够格进对战舱的题 */
export function battleProblems(): Problem[] {
  return PROBLEMS.filter(hasFullSolution)
}

/** 抽本局题目：先按玩法收窄，收窄空了就退回整个对战池，保证永远有题可打 */
export function drawBattleProblem(mode: ModeId): Problem {
  const wanted = GHOST_POOL[mode] ?? []
  const all = battleProblems()
  const pool = all.filter((problem) => wanted.includes(problem.id))
  const list = pool.length ? pool : all
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * 段位 → 每露一个字符的间隔（毫秒），就是需求里那三档：
 * 青铜/白银 150 慢到让玩家轻松赢，黄金/铂金 80 适中，星耀/王者 20 快到有压迫感。
 * 钻石没在需求里点名，夹在中间给 45。
 */
export const GHOST_CHAR_MS_BY_RANK: Record<RankId, number> = {
  bronze: 150,
  silver: 150,
  gold: 80,
  platinum: 80,
  diamond: 45,
  star: 20,
  king: 20,
}

/** 视窗上那枚「手速」牌子，让玩家一眼看懂为什么它写得这么快 */
export const GHOST_SPEED_LABEL_BY_RANK: Record<RankId, string> = {
  bronze: '手速 · 极慢',
  silver: '手速 · 极慢',
  gold: '手速 · 适中',
  platinum: '手速 · 适中',
  diamond: '手速 · 偏快',
  star: '手速 · 极快',
  king: '手速 · 极快',
}

/** 对手的 XP 直接折算成段位，再查这两张表——不在别处再写一遍档位数字 */
export function ghostCharMs(opponentXp: number): number {
  return GHOST_CHAR_MS_BY_RANK[getRankInfo(opponentXp).id]
}

export function ghostSpeedLabel(opponentXp: number): string {
  return GHOST_SPEED_LABEL_BY_RANK[getRankInfo(opponentXp).id]
}

/** 幽灵在当前语言下敲的那份真答案。只在数据层和进度计算里出现，一秒钟都不能进 DOM */
export function ghostScript(problem: Problem, lang: LangId): string {
  return problem.solutionCode?.[lang] ?? ''
}

/**
 * 防抄袭用的符号池：X 占多数，混几个块符和星号，一眼看过去就是「马赛克代码」。
 * 按位置取模，同一个字符在同一列永远糊成同一个符号，逐字打出来时不会来回闪。
 */
const MASK_GLYPHS = 'XXX*▚▞#%'

/**
 * 只有空白和标点原样保留——括号、缩进、冒号留着，形状还是一行代码；
 * 字母、数字、下划线、汉字全糊掉，`42` 这种答案里的常量也不许露。
 */
const SHAPE_KEEP = new Set([
  ' ',
  '\t',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  '<',
  '>',
  ':',
  ';',
  ',',
  '.',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '!',
  '?',
  '~',
  '^',
  '=',
  '"',
  "'",
  '`',
  '\\',
])

/** 把一行源码糊成脱敏串：长度、缩进、括号位置和原文一模一样，内容一个字都读不出来 */
export function maskGhostLine(line: string, lineIndex: number): string {
  let out = ''
  for (let col = 0; col < line.length; col++) {
    const ch = line[col]
    if (SHAPE_KEEP.has(ch)) {
      out += ch
      continue
    }
    out += MASK_GLYPHS[(ch.charCodeAt(0) * 31 + col * 17 + lineIndex * 13) % MASK_GLYPHS.length]
  }
  return out
}

/** 整篇脱敏：视窗只认这个返回值，真代码到这儿就止步了 */
export function maskGhostScript(code: string): string[] {
  if (!code) return []
  return code.split('\n').map(maskGhostLine)
}

/**
 * 脱敏雨帘每行往上滚过去要花的时间（秒）。
 * 还是段位说了算：王者 20ms 档滚到看不清行，青铜 150ms 档慢得能数得过来。
 */
export function ghostCascadeRowSeconds(charMs: number): number {
  if (charMs <= 20) return 0.22
  if (charMs <= 45) return 0.3
  if (charMs <= 80) return 0.42
  return 0.62
}

/** 进场后先让幽灵「就位」一会儿，学生来得及看清题目和对手 */
export const GHOST_LEAD_IN_MS = 1200

/** 键盘静默多久算「手速落后」，以及检查节奏 */
export const IDLE_MS = 10000
export const IDLE_CHECK_MS = 1000

/** 行数一律按「有内容的行」数，空行不算，免得视窗和播报各报一个数 */
export function linesOf(code: string) {
  return code.split('\n').filter((line) => line.trim().length > 0).length
}

/**
 * 大模型没接上（断网、限流、密钥没配）时的兜底台词。
 * 带名字的那几句跟着本局对手走；带参数的几句必须跟着事实走：
 * 幽灵打完了就不能再喊「正在飞速输出」，编辑器空着就不能喊「漂亮的操作」。
 */
export const CAST = {
  intro: (problem: Problem, name: string) =>
    `对战舱已锁定。本局题目《${problem.title}》：${problem.description} ${name} 正在就位，你随时可以动手。`,
  start: (name: string) => `${name} 已经开始写代码了，你要加油了！`,
  idle: (name: string) => `你的手速落后了，${name} 正在飞速输出！`,
  idleFinished: (name: string) =>
    `${name} 早就交卷了，你这边一分钟没动——剩下的是你一个人的收尾。`,
  run: (name: string) => `漂亮的操作！${name} 似乎感受到了压力！`,
  emptyRun: '你一行还没写，这一枪打的是模板自带的空壳。先敲两行，对手不等空手的人。',
  finished: (name: string, count: number) =>
    `${name} 交卷了：${count} 行答案全部落定，视窗里那些马赛克就是它写完的。`,
  switchLang: (name: string, label: string) =>
    `${name} 换到 ${label} 写法，重新落子——这一手正好是你追上来的机会。`,
  timeout: '这一枪卡壳了：程序被 2 秒看门狗中止，对面那位可没停。',
}
