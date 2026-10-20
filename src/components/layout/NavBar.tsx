import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../config/nav'
import { cn } from '../../lib/cn'
import { useKeyboardOpen } from '../../hooks/useKeyboardOpen'

/**
 * One nav, two shapes:
 *  - < 768px : full-width bar pinned to the bottom edge (native-app feel)
 *  - >= 768px: the same markup collapses into a floating capsule dock, centred
 *
 * Keeping a single component means the active/glow state is defined once.
 */
export function NavBar() {
  const keyboardOpen = useKeyboardOpen()

  return (
    <nav
      aria-label="主导航"
      className={cn(
        'pb-safe fixed inset-x-0 bottom-0 z-40 transition-transform duration-200 md:bottom-6 md:pb-0',
        keyboardOpen && 'translate-y-full',
      )}
    >
      <ul className="glass flex w-full items-stretch justify-between gap-1 border-x-0 border-b-0 px-2 md:mx-auto md:w-fit md:justify-center md:gap-1.5 md:rounded-full md:border md:border-white/10 md:px-2 md:py-2 md:shadow-dock">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1 md:flex-none">
            <NavLink to={item.to} end={item.to === '/'} className="block h-full">
              {({ isActive }) => {
                const Icon = item.icon
                return (
                  <span
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-all duration-300',
                      'md:h-11 md:flex-row md:gap-2 md:rounded-full md:px-4',
                      isActive
                        ? cn(
                            'bg-gradient-to-br scale-[1.04] ring-1 ring-white/20 md:scale-100 md:-translate-y-0.5',
                            item.active.pill,
                            item.active.text,
                          )
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 active:scale-95',
                    )}
                  >
                    <Icon
                      className={cn('h-5 w-5 shrink-0', isActive && 'drop-shadow-[0_0_8px_currentColor]')}
                      strokeWidth={isActive ? 2.4 : 1.9}
                    />
                    <span
                      className={cn(
                        'text-[11px] font-semibold leading-none tracking-wide',
                        isActive ? 'opacity-100' : 'opacity-80',
                      )}
                    >
                      {item.label}
                    </span>

                    {isActive && (
                      <>
                        {/* travelling sheen inside the active pill */}
                        <span className="absolute inset-0 overflow-hidden rounded-2xl md:rounded-full">
                          <span className="animate-sheen-x absolute inset-y-0 w-1/3 bg-white/20 blur-[6px]" />
                        </span>
                        {/* mobile: underline beam, tinted by the active accent */}
                        <span className="absolute -bottom-0.5 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-current opacity-90 blur-[0.3px] md:hidden" />
                      </>
                    )}
                  </span>
                )
              }}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
