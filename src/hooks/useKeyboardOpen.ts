import { useEffect, useState } from 'react'

/**
 * True while the on-screen keyboard is covering part of the viewport.
 * The floating dock hides itself so a chat input never ends up behind the keyboard.
 */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => setOpen(window.innerHeight - vv.height > 140)
    sync()
    vv.addEventListener('resize', sync)
    return () => vv.removeEventListener('resize', sync)
  }, [])

  return open
}
