import { getRankInfo, rankGradient } from '../data/ranks'
import { cn } from '../lib/cn'

/** 中文昵称取首字，ASCII 昵称取前两个字符（Ctrl_Alt_Dog → Ct） */
function initials(name: string) {
  return /^[A-Za-z0-9_]/.test(name) ? name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) : name.slice(0, 1)
}

/**
 * 头像底色就是段位的主题色渐变——排行榜、匹配弹窗、顶栏共用，
 * 所以只有累计 XP 一个入参，颜色永远和段位文字对得上。
 */
export function PlayerAvatar({
  name,
  xp,
  size = 'h-9 w-9 text-xs',
  className,
}: {
  name: string
  xp: number
  size?: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-bold uppercase text-ink-950 ring-1 ring-white/25',
        size,
        className,
      )}
      style={{ backgroundImage: rankGradient(getRankInfo(xp)) }}
    >
      {initials(name)}
    </span>
  )
}
