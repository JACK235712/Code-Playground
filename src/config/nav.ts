import { Gamepad2, Swords, Trophy, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Literal Tailwind classes per tab (kept here so JIT can see them) */
  active: {
    text: string
    pill: string
  }
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: '首页',
    icon: Gamepad2,
    active: {
      text: 'text-neon-cyan',
      pill: 'from-neon-cyan/25 to-neon-blue/10 shadow-glow',
    },
  },
  {
    to: '/challenge',
    label: '挑战',
    icon: Swords,
    active: {
      text: 'text-neon-violet',
      pill: 'from-neon-violet/25 to-neon-pink/10 shadow-glow-violet',
    },
  },
  {
    to: '/arena',
    label: '竞技场',
    icon: Trophy,
    active: {
      text: 'text-neon-amber',
      pill: 'from-neon-amber/25 to-neon-pink/10 shadow-glow-violet',
    },
  },
  {
    to: '/profile',
    label: '我的',
    icon: UserRound,
    active: {
      text: 'text-neon-pink',
      pill: 'from-neon-pink/25 to-neon-violet/10 shadow-glow-violet',
    },
  },
]
