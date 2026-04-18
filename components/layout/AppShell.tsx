'use client'

import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import BottomNav from './BottomNav'
import { getRouteMeta } from './navigation'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const routeMeta = getRouteMeta(pathname)

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f6f5f0]">

      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-12%] top-[-12%] h-[26rem] w-[26rem] rounded-full bg-[#d8f3dc]/70 blur-3xl" />
        <div className="absolute right-[-10%] top-[8%] h-[24rem] w-[24rem] rounded-full bg-[#dbeafe]/70 blur-3xl" />
        <div className="absolute bottom-[-8%] left-[18%] h-[20rem] w-[20rem] rounded-full bg-[#fef3c7]/60 blur-3xl" />
      </div>

      {/* ── Slim top header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <div
            className="mt-3 grid grid-cols-3 items-center rounded-2xl px-4 py-2.5"
            style={{
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.80)',
              boxShadow: '0 4px 24px rgba(148,163,184,0.1)',
            }}
          >
            {/* Left — brand wordmark */}
            <div className="font-display text-[17px] font-bold tracking-tight text-[#111827]">
              Vital<span className="text-[#2D6A4F]">IQ</span>
            </div>

            {/* Center — current page title */}
            <div className="text-center hidden sm:block">
              <div className="text-[13px] font-semibold text-[#111827] leading-tight">{routeMeta.title}</div>
              <div className="text-[10px] text-[#9ca3af] mt-0.5 tracking-wide">{routeMeta.description}</div>
            </div>
            {/* Mobile center — just the page title */}
            <div className="text-center block sm:hidden">
              <div className="text-[13px] font-semibold text-[#111827]">{routeMeta.title}</div>
            </div>

            {/* Right — date + settings avatar */}
            <div className="flex items-center justify-end gap-2">
              <div
                className="hidden sm:block rounded-xl px-3 py-1.5 text-[11px] font-semibold text-[#374151]"
                style={{ background: 'rgba(17,24,39,0.06)' }}
              >
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                }).format(new Date())}
              </div>

              {/* Profile / Settings avatar — always accessible */}
              <button
                onClick={() => router.push('/settings')}
                title="Settings & profile"
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold transition-all hover:scale-105 active:scale-95 ${
                  pathname === '/settings'
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-[#D8F3DC] text-[#2D6A4F] hover:bg-[#2D6A4F] hover:text-white'
                }`}
              >
                {initials}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto w-full max-w-[1180px] px-0 pb-28 pt-4 sm:px-6">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* ── Bottom nav — always visible ──────────────────────────────── */}
      <BottomNav />
    </div>
  )
}
