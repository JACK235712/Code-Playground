import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  login as loginAccount,
  loginAsGuest as guestAccount,
  readSession,
  register as registerAccount,
  signOut,
} from '../data/account'
import type { AuthResult, PlayerUser, RegisterResult } from '../data/account'
import { emptyStats, ensureStats, guestStats, purgeStats, readStats, writeStats } from '../data/stats'
import type { UserStats } from '../data/stats'

/** 会话 = 身份 + 这个账号自己的游戏数据，两者一起进出，页面不会读到「人换了数据没换」 */
type Session = { user: PlayerUser; stats: UserStats }

type AuthValue = {
  user: PlayerUser | null
  stats: UserStats | null
  isAuthed: boolean
  login: (input: { email: string; password: string }) => AuthResult
  register: (input: { nickname: string; email: string; password: string }) => RegisterResult
  enterAsGuest: () => AuthResult
  logout: () => void
  /** 挑战页判题通过后调这里：改 userStats → 写回 LocalStorage → 「我的」页面立刻跟着变 */
  patchStats: (patch: Partial<UserStats> | ((prev: UserStats) => UserStats)) => void
}

const AuthContext = createContext<AuthValue | null>(null)

/**
 * 会话在 useState 初始化时同步读 LocalStorage：
 * 这样首屏就能判断要不要拦截，不会出现「页面闪一下再被踢回登录页」。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const user = readSession()
    return user ? { user, stats: readStats(user.id) } : null
  })

  /** 游客发新档案，老账号保持原来的进度 */
  const settle = useCallback((result: AuthResult): AuthResult => {
    if (!result.ok) return result
    const stats = ensureStats(result.user.id, () => (result.user.guest ? guestStats() : emptyStats()))
    setSession({ user: result.user, stats })
    return result
  }, [])

  const login = useCallback(
    (input: { email: string; password: string }) => settle(loginAccount(input)),
    [settle],
  )
  /** 登录/游客才建会话；注册只写注册表，回来这里不登录 */
  const register = useCallback(
    (input: { nickname: string; email: string; password: string }) => registerAccount(input),
    [],
  )
  const enterAsGuest = useCallback(() => settle(guestAccount()), [settle])

  const logout = useCallback(() => {
    // 游客档是一次性的，退出就收走，别在设备上留一堆「游客_9527」
    if (session?.user.guest) purgeStats(session.user.id)
    signOut()
    setSession(null)
  }, [session])

  const patchStats = useCallback(
    (patch: Partial<UserStats> | ((prev: UserStats) => UserStats)) => {
      if (!session) return
      const next =
        typeof patch === 'function' ? patch(session.stats) : { ...session.stats, ...patch }
      writeStats(session.user.id, next)
      setSession({ user: session.user, stats: next })
    },
    [session],
  )

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      stats: session?.stats ?? null,
      isAuthed: session !== null,
      login,
      register,
      enterAsGuest,
      logout,
      patchStats,
    }),
    [session, login, register, enterAsGuest, logout, patchStats],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() 必须在 <AuthProvider> 内部调用')
  return ctx
}

/**
 * 已登录页面专用：RequireAuth 保证了会话不为空，
 * 这样各个页面不必到处写 `user?.` 和空态分支。
 */
export function useUser(): PlayerUser {
  const { user } = useAuth()
  if (!user) throw new Error('useUser() 只能在 RequireAuth 包住的页面里调用')
  return user
}

/** 当前登录账号的游戏数据；正式注册全 0 起步，游客账号自带满级体验档 */
export function useStats(): UserStats {
  const { stats } = useAuth()
  if (!stats) throw new Error('useStats() 只能在 RequireAuth 包住的页面里调用')
  return stats
}
