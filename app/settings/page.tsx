'use client'
// app/settings/page.tsx

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { Card, SectionHeader } from '@/components/ui'
import { usePwaInstall } from '@/components/PwaInstallProvider'
import { useStore } from '@/lib/store'
import { useDashboard } from '@/lib/useDashboard'
import { clsx } from 'clsx'

// HIGH 7: Editable profile form
const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'active', label: 'Very active' },
  { value: 'athlete', label: 'Athlete' },
]

const GOAL_OPTIONS = [
  { value: 'lose', label: 'Lose fat' },
  { value: 'muscle', label: 'Build muscle' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'longevity', label: 'Longevity' },
]

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()
  const { dashboard } = useDashboard()
  const { isInstalled, isIosSafari, canInstall, installing, requestInstall, resetDismissal } = usePwaInstall()
  const clearDashboard = useStore((s) => s.clearDashboard)
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [dataMsg, setDataMsg] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // HIGH 7: Edit stats state
  const [showEditStats, setShowEditStats] = useState(false)
  const [editForm, setEditForm] = useState({
    age: '',
    weightKg: '',
    heightCm: '',
    activityLevel: 'moderate',
    goal: 'maintain',
  })
  const [statsPrefilled, setStatsPrefilled] = useState(false)
  const [statsMsg, setStatsMsg] = useState('')
  const [statsSaving, setStatsSaving] = useState(false)
  const [installMsg, setInstallMsg] = useState('')
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedUnits = localStorage.getItem('vitaliq_units') as 'metric' | 'imperial' | null
      if (savedUnits) setUnits(savedUnits)
    } catch { /* ignore */ }
  }, [])

  // Pre-fill edit form from the shared dashboard cache when the panel opens
  useEffect(() => {
    if (!showEditStats) {
      setStatsPrefilled(false)
      return
    }

    if (statsPrefilled || !dashboard?.user) return

    setEditForm({
      age: String(dashboard.user.age ?? ''),
      weightKg: String(dashboard.user.weightKg ?? ''),
      heightCm: String(dashboard.user.heightCm ?? ''),
      activityLevel: dashboard.user.activityLevel ?? 'moderate',
      goal: dashboard.user.goal ?? 'maintain',
    })
    setStatsPrefilled(true)
  }, [dashboard, showEditStats, statsPrefilled])

  const handleSave = () => {
    setSaving(true)
    setSaveMsg('')
    try {
      localStorage.setItem('vitaliq_units', units)
      localStorage.removeItem('vitaliq_theme')
      setSaveMsg('Preferences saved ✓')
    } catch {
      setSaveMsg('Could not save — check browser storage permissions.')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const handleInstallVitaliq = async () => {
    setInstallMsg('')

    if (isInstalled) {
      setInstallMsg('VitalIQ is already installed on this device.')
      return
    }

    if (canInstall) {
      resetDismissal()
      const outcome = await requestInstall()

      if (outcome === 'accepted') {
        setInstallMsg('VitalIQ was added successfully.')
      } else if (outcome === 'dismissed') {
        setInstallMsg('Install was dismissed. You can try again any time from Settings.')
      } else {
        setInstallMsg('Install is not available right now. Refresh once and try again.')
      }
      return
    }

    if (isIosSafari) {
      setShowIosInstallHelp(true)
      setInstallMsg('Use Safari Share → Add to Home Screen to install VitalIQ.')
      return
    }

    setInstallMsg('Install becomes available in a supported browser like Chrome once the app is install-ready.')
  }

  // HIGH 7: Save updated stats to PATCH /api/user
  const handleSaveStats = async () => {
    setStatsSaving(true)
    setStatsMsg('')

    const age = parseInt(editForm.age)
    const weightKg = parseFloat(editForm.weightKg)
    const heightCm = parseFloat(editForm.heightCm)

    if (isNaN(age) || age < 10 || age > 120) {
      setStatsMsg('Age must be between 10 and 120.')
      setStatsSaving(false)
      return
    }
    if (isNaN(weightKg) || weightKg <= 0 || weightKg > 500) {
      setStatsMsg('Weight must be between 0 and 500 kg.')
      setStatsSaving(false)
      return
    }
    if (isNaN(heightCm) || heightCm < 100 || heightCm > 250) {
      setStatsMsg('Height must be between 100 and 250 cm.')
      setStatsSaving(false)
      return
    }

    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age,
          weightKg,
          heightCm,
          activityLevel: editForm.activityLevel,
          goal: editForm.goal,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setStatsMsg(err.error || 'Failed to save. Try again.')
        return
      }

      setStatsMsg('Stats updated ✓')
      await updateSession() // refresh next-auth session to reflect name changes
      clearDashboard()
      setTimeout(() => {
        setShowEditStats(false)
        setStatsMsg('')
      }, 1500)
    } catch {
      setStatsMsg('Network error. Try again.')
    } finally {
      setStatsSaving(false)
    }
  }

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <AppShell>
      {/* Premium Hero */}
      <section className="px-4 pb-6 pt-2 lg:px-0 lg:pt-2">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(140deg,#f8f7f2_0%,#fafaf7_46%,#f0fdf4_100%)] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                Account settings
              </div>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-[#111827] sm:text-[3rem]">
                {session?.user?.name?.split(' ')[0] || 'Your'} workspace.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#4b5563] sm:text-[15px]">
                Manage your profile, preferences, and account controls.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[440px]">
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Account</div>
                <div className="mt-2 font-display text-[1.15rem] font-semibold text-[#111827] truncate">
                  {session?.user?.name || 'User'}
                </div>
                <div className="text-xs text-[#6b7280] truncate">{session?.user?.email || ''}</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Units</div>
                <div className="mt-2 font-display text-[1.5rem] font-semibold capitalize text-[#111827]">{units}</div>
                <div className="text-xs text-[#6b7280]">current preference</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-[#111827] p-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Version</div>
                <div className="mt-2 font-display text-[1.5rem] font-semibold">v2.0</div>
                <div className="text-xs text-white/60">VitalIQ</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profile */}
      <div className="mx-4 mb-4">
        <Card padding="md">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#D8F3DC] flex items-center justify-center font-bold text-[#2D6A4F] text-[18px] flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[16px] truncate">{session?.user?.name || 'User'}</div>
              <div className="text-[13px] text-[#8A8A85] truncate">{session?.user?.email || ''}</div>
            </div>
            <button
              onClick={() => setShowEditStats(v => !v)}
              className="px-4 py-2 rounded-xl bg-[#F1F1EC] text-[12px] font-semibold text-[#3D3D3A] hover:bg-[#E8E8E3] transition-colors flex-shrink-0"
            >
              {showEditStats ? 'Close' : 'Update stats'}
            </button>
          </div>

          {/* HIGH 7: Inline stats edit form */}
          {showEditStats && (
            <div className="mt-5 pt-5 border-t border-[#F1F1EC]">
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  { label: 'Age', key: 'age', type: 'number', placeholder: '25' },
                  { label: 'Weight (kg)', key: 'weightKg', type: 'number', placeholder: '75.0' },
                  { label: 'Height (cm)', key: 'heightCm', type: 'number', placeholder: '175' },
                ].map(field => (
                  <div key={field.key}>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#8A8A85] mb-1.5">{field.label}</div>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={editForm[field.key as keyof typeof editForm]}
                      onChange={e => setEditForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E8E8E3] text-[14px] outline-none focus:border-[#2D6A4F] transition-colors"
                    />
                  </div>
                ))}

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-[#8A8A85] mb-1.5">Activity</div>
                  <select
                    value={editForm.activityLevel}
                    onChange={e => setEditForm(f => ({ ...f, activityLevel: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E8E8E3] text-[13px] outline-none focus:border-[#2D6A4F] bg-white transition-colors"
                  >
                    {ACTIVITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-[#8A8A85] mb-1.5">Goal</div>
                <div className="flex gap-2 flex-wrap">
                  {GOAL_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setEditForm(f => ({ ...f, goal: o.value }))}
                      className={clsx(
                        'px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all',
                        editForm.goal === o.value ? 'bg-[#1A1A1A] text-white' : 'bg-[#F1F1EC] text-[#8A8A85] hover:bg-[#E8E8E3]'
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {statsMsg && (
                <div className={clsx(
                  'mb-3 px-3 py-2 rounded-xl text-[12px] font-medium',
                  statsMsg.includes('✓') ? 'bg-[#D8F3DC] text-[#2D6A4F]' : 'bg-[#FEE2E2] text-[#DC4A3D]'
                )}>
                  {statsMsg}
                </div>
              )}

              <button
                onClick={handleSaveStats}
                disabled={statsSaving}
                className="w-full py-3 rounded-2xl bg-[#1A1A1A] text-white text-[13px] font-semibold hover:bg-[#2D6A4F] transition-colors disabled:opacity-50"
              >
                {statsSaving ? 'Saving…' : 'Recalculate stats'}
              </button>
              <p className="text-center text-[11px] text-[#8A8A85] mt-2">
                BMI, TDEE, and macro targets will be recomputed automatically.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Preferences */}
      <SectionHeader title="Preferences" />
      <div className="mx-4 mb-6">
        <Card padding="md">
          {/* Units */}
          <div>
            <div className="text-[13px] font-semibold mb-2">Units</div>
            <div className="flex gap-2">
              {(['metric', 'imperial'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setUnits(u)}
                  className={clsx(
                    'flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all',
                    units === u ? 'bg-[#1A1A1A] text-white' : 'bg-[#F1F1EC] text-[#8A8A85] hover:bg-[#E8E8E3]'
                  )}
                >
                  {u === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lbs, in)'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#8A8A85] mt-2">
              Affects display in Progress and Dashboard. Core calculations always use metric internally.
            </p>
          </div>

          <div className="mt-5 border-t border-[#F1F1EC] pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">Install VitalIQ</div>
                <p className="mt-1 text-[11px] leading-5 text-[#8A8A85]">
                  Keep VitalIQ on your home screen for faster launch and a cleaner app-like experience.
                </p>
              </div>
              <span
                className={clsx(
                  'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                  isInstalled ? 'bg-[#D8F3DC] text-[#2D6A4F]' : 'bg-[#F1F1EC] text-[#6B7280]'
                )}
              >
                {isInstalled ? 'Installed' : 'Available'}
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void handleInstallVitaliq()}
                disabled={installing || isInstalled}
                className="flex-1 rounded-2xl bg-[#1A1A1A] px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#2D6A4F] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isInstalled ? 'Installed on this device' : installing ? 'Opening install…' : 'Install VitalIQ'}
              </button>
              {!isInstalled && (
                <button
                  onClick={() => {
                    resetDismissal()
                    setInstallMsg('Install prompt reset. If your browser supports it, VitalIQ can prompt again.')
                  }}
                  className="rounded-2xl border border-[#E8E8E3] px-4 py-3 text-[12px] font-semibold text-[#6B7280] transition-colors hover:border-[#2D6A4F] hover:text-[#2D6A4F]"
                >
                  Reset prompt
                </button>
              )}
            </div>

            {showIosInstallHelp && !isInstalled && (
              <div className="mt-3 rounded-2xl border border-[#E8E8E3] bg-[#FAFAF7] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B7280]">iPhone steps</div>
                <p className="mt-2 text-[12px] leading-6 text-[#4B5563]">
                  Open Safari&apos;s Share menu, then choose <span className="font-semibold text-[#111827]">Add to Home Screen</span>.
                </p>
              </div>
            )}

            {installMsg && (
              <p className="mt-3 text-[12px] text-[#6B7280] leading-relaxed">{installMsg}</p>
            )}
          </div>

        </Card>
      </div>

      {/* Save preferences */}
      <div className="mx-4 mb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-[#1A1A1A] text-white text-[14px] font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
        {saveMsg && (
          <p className="text-center text-[12px] text-[#2D6A4F] mt-2 font-medium">{saveMsg}</p>
        )}
      </div>

      {/* Data & privacy */}
      <SectionHeader title="Data &amp; privacy" />
      <div className="mx-4 mb-4">
        <Card padding="none">
          <button
            onClick={() => {
              setDataMsg('Data export is coming soon. Your data is securely stored in your private Supabase database.')
              setTimeout(() => setDataMsg(''), 4000)
            }}
            className="w-full flex items-center gap-3 p-4 text-left border-b border-[#F1F1EC] hover:bg-[#FAFAF7] transition-colors"
          >
            <span className="text-[18px]">📤</span>
            <div>
              <div className="text-[14px] font-medium">Export my data</div>
              <div className="text-[11px] text-[#8A8A85] mt-0.5">Download all your health logs as JSON</div>
            </div>
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#FEE2E2] transition-colors"
            >
              <span className="text-[18px]">🗑️</span>
              <div>
                <div className="text-[14px] font-medium text-[#DC4A3D]">Delete account</div>
                <div className="text-[11px] text-[#8A8A85] mt-0.5">Permanently erase all data</div>
              </div>
            </button>
          ) : (
            <div className="p-4 bg-[#FEE2E2]">
              <p className="text-[13px] font-semibold text-[#DC4A3D] mb-1">This cannot be undone.</p>
              <p className="text-[12px] text-[#DC4A3D]/70 mb-3">All health logs, streaks, and AI context will be permanently deleted.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDataMsg('Account deletion is not yet available. Please contact support at help@vitaliq.app')
                    setTimeout(() => setDataMsg(''), 5000)
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#DC4A3D] text-white text-[12px] font-semibold hover:bg-[#c73d31] transition-colors"
                >
                  Yes, delete everything
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-xl bg-white border border-[#E8E8E3] text-[12px] font-semibold hover:bg-[#F1F1EC] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
        {dataMsg && (
          <p className="mt-2 text-[12px] text-[#6b7280] text-center leading-relaxed">{dataMsg}</p>
        )}
      </div>

      {/* Sign out */}
      <div className="mx-4 mb-8">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full py-3.5 rounded-2xl border border-[#E8E8E3] text-[14px] font-semibold text-[#8A8A85] hover:border-[#DC4A3D] hover:text-[#DC4A3D] transition-all"
        >
          Sign out
        </button>
        <p className="text-center text-[11px] text-[#8A8A85] mt-4">
          VitalIQ v2.0 · Built with ❤️ · Powered by Gemini AI
        </p>
      </div>
    </AppShell>
  )
}
