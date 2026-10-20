import { PROBLEMS, findProblem } from './problems'

/** 首页「每日推荐」指向题库里的哪一道题——点开始挑战会把这道题的 ID 一起带过去 */
export const DAILY_PROBLEM_ID = 'p8'

export const DAILY_PROBLEM = findProblem(DAILY_PROBLEM_ID) ?? PROBLEMS[0]

/** 推荐卡片右侧那段假编辑器预览，纯粹是氛围道具 */
export const DAILY_PREVIEW = [
  'import turtle as t',
  't.speed("fastest")',
  'def circle(r):',
  '    t.circle(r)',
  'circle(120)  # 脸',
]

export type FeedKind = 'badge' | 'streak' | 'level' | 'victory'

export type Achievement = {
  id: string
  player: string
  title: string
  detail: string
  minutesAgo: number
  kind: FeedKind
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'a1',
    player: '极客小明',
    title: '数组去重',
    detail: '完成关卡并零报错通过全部用例',
    minutesAgo: 2,
    kind: 'badge',
  },
  {
    id: 'a2',
    player: '夜航员的猫',
    title: '霓虹灯按钮',
    detail: '用纯 CSS 通关，用时 11 分钟',
    minutesAgo: 6,
    kind: 'victory',
  },
  {
    id: 'a3',
    player: '小林同学',
    title: '连续打卡 30 天',
    detail: '解锁徽章「铁杵磨针」',
    minutesAgo: 14,
    kind: 'streak',
  },
  {
    id: 'a4',
    player: '半糖主义',
    title: 'Lv.7 → Lv.8',
    detail: '靠三道递归挑战升级',
    minutesAgo: 23,
    kind: 'level',
  },
  {
    id: 'a5',
    player: 'Ctrl_Alt_Dog',
    title: '斐波那契迷宫',
    detail: '手写解法被导师评为「结构清晰」',
    minutesAgo: 38,
    kind: 'badge',
  },
  {
    id: 'a6',
    player: '阿吉不加班',
    title: '竞技场周赛',
    detail: '128 强晋级，收获 300 金币',
    minutesAgo: 52,
    kind: 'victory',
  },
]

export const MENTOR_PROMPTS = ['这道题该从哪里下手？', '我的循环一直报错怎么办？', '怎样让代码写得更优雅？']

/** 首页导师卡片上那三个灵感气泡：点一下就直接带着这句话去找小游 */
export const HOME_QUICK_PROMPTS = ['今天能学点什么？', '我代码报错了怎么办？', '我想挑战难题']
