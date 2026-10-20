/**
 * 首页「私人管家」的全部台词都出自这一个文件：
 * 输入只有 userStats 和当前时刻，输出是问候语和今日计划。组件里不做任何段位判断，
 * 所以青铜新号和王者老号不可能拿到同一句话，也不会出现「问候说你在冲铂金、
 * 今日计划却让你做入门题」——两边共用 focusProblem()，题目永远是同一道。
 */
import { DAILY_PROBLEM_ID } from './home'
import { WEEKLY_BOARD, boardPosition } from './arena'
import { DIFFICULTY_LABEL, PROBLEMS } from './problems'
import type { Problem } from './problems'
import { getRankInfo, levelOf } from './ranks'
import { recordOf, streakOf } from './stats'
import type { UserStats } from './stats'

export type Profile = {
  rankIndex: number
  rankName: string
  level: number
  cleared: number
  streak: number
  matches: number
  wins: number
  losses: number
  /** 距下一段的 XP；王者封顶时为 0 */
  remain: number
  nextName: string | null
  /** 青铜且一题没过：第一次来的新手 */
  isNew: boolean
  /** 白银及以上，或通关 5 题及以上 */
  isVeteran: boolean
  /** 钻石及以上 */
  isElite: boolean
  /** 王者：段位已经封顶 */
  isMax: boolean
}

export function profileOf(stats: UserStats): Profile {
  const rank = getRankInfo(stats.xp)
  const record = recordOf(stats)
  return {
    rankIndex: rank.index,
    rankName: rank.name,
    level: levelOf(stats.xp),
    cleared: stats.cleared,
    streak: streakOf(stats),
    matches: record.total,
    wins: record.wins,
    losses: record.losses,
    remain: rank.remain,
    nextName: rank.next?.name ?? null,
    isNew: rank.index === 0 && stats.cleared === 0,
    isVeteran: rank.index >= 1 || stats.cleared >= 5,
    isElite: rank.index >= 4,
    isMax: rank.isMax,
  }
}

export function timeGreet(hour: number) {
  if (hour < 5 || hour >= 23) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 13) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export type Greeting = {
  /** H1 里「，昵称」前面的那个词 */
  lead: string
  /** 管家开口说的完整一句 */
  text: string
}

function pool(difficulty: Problem['difficulty']) {
  return PROBLEMS.filter((item) => item.difficulty === difficulty && item.id !== DAILY_PROBLEM_ID)
}

/**
 * 老手专属的「那道一直留着的题」：中等难度里第一道考数组的题。
 * 问候语和今日计划都指向它，所以管家不会前后矛盾。
 */
const ARRAY_PROBLEM = PROBLEMS.find(
  (item) => item.difficulty === 'medium' && item.tags.includes('数组'),
)

/**
 * 今天该写哪一道题。按段位挑难度，并且永远避开「今日推荐」那张大卡已经占掉的题，
 * 免得首页出现两张一模一样的入口。
 */
export function focusProblem(stats: UserStats): Problem {
  const p = profileOf(stats)
  if (p.isElite) return pick(pool('hard'), p) ?? PROBLEMS[0]
  if (p.isVeteran) return ARRAY_PROBLEM ?? pick(pool('medium'), p) ?? PROBLEMS[0]
  if (p.isNew)
    return (
      PROBLEMS.find((item) => item.difficulty === 'easy' && item.tags.includes('循环')) ?? PROBLEMS[0]
    )
  return pick(pool('easy'), p) ?? PROBLEMS[0]
}

/** 用通关数取模：不同账号拿到不同的题，但同一个账号每次打开都是同一道 */
function pick(list: Problem[], p: Profile) {
  if (!list.length) return null
  return list[p.cleared % list.length]
}

export function greetingOf(hour: number, stats: UserStats): Greeting {
  const p = profileOf(stats)
  const time = timeGreet(hour)
  const focus = focusProblem(stats)

  if (p.isNew) {
    return { lead: '初次见面', text: `${time}，代码新手！我是你的专属管家，今天先从简单的循环开始吧？` }
  }

  if (p.isMax) {
    const pos = boardPosition(stats.xp)
    const toTop = Math.max(WEEKLY_BOARD[0].xp - stats.xp, 0)
    return {
      lead: time,
      text: `王者封顶也别松手——你现在是本周榜第 ${pos ?? '?'} 名，${
        toTop > 0 ? `离榜首还差 ${toTop} XP` : '榜首就是你'
      }，今天去竞技场守住手感？`,
    }
  }

  if (p.isElite) {
    return {
      lead: time,
      text: `${p.rankName} Lv.${p.level}，离${p.nextName}只差 ${p.remain} XP。今天一道${
        DIFFICULTY_LABEL[focus.difficulty]
      }《${focus.title}》就能顶上，要不要现在开个头？`,
    }
  }

  if (p.isVeteran) {
    const last = stats.matches[0]
    const recent = last
      ? `最近一场${last.result === 'win' ? '赢了' : '惜败'}`
      : `通关 ${p.cleared} 题`
    return {
      lead: p.matches > 0 || p.cleared > 0 ? '欢迎回来' : time,
      text: `${recent}，${p.rankName} Lv.${p.level}——今天要不要去挑战页用「导师提示」再啃一次《${focus.title}》？${
        p.streak >= 3 ? `连续打卡 ${p.streak} 天，别断在今天。` : ''
      }`,
    }
  }

  // 青铜但已经过了至少一题：门槛就在眼前，把差多少 XP 说清楚
  return {
    lead: time,
    text: `第 ${p.cleared} 题已经拿下，离${p.nextName}还差 ${p.remain} XP。今天再通关 1 道${
      DIFFICULTY_LABEL[focus.difficulty]
    }题就够得着了，写完这题就去？`,
  }
}

export type PlanStep = {
  id: string
  label: string
  text: string
  to: string
  state?: { problemId?: string }
}

export type DailyPlan = {
  intro: string
  steps: PlanStep[]
  outro: string
  /** 第一步那道题的真实奖励，面板右上角直接显示这两个数字 */
  rewardXp: number
  rewardCoins: number
}

export function dailyPlan(stats: UserStats): DailyPlan {
  const p = profileOf(stats)
  const focus = focusProblem(stats)

  const steps: PlanStep[] = [
    {
      id: 'solve',
      label: '第一步',
      text: `去挑战页完成 1 道${DIFFICULTY_LABEL[focus.difficulty]}题《${focus.title}》，预计 ${focus.minutes} 分钟。`,
      to: '/challenge',
      state: { problemId: focus.id },
    },
    {
      id: 'arena',
      label: '第二步',
      text:
        p.matches === 0
          ? '去竞技场匹配 1 次，试试手感。第一场是来认路的，不用怕输。'
          : `去竞技场匹配 1 次${p.losses > 0 ? '，上次输掉的那点不服，今天用手速写回来。' : '，把手感续上。'}`,
      to: '/arena',
    },
  ]

  if (p.isVeteran) {
    steps.push({
      id: 'review',
      label: '第三步',
      text: '回「我的」看一次雷达图，五项里最低的那项，明天专门补一道对应章节的题。',
      to: '/profile',
    })
  }

  return {
    intro: p.isNew
      ? '第一天，我把门槛放到最低，两步就能收工：'
      : `按你 ${p.rankName} Lv.${p.level}${p.cleared > 0 ? `、通关 ${p.cleared} 题` : ''} 的实际情况，今天这样安排：`,
    steps,
    outro: '完成后回来领取管家给你的专属奖励哦！',
    rewardXp: focus.rewardXp,
    rewardCoins: focus.rewardCoins,
  }
}
