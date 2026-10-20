import { useState } from 'react'
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Rocket,
  UserRound,
} from 'lucide-react'
import { Backdrop } from '../components/layout/Backdrop'
import { useAuth } from '../context/AuthContext'
import { dumpRegisteredUsers } from '../data/account'
import { cn } from '../lib/cn'

type Mode = 'login' | 'register'

const GLYPHS = [
  { text: 'while(alive) { write(); }', className: 'left-[4%] top-[30%]', delay: '0s' },
  { text: 'print("你好, 游乐场")', className: 'right-[4%] top-[24%]', delay: '1.4s' },
  { text: 'class Main { }', className: 'bottom-[22%] left-[6%]', delay: '2.6s' },
  { text: 'for(i=1;i<=100;i++)', className: 'bottom-[16%] right-[5%]', delay: '0.8s' },
]

function Field({
  label,
  icon: Icon,
  trailing,
  ...rest
}: {
  label: string
  icon: LucideIcon
  trailing?: ReactNode
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <span className="group relative block">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-neon-cyan" />
        <input
          {...rest}
          className={cn(
            'h-11 w-full rounded-xl border border-white/10 bg-ink-950/70 pl-10 text-sm text-slate-100 outline-none transition-all',
            'placeholder:text-slate-600 focus:border-neon-cyan/50 focus:bg-ink-950 focus:ring-2 focus:ring-neon-cyan/15',
            trailing ? 'pr-11' : 'pr-3',
          )}
        />
        {trailing}
      </span>
    </label>
  )
}

export default function AuthPage() {
  const { user, login, register, enterAsGuest } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('login')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from
  const target = from && from.startsWith('/') && from !== '/login' ? from : '/'

  if (user) return <Navigate to={target} replace />

  /**
   * 轻量异步表单提交：读输入 → 比对 LocalStorage 的 registered_users → 立刻写回提示。
   * 全程不碰 navigator.credentials / crypto 这些系统接口，也没有假延迟和转圈，
   * 点下去同一帧就能看到成功（跳首页）或失败（那行红字）。
   */
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (mode === 'login') {
      // 需求点名的排查日志：点登录那一刻把 registered_users 原文打到控制台
      dumpRegisteredUsers()
      const result = login({ email, password })
      if (!result.ok) setError(result.error)
      return
    }
    const result = register({ nickname, email, password })
    if (!result.ok) {
      setError(result.error)
      return
    }
    /* 注册不顺手登录：写完注册表就回登录 tab，邮箱密码留着让用户少敲一遍 */
    setMode('login')
  }

  const guest = () => {
    setError(null)
    const result = enterAsGuest()
    if (!result.ok) setError(result.error)
  }

  const swap = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <Backdrop />

      {/* 漂浮代码只在平板以上出现：窄屏卡片几乎占满宽度，字会压在文案上 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none overflow-hidden sm:block">
        {GLYPHS.map((glyph) => (
          <span
            key={glyph.text}
            style={{ animationDelay: glyph.delay }}
            className={cn('animate-float absolute font-mono text-xs text-white/10', glyph.className)}
          >
            {glyph.text}
          </span>
        ))}
      </div>

      <div className="relative w-full max-w-md">
        <header className="mb-5 flex items-center gap-3">
          <div className="relative">
            <div className="bg-gradient-to-br from-neon-cyan to-neon-violet grid h-11 w-11 place-items-center rounded-xl font-mono text-base font-black text-ink-900 shadow-glow">
              CP
            </div>
            <span className="absolute inset-0 overflow-hidden rounded-xl">
              <span className="animate-sheen-x absolute inset-y-0 w-1/3 bg-white/25 blur-sm" />
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black leading-tight tracking-wide">
              代码<span className="text-neon-cyan text-glow">游乐场</span>
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Code Playground · 手写你的第一段代码
            </p>
          </div>
        </header>

        <div className="neon-frame">
          <section className="glass rounded-2xl p-5 sm:p-6">
            <div role="tablist" aria-label="登录或注册" className="relative grid grid-cols-2 rounded-xl bg-ink-950/70 p-1 ring-1 ring-white/10">
              <span
                aria-hidden
                className={cn(
                  'absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-lg bg-gradient-to-r from-neon-cyan/25 to-neon-violet/25 ring-1 ring-neon-cyan/40 transition-transform duration-300',
                  mode === 'register' && 'translate-x-full',
                )}
              />
              {(['login', 'register'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => swap(key)}
                  className={cn(
                    'relative h-9 rounded-lg text-sm font-bold transition-colors',
                    mode === key ? 'text-white' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {key === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>

            {/* autocomplete="off"：不让浏览器把这张表当成凭据表单，免得它来凑自动填充/系统的码 */}
            <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate autoComplete="off">
              {mode === 'register' && (
                <Field
                  label="昵称"
                  icon={UserRound}
                  value={nickname}
                  maxLength={12}
                  placeholder="比如：代码游侠"
                  autoComplete="off"
                  onChange={(event) => setNickname(event.target.value)}
                />
              )}

              <Field
                label="邮箱"
                icon={Mail}
                type="email"
                inputMode="email"
                value={email}
                placeholder="you@example.com"
                autoComplete="off"
                onChange={(event) => setEmail(event.target.value)}
              />

              <Field
                label="密码"
                icon={Lock}
                type={reveal ? 'text' : 'password'}
                value={password}
                placeholder={mode === 'register' ? '至少 6 位' : '你的密码'}
                autoComplete="off"
                onChange={(event) => setPassword(event.target.value)}
                trailing={
                  <button
                    type="button"
                    onClick={() => setReveal((on) => !on)}
                    aria-label={reveal ? '隐藏密码' : '显示密码'}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:text-neon-cyan"
                  >
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3 py-2.5 text-xs leading-snug text-rose-200 ring-1 ring-rose-500/30"
                >
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="relative mt-1 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-violet text-sm font-black text-ink-950 shadow-glow transition-all hover:brightness-110 active:scale-[0.98]"
              >
                {mode === 'login' ? '登录并进入游乐场' : '注册并去登录'}
                <ArrowRight className="h-4 w-4" />
                <span className="animate-sheen-x absolute inset-y-0 w-1/4 bg-white/30 blur-md" />
              </button>
            </form>

            <div className="my-4 flex items-center gap-3 font-mono text-[10px] text-slate-600">
              <span className="h-px flex-1 bg-white/10" />
              或者
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={guest}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neon-lime/30 bg-neon-lime/5 text-sm font-bold text-neon-lime transition-all hover:border-neon-lime/60 hover:bg-neon-lime/10 active:scale-[0.98]"
            >
              <Rocket className="h-4 w-4" />
              极速游客体验
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
