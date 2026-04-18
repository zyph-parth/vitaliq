'use client'

import { usePathname, useRouter } from 'next/navigation'
import { clsx } from 'clsx'

// 5 primary routes — perfect for a bottom bar
const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Home',
    href: '/dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'nutrition',
    label: 'Fuel',
    href: '/nutrition',
    icon: (_active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    ),
  },
  {
    id: 'coach',
    label: 'Coach',
    href: '/coach',
    isCenter: true, // special elevated treatment
    icon: (_active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'workout',
    label: 'Train',
    href: '/workout',
    icon: (_active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4v16M18 4v16M4 8h4M16 8h4M4 16h4M16 16h4" />
      </svg>
    ),
  },
  {
    id: 'progress',
    label: 'Progress',
    href: '/progress',
    icon: (_active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    // Fixed at bottom, centered, floats above content
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4 px-4 sm:pb-6 pointer-events-none">
      <nav
        className="pointer-events-auto flex items-center gap-1.5 rounded-[28px] px-[13px] py-2 shadow-[0_8px_40px_rgba(0,0,0,0.18)] sm:gap-2 sm:px-[18px]"
        style={{
          background: 'rgba(15, 15, 15, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          // ── Center Coach button — elevated pill with ring on active ───
          if (item.isCenter) {
            return (
              <div key={item.id} className="flex items-center gap-1.5 sm:gap-2.5">
                {/* Left divider */}
                <div className="w-px h-8 rounded-full bg-white/10" />

                <button
                  onClick={() => router.push(item.href)}
                  className="relative mx-1.5 flex flex-col items-center gap-1 sm:mx-2"
                  aria-label={item.label}
                >
                  {/* Outer glow ring when active */}
                  {isActive && (
                    <span className="absolute inset-[-3px] rounded-[18px] border border-[#52b788]/40 animate-pulse" />
                  )}
                  <div
                    className={`flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 active:scale-95 ${
                      isActive ? 'shadow-[0_0_20px_rgba(45,106,79,0.5)]' : 'hover:opacity-90'
                    }`}
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, #2D6A4F, #1a3d2f)'
                        : 'linear-gradient(135deg, #252525, #333)',
                      border: isActive
                        ? '1px solid rgba(82,183,136,0.35)'
                        : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <span className={isActive ? 'text-white' : 'text-white/55'}>
                      {item.icon(isActive)}
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors ${
                    isActive ? 'text-[#52b788]' : 'text-white/35'
                  }`}>
                    {item.label}
                  </span>
                </button>

                {/* Right divider */}
                <div className="w-px h-8 rounded-full bg-white/10" />
              </div>
            )
          }

          // ── Standard nav item ────────────────────────────────────────
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={clsx(
                'relative flex min-w-[76px] flex-col items-center justify-center gap-1 rounded-2xl px-[13px] py-2 transition-all duration-200 active:scale-95 sm:min-w-[84px] sm:px-[17px]',
                isActive
                  ? 'bg-white/10'
                  : 'hover:bg-white/[0.06]'
              )}
              aria-label={item.label}
            >
              {/* Active dot indicator */}
              {isActive && (
                <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-[#52b788]" />
              )}

              <span className={clsx(
                'transition-all duration-200',
                isActive ? 'text-white scale-105' : 'text-white/45 hover:text-white/70'
              )}>
                {item.icon(isActive)}
              </span>
              <span className={clsx(
                'text-[9px] font-bold tracking-widest uppercase transition-colors',
                isActive ? 'text-white' : 'text-white/30'
              )}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
