/**
 * 竞技场的公共数据：本周榜、玩法目录、匹配池都写死在这里，
 * 真实对战需要后端房间 + 判题沙箱，届时只有这个文件会被换成接口。
 * 「我」的战绩不在这里——那部分跟着登录账号走，见 data/stats.ts。
 *
 * 榜上的数字是选手的累计 XP：段位门槛全站只有一套（见 data/ranks.ts），
 * NPC 的段位文字和颜色也由它折算，不会出现「同名玩家两处段位不一样」。
 */
import { RANKS } from './ranks'

export type LeaderRow = {
  id: string
  player: string
  /** 累计 XP，段位与等级都从这里推导 */
  xp: number
  trend: 'up' | 'flat' | 'down'
}

/** 本周极客榜：第一名拿王冠。分数刻意压在各段位门槛附近，读起来才有争夺感 */
export const WEEKLY_BOARD: LeaderRow[] = [
  { id: 'r1', player: '极客小明', xp: 2680, trend: 'up' },
  { id: 'r2', player: '夜航员的猫', xp: 2180, trend: 'flat' },
  { id: 'r3', player: 'Ctrl_Alt_Dog', xp: 1892, trend: 'up' },
  { id: 'r4', player: '小林同学', xp: 1480, trend: 'down' },
  { id: 'r5', player: '半糖主义', xp: 980, trend: 'up' },
]

/** 榜尾分数：没进前 5 的人按「离上榜还差多少 XP」显示，不编一个假名次 */
export const BOARD_CUTOFF_XP = WEEKLY_BOARD[WEEKLY_BOARD.length - 1].xp

export function gapToBoard(xp: number) {
  return Math.max(BOARD_CUTOFF_XP - xp, 0)
}

/** 前 5 名之外不写假名次，只说还差多少；进了就报真实排位 */
export function boardPosition(xp: number) {
  const ahead = WEEKLY_BOARD.filter((row) => row.xp > xp).length
  return ahead < WEEKLY_BOARD.length ? ahead + 1 : null
}

/** 池内在线人数（演示值） */
export const POOL_ONLINE = 328

export type ModeId = 'debug' | 'golf' | 'maze'

/** 1v1 竞速用的那道题——真房间由后端下发，这里先复用题库里最快的一道 */
export const DUEL_PROBLEM_ID = 'p2'

export type ArenaMode = {
  id: ModeId
  name: string
  tagline: string
  rule: string
  players: string
  live: boolean
}

export const ARENA_MODES: ArenaMode[] = [
  {
    id: 'debug',
    name: '极速 Debug',
    tagline: '看谁最快找出代码里的 Bug',
    rule: '一段故意写坏的代码先到你手上，改对它、跑通它，手快的人赢。',
    players: '2.4k 人在玩',
    live: true,
  },
  {
    id: 'golf',
    name: '代码高尔夫',
    tagline: '用最少的代码行数实现功能',
    rule: '同一道题，谁的行数更少谁就领先一行——空格也算。',
    players: '1.1k 人在玩',
    live: true,
  },
  {
    id: 'maze',
    name: '迷宫寻路',
    tagline: '写算法控制角色走出迷宫',
    rule: '你写的是走法，跑的是角色。它撞墙的次数，就是你的失误。',
    players: '860 人在玩',
    live: true,
  },
]

/**
 * 「匹配中」弹窗里转圈时的那句话，按玩法各给一份。
 * 数组长度就是「三秒里换几句」：极速 Debug 换三条，高尔夫和迷宫各一条，
 * 整段匹配过程文字不动，学生不会以为弹窗跳戏了。
 */
export const MODE_SEARCH_LINES: Record<ModeId, string[]> = {
  debug: ['正在寻找实力相当的对手…', '扫描附近同段位的玩家…', '正在确认对手在线…'],
  golf: ['正在寻找同段位的极简主义大师…'],
  maze: ['正在寻找迷宫算法大师…'],
}

export type Opponent = { player: string; xp: number; streak: number }

/** 匹配池里的人名：都是榜单上见过的熟面孔，加几个散家 */
const OPPONENT_NAMES = [
  '极客小明',
  '夜航员的猫',
  'Ctrl_Alt_Dog',
  '小林同学',
  '半糖主义',
  '阿吉不加班',
  '递归怪兽',
  '指针打结中',
  '一行到底',
  '深夜改Bug',
]

/** 王者没有上界，封顶取榜首的 2680，免得匹配出个比第一名还高的对手 */
const TOP_XP = WEEKLY_BOARD[0].xp

/** 在指定段位区间里取一个 XP：段位由 XP 唯一决定，所以先定段位、再定 XP，等级自然跟着对上 */
function xpInRank(rankIndex: number) {
  const lo = RANKS[rankIndex].minXp
  const hi = rankIndex + 1 < RANKS.length ? RANKS[rankIndex + 1].minXp - 1 : TOP_XP
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/**
 * ±1 段位匹配：只从「低一段 / 同段 / 高一段」三档里等概率抽一档，再在那档里取 XP。
 * 边界靠 from/to 夹住——青铜（0）只会抽到青铜或白银，王者（6）只会抽到星耀或王者，
 * 不会出现青铜排到黄金、王者和新手对打。
 * 三个玩法共用这一个函数，所以规则不会哪张卡上就不灵了。
 */
export function rollOpponent(rankIndex: number): Opponent {
  const me = Math.min(Math.max(Math.trunc(rankIndex), 0), RANKS.length - 1)
  const from = Math.max(0, me - 1)
  const to = Math.min(RANKS.length - 1, me + 1)
  const band = from + Math.floor(Math.random() * (to - from + 1))
  const xp = xpInRank(band)
  return {
    player: OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)],
    xp,
    // 段位越高连胜期望也越长一点，读起来才像个真在打的人
    streak: Math.floor(Math.random() * (band + 3)),
  }
}
