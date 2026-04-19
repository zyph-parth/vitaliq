'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui'
import { usePwaInstall } from '@/components/PwaInstallProvider'

const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000
const HIDDEN_ROUTES = new Set(['/', '/login', '/onboarding', '/offline'])

export function PwaInstallPrompt() {
  const pathname = usePathname()
  const { isInstalled, isIosSafari, canInstall, installing, dismissedUntil, requestInstall, dismissPrompt } =
    usePwaInstall()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const canShowOnRoute = useMemo(() => !HIDDEN_ROUTES.has(pathname), [pathname])
  const canShow = mounted && canShowOnRoute && !isInstalled && dismissedUntil < Date.now()
  const shouldShowAndroidPrompt = canShow && canInstall
  const shouldShowIosPrompt = canShow && !canInstall && isIosSafari

  if (!shouldShowAndroidPrompt && !shouldShowIosPrompt) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] px-4 lg:left-auto lg:right-6 lg:w-[380px] lg:px-0"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
    >
      <div className="pointer-events-auto rounded-[28px] border border-white/85 bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_24px_60px_rgba(9,15,13,0.16)] backdrop-blur-xl">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2D6A4F_0%,#52B788_100%)] shadow-[0_12px_24px_rgba(45,106,79,0.22)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 12h2l3-9 4 18 3-12 2 3h4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2D6A4F]">
              Install VitalIQ
            </p>
            <h2 className="font-display text-[20px] font-semibold tracking-[-0.03em] text-[#111827]">
              {shouldShowAndroidPrompt ? 'Use VitalIQ like a real app' : 'Add VitalIQ to your Home Screen'}
            </h2>
          </div>
        </div>

        {shouldShowAndroidPrompt ? (
          <p className="text-sm leading-6 text-[#4B5563]">
            Install VitalIQ for faster launch, a cleaner full-screen experience, and one-tap access from your phone.
          </p>
        ) : (
          <div className="space-y-2 text-sm leading-6 text-[#4B5563]">
            <p>Open Safari’s Share menu, then choose <span className="font-semibold text-[#111827]">Add to Home Screen</span>.</p>
            <p>That gives you an app-style shortcut with the VitalIQ icon and standalone launch experience.</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {shouldShowAndroidPrompt ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => void requestInstall()}
                loading={installing}
              >
                Install App
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-4"
                onClick={() => dismissPrompt(DISMISS_DURATION_MS)}
              >
                Not now
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => dismissPrompt(DISMISS_DURATION_MS)}
              >
                Got it
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-4"
                onClick={() => dismissPrompt(DISMISS_DURATION_MS)}
              >
                Hide
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
