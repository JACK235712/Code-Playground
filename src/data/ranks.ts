/**
 * 段位体系：段位由「累计经验值」唯一决定，全站只认 getRankInfo 这一个入口。
 *
 * 等级同样从累计 XP 推导（升到 Lv.N 需要 20N² + 80N 经验），竞技场榜单里 NPC 的
 * 积分也按同一套门槛折算——所以名片、顶栏、排行榜不可能各说各话，
 * 也不会有人「段位是王者、等级还是 Lv.1」。
 */

export type RankId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'star' | 'king'

export type Rank = {
  id: RankId
  /** 名片上那个巨大的段位字 */
  name: string
  /** 完整称号，放在段位字下面 */
  title: string
  /** 专属主题色，所有发光、描边都从它派生 */
  color: string
  /** 头像/进度条渐变的终点色 */
  colorTo: string
  /** 达到本段位所需的累计 XP */
  minXp: number
}

export const RANKS: Rank[] = [
  { id: 'bronze', name: '青铜', title: '青铜码农', color: '#CD7F32', colorTo: '#7A4520', minXp: 0 },
  { id: 'silver', name: '白银', title: '白银极客', color: '#C0C0C0', colorTo: '#7C8AA5', minXp: 100 },
  { id: 'gold', name: '黄金', title: '黄金架构师', color: '#FFD700', colorTo: '#C98A00', minXp: 300 },
  { id: 'platinum', name: '铂金', title: '铂金代码匠', color: '#00CED1', colorTo: '#0A6E85', minXp: 600 },
  { id: 'diamond', name: '钻石', title: '钻石算法师', color: '#00BFFF', colorTo: '#1E50C8', minXp: 1000 },
  { id: 'star', name: '星耀', title: '星耀黑客', color: '#9370DB', colorTo: '#5B2E9E', minXp: 1500 },
  { id: 'king', name: '王者', title: '手写之巅 · 本赛季封顶', color: '#FF4500', colorTo: '#FFD700', minXp: 2200 },
]

export type RankInfo = Rank & {
  /** 这一档在七段体系里的下标（0 青铜 … 6 王者）；竞技场的 ±1 匹配按它算 */
  index: number
  /** 下一个段位；王者为 null */
  next: Rank | null
  /** 距下一段还差多少 XP；王者恒为 0 */
  remain: number
  /** 当前段位内的进度百分比，王者恒为 100 */
  pct: number
  isMax: boolean
}

/** 传进任何 XP/积分都能拿到段位信息——榜单用它折算 NPC 段位，名片用它算进度条 */
export function getRankInfo(xp: number): RankInfo {
  const total = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0))
  let index = 0
  for (let i = 0; i < RANKS.length; i += 1) if (total >= RANKS[i].minXp) index = i

  const rank = RANKS[index]
  const next = index + 1 < RANKS.length ? RANKS[index + 1] : null
  if (!next) return { ...rank, index, next: null, remain: 0, pct: 100, isMax: true }

  const span = next.minXp - rank.minXp
  return {
    ...rank,
    index,
    next,
    remain: next.minXp - total,
    pct: Math.min(Math.round(((total - rank.minXp) / span) * 100), 100),
    isMax: false,
  }
}

/** 升到 Lv.N 所需的累计经验：Lv.1 = 100，Lv.5 = 900，Lv.9 = 2340 */
export function xpToReachLevel(level: number) {
  return 20 * level * level + 80 * level
}

export function levelOf(xp: number) {
  const total = Math.max(0, Math.floor(xp))
  let level = 0
  while (level < 99 && xpToReachLevel(level + 1) <= total) level += 1
  return level
}

/** 主题色 + 透明度（AA 是两位十六进制，如 '59' ≈ 35%） */
export function withAlpha(color: string, aa: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? `${color}${aa}` : color
}

/** 头像和进度条都用的斜向渐变 */
export function rankGradient(rank: Rank, angle = 135) {
  return `linear-gradient(${angle}deg, ${rank.color}, ${rank.colorTo})`
}
