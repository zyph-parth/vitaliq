// lib/useDashboard.ts — Shared hook to avoid redundant /api/dashboard calls across pages
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useStore } from '@/lib/store'

export function useDashboard() {
  const { status } = useSession()
  const dashboard = useStore(s => s.dashboard)
  const loading = useStore(s => s.dashboardLoading)
  const setDashboard = useStore(s => s.setDashboard)
  const setLoading = useStore(s => s.setDashboardLoading)
  const clearDashboard = useStore(s => s.clearDashboard)

  useEffect(() => {
    // FIX: Never fetch without an authenticated session — prevents a 401 loop
    // where the hook fires before the session is ready, gets a 401, and leaves
    // dashboard null forever.
    if (status !== 'authenticated') return

    // Already loaded — skip re-fetch
    if (dashboard) return

    setLoading(true)
    fetch('/api/dashboard')
      .then(r => {
        if (!r.ok) {
          // 401 means token expired / missing — don't crash, just leave null
          // so the page falls back to its own error state
          if (r.status === 401) return null
          return r.json().catch(() => null)
        }
        return r.json()
      })
      .then(data => { if (data) setDashboard(data) })
      .catch(() => { /* network error — dashboard stays null, pages show skeletons */ })
      .finally(() => setLoading(false))
  }, [status, dashboard]) // eslint-disable-line react-hooks/exhaustive-deps

  return { dashboard, loading, clearDashboard }
}
