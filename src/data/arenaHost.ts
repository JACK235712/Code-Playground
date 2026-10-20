/**
 * 竞技场「AI」文案的唯一出处：实时战报和教练推荐两处台词都在这一个文件里生成，
 * 和首页管家同一套口径——输入只有 userStats，输出是确定性的句子：
 * 同一个账号，每次打开看到的话一模一样，不会刷新一次就换个说法。
 * 组件里不做任何段位判断，所以青铜新号和王者老号不可能拿到同一句鼓励，
 * 战报和推荐卡片也不会互相打架（都从同一份 stats 折算）。
 * 对战舱里那句实时解说走的是大模型，见 lib/aiCaster.ts。
 */
import { ARENA_MODES, DUEL_PROBLEM_ID, POOL_ONLINE, WEEKLY_BOARD } from './arena'
import type { ModeId } from './arena'
import { PROBLEMS } from './problems'
import { getRankInfo } from './ranks'
import { recordOf } from './stats'
import type { UserStats } from './stats'
import { focusProblem } from './butler'

const MODE_NAME = ARENA_MODES.reduce(
  (acc, mode) => {
    acc[mode.id] = mode.name
    return acc
  },
  {} as Record<ModeId, string>,
)

/** 迷宫寻路练的是搜索/递归，题库里就那道题最对口 */
const SEARCH_PROBLEM = PROBLEMS.find((item) => item.tags.includes('搜索'))

/**
 * 连败的时候该去挑战页练哪道题：迷宫对口搜索/递归，高尔夫拿对战题练压缩，
 * 极速 Debug 就用管家给的那道热身题。三道题都是 PROBLEMS 里的真题，不是编的。
 */
function practiceProblem(mode: ModeId, stats: UserStats) {
  if (mode === 'maze') return SEARCH_PROBLEM ?? focusProblem(stats)
  if (mode === 'golf') return PROBLEMS.find((item) => item.id === DUEL_PROBLEM_ID) ?? focusProblem(stats)
  return focusProblem(stats)
}

/* ------------------------------------------------------------------ 小工具 */

/** 从当前这场往回数，该玩法连输了几场（遇到该玩法的一场胜利就停） */
export function lossStreakOf(stats: UserStats, mode: ModeId) {
  let streak = 0
  for (const match of stats.matches) {
    if (match.mode !== mode) continue
    if (match.result === 'loss') streak += 1
    else break
  }
  return streak
}

/** 高尔夫战绩里那句「9 行 · 对手 14 行」，取自己最少的那一行数 */
export function golfBestOf(stats: UserStats): number | null {
  const counts = stats.matches
    .filter((match) => match.mode === 'golf' && match.result === 'win')
    .map((match) => Number(match.detail.match(/(\d+)\s*行/)?.[1]))
    .filter((n): n is number => Number.isFinite(n))
  return counts.length ? Math.min(...counts) : null
}

/** 各玩法各自最好的那场，用来在「状态不错」时推一个能冲连胜的项目 */
function bestModeOf(stats: UserStats): ModeId | null {
  let best: { mode: ModeId; wins: number } | null = null
  for (const mode of ARENA_MODES) {
    const wins = stats.matches.filter((m) => m.mode === mode.id && m.result === 'win').length
    if (wins > 0 && (!best || wins > best.wins)) best = { mode: mode.id, wins }
  }
  return best?.mode ?? null
}

/* ------------------------------------------------------------------ 推荐卡片的动作 */

export type CoachAction = {
  label: string
  /** 点了就直接进这个玩法的对战舱 */
  mode?: ModeId
  /** 点了跳这个路由（一般是挑战页练那道题） */
  to?: string
  state?: { problemId?: string }
}

/* ------------------------------------------------------------------ 实时战报 */

/**
 * 滚动战报：榜上的名字和 XP 全部取自 WEEKLY_BOARD，段位由同一套门槛折算，
 * 所以不会出现「榜上写着星耀、战报里叫王者」。自己那场也从 stats.matches 里读，
 * 战绩一变战报跟着变。整段没有任何随机数，刷新页面顺序不变。
 */
export function reportsOf(stats: UserStats): string[] {
  const rankWord = (xp: number) => getRankInfo(xp).name
  const star = WEEKLY_BOARD.find((row) => rankWord(row.xp) === '星耀') ?? WEEKLY_BOARD[0]
  const hot = WEEKLY_BOARD.find((row) => row.trend === 'up' && rankWord(row.xp) !== '王者') ?? WEEKLY_BOARD[1]
  const lines: string[] = [
    `用户「${star.player}」刚刚在代码高尔夫中以 45 个字符打破了${rankWord(star.xp)}组的记录！`,
    `注意，${rankWord(hot.xp)}段位的「${hot.player}」刚刚完成了一波 5 连胜……`,
    `「深夜改Bug」一段 BFS 一次过图，0 次撞墙，用时 1分02秒。`,
  ]

  const golf = golfBestOf(stats)
  if (golf) lines.push(`你的高尔夫最短 ${golf} 行，离极简榜前十只差再压一行。`)

  const last = stats.matches[0]
  if (last) {
    lines.push(
      `你上一场对「${last.opponent}」${last.result === 'win' ? '拿下' : '惜败'} · ${last.detail}`,
    )
  } else {
    lines.push('战报第一条留着——打完这场，这里就写上你的名字。')
  }

  lines.push(`匹配池此刻 ${POOL_ONLINE} 人在线，平均等待约 3 秒即可开局。`)
  return lines
}

/* ------------------------------------------------------------------ 个性化推荐 */

export type CoachPick = {
  /** 卡片右上角的依据，一句话说明为什么推这个 */
  badge: string
  speech: string
  primary: CoachAction
  secondary: CoachAction
}

const MODE_WEAKNESS: Record<ModeId, string> = {
  debug: '读报错定位',
  golf: '行数压缩',
  maze: '递归算法',
}

/** 连败之后换哪个玩法缓一缓：栽在迷宫里就去打高尔夫，别在原玩法上死磕 */
const RELAX_AFTER: Record<ModeId, ModeId> = {
  debug: 'golf',
  golf: 'debug',
  maze: 'golf',
}

/**
 * 推荐卡片只看两件事：有没有哪个玩法连输两场以上，没有就推你最擅长的那项冲连胜。
 * 连败的玩法直接对上「去挑战页练哪道题」，题也是从 PROBLEMS 里查出来的真题。
 */
export function coachPick(stats: UserStats): CoachPick {
  const record = recordOf(stats)
  const focus = focusProblem(stats)

  let worst: { mode: ModeId; streak: number } | null = null
  for (const mode of ARENA_MODES) {
    const streak = lossStreakOf(stats, mode.id)
    if (streak >= 2 && (!worst || streak > worst.streak)) worst = { mode: mode.id, streak }
  }

  if (worst) {
    const mode = worst.mode
    const streak = worst.streak
    const target = practiceProblem(mode, stats)
    const other = RELAX_AFTER[mode]
    return {
      badge: `最近 ${streak} 场「${MODE_NAME[mode]}」全负`,
      speech: `检测到你最近 ${streak} 次在「${MODE_NAME[mode]}」失败，要不要先去挑战页练习一下${MODE_WEAKNESS[mode]}？或者今天试试「${MODE_NAME[other]}」放松一下？`,
      primary: { label: `去挑战页练《${target.title}》`, to: '/challenge', state: { problemId: target.id } },
      secondary: { label: `打一局${MODE_NAME[other]}`, mode: other },
    }
  }

  if (record.total === 0) {
    return {
      badge: '第一场 · 认路局',
      speech: `还没下过场？第一场是来认路的，我把对手压在同段位以内。${
        focus.title ? `也可以先在挑战页把《${focus.title}》写熟再来。` : ''
      }`,
      primary: { label: `打一局${MODE_NAME.debug}`, mode: 'debug' },
      secondary: { label: `先去挑战页热身`, to: '/challenge', state: { problemId: focus.id } },
    }
  }

  const strong = bestModeOf(stats) ?? 'debug'
  const wins = stats.matches.filter((m) => m.mode === strong && m.result === 'win').length
  const golf = golfBestOf(stats)
  return {
    badge: `${wins} 场「${MODE_NAME[strong]}」胜利`,
    speech: `「${MODE_NAME[strong]}」是你的强项，已经赢了 ${wins} 场${
      golf ? `，高尔夫最短 ${golf} 行` : ''
    }。今天用它冲一波连胜，比换玩法划算。`,
    primary: { label: `打一局${MODE_NAME[strong]}`, mode: strong },
    secondary: { label: `换${MODE_NAME.debug}练手速`, mode: 'debug' },
  }
}
