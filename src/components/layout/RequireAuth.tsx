import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * 未登录时把四大页面全部拦下来。`from` 记下原本要去的地址（含 query），
 * 登录成功后 AuthPage 用它把人送回原来那一页。
 */
export function RequireAuth() {
  const { isAuthed } = useAuth()
  const location = useLocation()

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <Outlet />
}
