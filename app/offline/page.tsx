export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#08110D] text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#2D6A4F_0%,#52B788_100%)] shadow-[0_0_40px_rgba(82,183,136,0.25)]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 12h2l3-9 4 18 3-12 2 3h4"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8BD6AF]">
          Offline Mode
        </p>
        <h1 className="mb-4 text-4xl font-bold tracking-[-0.04em] text-white">VitalIQ is temporarily offline</h1>
        <p className="max-w-xl text-sm leading-7 text-white/70">
          You can still reopen the app shell from your device, but live dashboard data, coach responses, and synced
          logs need a network connection. Once you are back online, refresh and everything will reconnect normally.
        </p>
        <a
          href="/"
          className="mt-8 inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Try again
        </a>
      </div>
    </main>
  )
}
