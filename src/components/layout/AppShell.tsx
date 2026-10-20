import { Outlet } from 'react-router-dom'
import { Backdrop } from './Backdrop'
import { Header } from './Header'
import { NavBar } from './NavBar'

/** Global chrome: backdrop + status bar + nav, with the routed page in the middle. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Backdrop />
      <Header />
      <NavBar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-[calc(4.5rem_+_env(safe-area-inset-top))] md:px-6 md:pb-32">
        <Outlet />
      </main>
    </div>
  )
}
