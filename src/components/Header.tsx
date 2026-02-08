export function Header() {
  return (
    <header className="panel relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
        Privacy-first, offline
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
        Compress To Target Size
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
        Tune image size precisely in your browser with a binary-search quality algorithm. Files
        never leave your device.
      </p>
    </header>
  )
}
