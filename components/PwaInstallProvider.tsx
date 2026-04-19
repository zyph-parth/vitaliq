'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const DISMISS_KEY = 'vitaliq_pwa_prompt_dismissed_until'
const INSTALLED_KEY = 'vitaliq_pwa_installed'
const DEFAULT_DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type InstallResult = 'accepted' | 'dismissed' | 'unavailable'

interface PwaInstallContextValue {
  isInstalled: boolean
  isIosSafari: boolean
  canInstall: boolean
  installing: boolean
  dismissedUntil: number
  requestInstall: () => Promise<InstallResult>
  dismissPrompt: (durationMs?: number) => void
  resetDismissal: () => void
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

function readDismissedUntil() {
  if (typeof window === 'undefined') return 0

  const raw = window.localStorage.getItem(DISMISS_KEY)
  if (!raw) return 0

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [dismissedUntil, setDismissedUntil] = useState(0)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIosSafari, setIsIosSafari] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setDismissedUntil(readDismissedUntil())
    setIsInstalled(isStandaloneMode() || window.localStorage.getItem(INSTALLED_KEY) === '1')

    const userAgent = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(userAgent)
    const safari = /safari/.test(userAgent) && !/crios|fxios|edgios|opr\//.test(userAgent)
    setIsIosSafari(ios && safari)

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => {
      if (mediaQuery.matches) {
        window.localStorage.setItem(INSTALLED_KEY, '1')
        setIsInstalled(true)
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, '1')
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    mediaQuery.addEventListener('change', handleDisplayModeChange)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      mediaQuery.removeEventListener('change', handleDisplayModeChange)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const dismissPrompt = (durationMs: number = DEFAULT_DISMISS_DURATION_MS) => {
    const until = Date.now() + durationMs
    window.localStorage.setItem(DISMISS_KEY, String(until))
    setDismissedUntil(until)
  }

  const resetDismissal = () => {
    window.localStorage.removeItem(DISMISS_KEY)
    setDismissedUntil(0)
  }

  const requestInstall = async (): Promise<InstallResult> => {
    if (!deferredPrompt) return 'unavailable'

    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice

      if (choice.outcome === 'accepted') {
        window.localStorage.setItem(INSTALLED_KEY, '1')
        setIsInstalled(true)
      }

      return choice.outcome
    } finally {
      setDeferredPrompt(null)
      setInstalling(false)
    }
  }

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      isInstalled,
      isIosSafari,
      canInstall: Boolean(deferredPrompt),
      installing,
      dismissedUntil,
      requestInstall,
      dismissPrompt,
      resetDismissal,
    }),
    [deferredPrompt, dismissedUntil, installing, isInstalled, isIosSafari]
  )

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext)
  if (!context) {
    throw new Error('usePwaInstall must be used within a PwaInstallProvider')
  }

  return context
}
