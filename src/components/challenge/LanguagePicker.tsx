import { ChevronDown } from 'lucide-react'
import { LANGUAGES, LANG_ORDER } from '../../data/languages'
import type { LangId } from '../../data/languages'

export function LanguagePicker({
  value,
  onChange,
}: {
  value: LangId
  onChange: (lang: LangId) => void
}) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">切换编程语言</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as LangId)}
        className="h-8 appearance-none rounded-lg border border-neon-violet/35 bg-neon-violet/10 pl-2.5 pr-7 font-mono text-xs font-bold text-neon-violet outline-none transition-colors hover:bg-neon-violet/20 focus-visible:ring-2 focus-visible:ring-neon-violet/50"
      >
        {LANG_ORDER.map((id) => (
          <option key={id} value={id} className="bg-ink-900 text-slate-100">
            {LANGUAGES[id].label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-neon-violet" />
    </label>
  )
}
