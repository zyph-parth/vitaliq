// lib/useDashboard.ts — Shared hook to avoid redundant /api/dashboard calls across pages
import { useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { withTimeZone } from '@/lib/client-time'
import { useStore } from '@/lib/store'

export function useDashboard() {
  const { status } = useSession()
  const dashboard = useStore(s => s.dashboard)
  const loading = useStore(s => s.dashboardLoading)
  const error = useStore(s => s.dashboardError)
  const setDashboard = useStore(s => s.setDashboard)
  const setLoading = useStore(s => s.setDashboardLoading)
  const setError = useStore(s => s.setDashboardError)
  const clearDashboard = useStore(s => s.clearDashboard)

  useEffect(() => {
    // FIX: Never fetch without an authenticated session — prevents a 401 loop
    // where the hook fires before the session is ready, gets a 401, and leaves
    // dashboard null forever.
    if (status !== 'authenticated') {
      setLoading(false)
      setError(null)
      return
    }

    // Already loaded — skip re-fetch
    if (dashboard || error) return

    setLoading(true)
    setError(null)
    fetch(withTimeZone('/api/dashboard'))
      .then(r => {
        if (r.status === 401) {
          setError('Your session expired. Please sign in again.')
          void signOut({ callbackUrl: '/login' })
          return null
        }

        return r.json().then((data) => ({ ok: r.ok, data }))
      })
      .then(result => {
        if (!result) return

        if (!result.ok) {
          setError(result.data?.error || 'Could not load your dashboard right now.')
          return
        }

        setDashboard(result.data)
        setError(null)
      })
      .catch(() => {
        setError('Could not load your dashboard right now.')
      })
      .finally(() => setLoading(false))
  }, [status, dashboard, error, setDashboard, setError, setLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  return { dashboard, loading, error, clearDashboard }
}
