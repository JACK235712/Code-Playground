/**
 * Ambient cyber backdrop: grid, drifting glow orbs and a scanline wash.
 * Fixed and pointer-events-none so pages can scroll beneath it.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-ink-900" />

      <div className="bg-grid-tech animate-grid-drift absolute inset-0 [background-size:44px_44px] opacity-60" />

      <div className="animate-float absolute -left-24 top-[-10%] h-72 w-72 rounded-full bg-neon-cyan/20 blur-[110px]" />
      <div
        className="animate-float absolute right-[-12%] top-1/3 h-80 w-80 rounded-full bg-neon-violet/20 blur-[120px]"
        style={{ animationDelay: '1.8s' }}
      />
      <div
        className="animate-float absolute bottom-[-8%] left-1/3 h-64 w-64 rounded-full bg-neon-pink/15 blur-[110px]"
        style={{ animationDelay: '3.2s' }}
      />

      {/* vignette keeps the glow from washing out text */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_35%,rgba(4,6,14,0.85)_100%)]" />
    </div>
  )
}
