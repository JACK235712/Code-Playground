/**
 * 「我的」页面的目录数据：只描述维度与徽章长什么样，不含任何人的成绩。
 * 每个账号真实考到多少分、拿到哪几枚徽章，存在 data/stats.ts 的 userStats 里。
 */

export type SkillId = 'logic' | 'syntax' | 'style' | 'algo' | 'creative'

/** 能力雷达的五个维度；AI 助教按最近 20 次提交打分，满分 100 */
export const SKILL_AXES: { id: SkillId; axis: string }[] = [
  { id: 'logic', axis: '逻辑思维' },
  { id: 'syntax', axis: '语法掌握' },
  { id: 'style', axis: '代码规范' },
  { id: 'algo', axis: '算法效率' },
  { id: 'creative', axis: '创造力' },
]

export type BadgeIconId = 'spark' | 'loop' | 'bug' | 'flame' | 'crown' | 'moon' | 'shield'

export type BadgeDef = {
  id: string
  name: string
  /** 悬浮/点按时的小提示：这枚徽章到底怎么来的 */
  desc: string
  icon: BadgeIconId
  /** 还没解锁时告诉他差在哪 */
  hint: string
}

export const BADGE_CATALOG: BadgeDef[] = [
  {
    id: 'b1',
    name: '初出茅庐',
    desc: '完成新手试炼：第一段能跑起来的代码',
    icon: 'spark',
    hint: '通关任意 1 题',
  },
  {
    id: 'b2',
    name: '循环大师',
    desc: '写出被导师评为「结构清晰」的完美循环',
    icon: 'loop',
    hint: '让导师夸一次你的循环',
  },
  {
    id: 'b3',
    name: 'Bug 终结者',
    desc: '累计独立修复 10 个报错，没抄答案',
    icon: 'bug',
    hint: '独立修掉 10 个报错',
  },
  {
    id: 'b4',
    name: '七日之约',
    desc: '连续 7 天都来写代码，一天没断',
    icon: 'flame',
    hint: '连续 7 天都来写代码',
  },
  {
    id: 'b5',
    name: '极客之巅',
    desc: '通关题库里全部困难题',
    icon: 'crown',
    hint: '通关全部困难题',
  },
  {
    id: 'b6',
    name: '午夜代码',
    desc: '在凌晨 0 点到 5 点之间提交过一次',
    icon: 'moon',
    hint: '凌晨 0–5 点提交一次',
  },
  {
    id: 'b7',
    name: '零报错通关',
    desc: '连续 3 道题一次跑通，全程零报错',
    icon: 'shield',
    hint: '连续 3 道题零报错',
  },
]
