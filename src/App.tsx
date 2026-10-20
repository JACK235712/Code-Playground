import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth } from './components/layout/RequireAuth'
import { AuthProvider } from './context/AuthContext'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const ChallengePage = lazy(() => import('./pages/ChallengePage'))
const ArenaPage = lazy(() => import('./pages/ArenaPage'))
const ArenaBattlePage = lazy(() => import('./pages/ArenaBattlePage'))
const ArenaRoomPage = lazy(() => import('./pages/ArenaRoomPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AnalystReportPage = lazy(() => import('./pages/AnalystReportPage'))

function RouteFallback() {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <span className="animate-glow-pulse font-mono text-xs uppercase tracking-[0.35em] text-neon-cyan">
        loading…
      </span>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Lazy><AuthPage /></Lazy>} />

          {/* 守卫包在外层：未登录时四大页面和兜底路由全部先被踢到 /login */}
          <Route element={<RequireAuth />}>
            {/* 对战舱在 AppShell 外面：全屏、没有顶栏也没有底部 Dock，退出靠页面自己的按钮 */}
            <Route path="arena/battle" element={<Lazy><ArenaBattlePage /></Lazy>} />

            <Route element={<AppShell />}>
              <Route index element={<Lazy><HomePage /></Lazy>} />
              <Route path="challenge" element={<Lazy><ChallengePage /></Lazy>} />
              <Route path="arena" element={<Lazy><ArenaPage /></Lazy>} />
              {/* 高尔夫和迷宫各自一间对战房，匹配成功后由弹窗跳进来 */}
              <Route path="arena/golf" element={<Lazy><ArenaRoomPage mode="golf" /></Lazy>} />
              <Route path="arena/maze" element={<Lazy><ArenaRoomPage mode="maze" /></Lazy>} />
              <Route path="profile" element={<Lazy><ProfilePage /></Lazy>} />
              {/* 雷达图上「生成专属训练报告」跳进来的训练报告页，还在 AppShell 里（顶栏和 Dock 都留着） */}
              <Route path="profile/report" element={<Lazy><AnalystReportPage /></Lazy>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}
