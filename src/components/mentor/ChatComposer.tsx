import { useRef } from 'react'
import type { FormEvent } from 'react'
import { Send } from 'lucide-react'
import { cn } from '../../lib/cn'

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  className,
}: {
  value: string
  onChange: (next: string) => void
  onSend: (text: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSend(value)
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'flex items-center gap-2 border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-xl bg-ink-900/70 px-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-slate-600 focus:ring-neon-cyan/60"
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        aria-label="发送"
        className="bg-gradient-to-br from-neon-cyan to-neon-violet grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-950 shadow-glow transition disabled:opacity-40 disabled:shadow-none"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  )
}
