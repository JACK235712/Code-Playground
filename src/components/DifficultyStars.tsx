import { Star } from 'lucide-react'
import { cn } from '../lib/cn'

export function DifficultyStars({
  value,
  max = 5,
  size = 'h-3.5 w-3.5',
}: {
  value: number
  max?: number
  size?: string
}) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`难度 ${value} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(size, i < value ? 'fill-neon-amber text-neon-amber' : 'text-white/15')}
          strokeWidth={1.6}
        />
      ))}
    </span>
  )
}
