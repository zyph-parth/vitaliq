'use client'
// app/progress/page.tsx

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '@/components/layout/AppShell'
import WeightTrendChart from '@/components/charts/WeightTrendChart'
import { Card, SectionHeader, Chip, StatCard, Skeleton } from '@/components/ui'
import { withTimeZone } from '@/lib/client-time'
import { useDashboard } from '@/lib/useDashboard'
import { clsx } from 'clsx'

const BADGE_DEFS = [
  { id: 'streak_7',  icon: '🔥', name: '7-day streak'  },
  { id: 'streak_30', icon: '⚡', name: '30-day streak' },
  { id: 'first_pr',  icon: '💪', name: 'First PR'      },
  { id: 'macro_master', icon: '🥗', name: 'Macro master' },
  { id: 'sleep_week',  icon: '🌙', name: 'Sleep week'   },
  { id: 'longevity',   icon: '🧬', name: 'Longevity'    },
  { id: 'century',     icon: '💯', name: '100 days'     },
]

const MOOD_OPTIONS = [
  { v: 1, emoji: '😞' }, { v: 2, emoji: '😔' }, { v: 3, emoji: '😕' },
  { v: 4, emoji: '😐' }, { v: 5, emoji: '🙂' }, { v: 6, emoji: '😊' },
  { v: 7, emoji: '😄' }, { v: 8, emoji: '😁' }, { v: 9, emoji: '🤩' }, { v: 10, emoji: '🔥' },
]

const SCORE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

const BIOMARKER_TYPES = [
  { id: 'glucose', label: 'Fasting glucose', unit: 'mg/dL', placeholder: '70–100' },
  { id: 'cholesterol_total', label: 'Total cholesterol', unit: 'mg/dL', placeholder: '<200' },
  { id: 'ldl', label: 'LDL', unit: 'mg/dL', placeholder: '<100' },
  { id: 'hdl', label: 'HDL', unit: 'mg/dL', placeholder: '>40' },
  { id: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', placeholder: '<150' },
  { id: 'vitamin_d', label: 'Vitamin D', unit: 'ng/mL', placeholder: '30–80' },
  { id: 'ferritin', label: 'Ferritin', unit: 'ng/mL', placeholder: '12–300' },
  { id: 'creatinine', label: 'Creatinine', unit: 'mg/dL', placeholder: '0.6–1.2' },
  { id: 'vo2max', label: 'VO₂ max', unit: 'mL/kg/min', placeholder: '>40' },
  { id: 'biological_age', label: 'Biological age', unit: 'years', placeholder: 'e.g. 34' },
]

export default function ProgressPage() {
  const { status } = useSession()

  // UX 5: use shared dashboard hook
  const { dashboard, loading, error, clearDashboard } = useDashboard()

  // Badge state
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set())

  // Log state
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [showMoodFollowUp, setShowMoodFollowUp] = useState(false)
  const [moodEnergy, setMoodEnergy] = useState(5)
  const [moodStress, setMoodStress] = useState(5)
  const [moodSubmitting, setMoodSubmitting] = useState(false)
  const [sleepHours, setSleepHours] = useState('')
  const [sleepQuality, setSleepQuality] = useState(7) // MEDIUM 2: quality selector
  const [sleepSubmitting, setSleepSubmitting] = useState(false)
  const [weight, setWeight] = useState('')
  const [weightSubmitting, setWeightSubmitting] = useState(false)
  // MEDIUM 3: loggedToday from DB
  const [loggedToday, setLoggedToday] = useState({ mood: false, sleep: false, weight: false })
  const [actionMessage, setActionMessage] = useState('')

  // UX 4: Biomarker form state
  const [showBiomarkerForm, setShowBiomarkerForm] = useState(false)
  const [biomarkerValues, setBiomarkerValues] = useState<Record<string, string>>({})
  const [biomarkerSubmitting, setBiomarkerSubmitting] = useState(false)
  const [biomarkerMsg, setBiomarkerMsg] = useState('')

  const showMessage = (msg: string) => {
    setActionMessage(msg)
    setTimeout(() => setActionMessage(''), 3000)
  }

  // MEDIUM 3: Check what's been logged today from real API data
  useEffect(() => {
    if (status !== 'authenticated') return

    const today = new Date().toDateString()

    // Fetch mood logs
    fetch(withTimeZone('/api/mood'))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.latest) {
          const logDate = new Date(d.latest.loggedAt).toDateString()
          if (logDate === today) {
            setLoggedToday(l => ({ ...l, mood: true }))
            setSelectedMood(d.latest.mood)
          }
        }
      })
      .catch(() => {})

    // Fetch sleep logs
    fetch(withTimeZone('/api/sleep'))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.latest) {
          const logDate = new Date(d.latest.date).toDateString()
          if (logDate === today) {
            setLoggedToday(l => ({ ...l, sleep: true }))
          }
        }
      })
      .catch(() => {})

    // Fetch weight logs — check if logged today
    fetch(withTimeZone('/api/weight?limit=1'))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.latest) {
          const logDate = new Date(d.latest.date).toDateString()
          if (logDate === today) {
            setLoggedToday(l => ({ ...l, weight: true }))
          }
        }
      })
      .catch(() => {})

    // Fetch earned badges
    fetch(withTimeZone('/api/badges'))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d?.badges)) {
          setEarnedBadgeIds(new Set(d.badges.map((b: { badgeId: string }) => b.badgeId)))
        }
      })
      .catch(() => {})
  }, [status])

  // ── Log handlers ────────────────────────────────────────────────────────────

  const beginMoodCheckIn = (mood: number) => {
    setSelectedMood(mood)
    setMoodEnergy(mood)
    setMoodStress(Math.max(1, Math.min(10, 10 - mood)))
    setShowMoodFollowUp(true)
  }

  const logMood = async () => {
    if (selectedMood == null) return

    setMoodSubmitting(true)
    try {
      const focus = Math.max(1, Math.min(10, Math.round((selectedMood + moodEnergy + (11 - moodStress)) / 3)))
      const res = await fetch(withTimeZone('/api/mood'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: selectedMood,
          energy: moodEnergy,
          stress: moodStress,
          focus,
        }),
      })
      if (res.ok) {
        setLoggedToday(l => ({ ...l, mood: true }))
        setShowMoodFollowUp(false)
        clearDashboard()
        showMessage('Mood logged ✓')
      }
    } catch { /* silently fail */ } finally {
      setMoodSubmitting(false)
    }
  }

  const logSleep = async () => {
    const hours = parseFloat(sleepHours)
    if (!sleepHours || isNaN(hours) || hours <= 0 || hours > 24) return
    setSleepSubmitting(true)
    try {
      const wakeAt = new Date()
      const bedtimeAt = new Date(wakeAt.getTime() - hours * 3600_000)
      const res = await fetch(withTimeZone('/api/sleep'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalHours: hours,
          bedtimeAt: bedtimeAt.toISOString(),
          wakeAt: wakeAt.toISOString(),
          // MEDIUM 2: use the user-selected quality instead of computed value
          quality: sleepQuality,
          source: 'manual',
        }),
      })
      if (res.ok) {
        setLoggedToday(l => ({ ...l, sleep: true }))
        setSleepHours('')
        clearDashboard()
        showMessage('Sleep logged ✓')
      }
    } catch { /* silent */ } finally {
      setSleepSubmitting(false)
    }
  }

  const logWeight = async () => {
    const kg = parseFloat(weight)
    if (!weight || isNaN(kg) || kg < 20 || kg > 500) return
    setWeightSubmitting(true)
    try {
      const res = await fetch(withTimeZone('/api/weight'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightKg: kg }),
      })
      if (res.ok) {
        setLoggedToday(l => ({ ...l, weight: true }))
        setWeight('')
        clearDashboard() // bust cache so chart updates
        showMessage('Weight logged ✓')
      }
    } catch { /* silent */ } finally {
      setWeightSubmitting(false)
    }
  }

  // UX 4: Submit biomarkers
  const submitBiomarkers = async () => {
    const entries = Object.entries(biomarkerValues)
      .filter(([, v]) => v.trim() !== '')
      .map(([type, value]) => ({ type, value: parseFloat(value) }))
      .filter(e => !isNaN(e.value))

    if (entries.length === 0) {
      setBiomarkerMsg('Enter at least one value.')
      return
    }

    setBiomarkerSubmitting(true)
    setBiomarkerMsg('')
    try {
      const res = await fetch('/api/biomarkers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
      if (res.ok) {
        setBiomarkerMsg(`${entries.length} biomarker${entries.length > 1 ? 's' : ''} saved ✓`)
        setBiomarkerValues({})
        setTimeout(() => { setShowBiomarkerForm(false); setBiomarkerMsg('') }, 2000)
      } else {
        const err = await res.json().catch(() => ({}))
        setBiomarkerMsg(err.error || 'Failed to save. Try again.')
      }
    } catch {
      setBiomarkerMsg('Network error — try again.')
    } finally {
      setBiomarkerSubmitting(false)
    }
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const weightData = dashboard?.weightTrend?.length ? dashboard.weightTrend : []
  const currentWeight = weightData[weightData.length - 1]?.weight ?? null
  const startWeight = weightData[0]?.weight ?? null
  const weightChange = currentWeight != null && startWeight != null && weightData.length > 1
    ? parseFloat((currentWeight - startWeight).toFixed(1))
    : null

  const lastSleep = dashboard?.pillars?.sleep
  const sleepQualityPct = lastSleep?.quality ? Math.round((lastSleep.quality / 10) * 100) : null
  const streakCurrent = dashboard?.streak?.current ?? 0
  const bodyFat = dashboard?.user?.bodyFatPct ?? null

  const badges = BADGE_DEFS.map(b => ({ ...b, unlocked: earnedBadgeIds.has(b.id) }))

  return (
    <AppShell>
      {/* Premium Hero Header */}
      <section className="px-4 pb-6 pt-2 lg:px-0 lg:pt-2">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(140deg,#fef9ec_0%,#fafaf7_46%,#ede9fe_100%)] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                Progress workspace
              </div>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-[#111827] sm:text-[3rem]">
                Track your momentum.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#4b5563] sm:text-[15px]">
                Log sleep, mood, and weight daily. Watch the long-term signals emerge as your data builds history.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[440px]">
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Streak</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {loading ? '--' : streakCurrent}
                </div>
                <div className="text-xs text-[#6b7280]">days in a row</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Weight</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {currentWeight != null ? currentWeight.toFixed(1) : '--'}
                </div>
                <div className="text-xs text-[#6b7280]">kg current</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-[#111827] p-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">BMI</div>
                <div className="mt-2 font-display text-[2rem] font-semibold">
                  {dashboard?.user?.bmi?.toFixed(1) ?? '--'}
                </div>
                <div className="text-xs text-white/60">body mass index</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mx-4 mb-4 rounded-2xl bg-[#FEE2E2] px-4 py-3 text-[13px] font-medium text-[#B91C1C]">
          {error}
        </div>
      )}

      {/* Streak banner */}
      {!loading && dashboard?.streak?.message && (
        <div className="mx-4 mb-4 px-5 py-4 rounded-2xl flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '1px solid #FCD34D' }}>
          <span className="text-2xl">🔥</span>
          <div>
            <div className="text-[14px] font-semibold text-[#B45309]">{dashboard.streak.message}</div>
            <div className="text-[12px] text-[#B45309]/70 mt-0.5">Best streak: {dashboard.streak.best ?? 0} days</div>
          </div>
        </div>
      )}

      {/* Global action message */}
      {actionMessage && (
        <div className="mx-4 mb-3 px-4 py-3 rounded-2xl bg-[#D8F3DC] text-[#2D6A4F] text-[13px] font-medium">
          {actionMessage}
        </div>
      )}

      {/* Key stats */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-4">
        <StatCard value={currentWeight != null ? currentWeight.toFixed(1) : '–'} unit="kg" label="Current weight"
          trend={weightChange != null ? `${weightChange > 0 ? '+' : ''}${weightChange}kg logged` : undefined}
          trendUp={weightChange !== null && weightChange < 0} />
        <StatCard value={dashboard?.user?.bmi?.toFixed(1) ?? '–'} label="BMI"
          trend={dashboard?.user?.bmi
            ? dashboard.user.bmi < 18.5 ? 'Underweight'
            : dashboard.user.bmi < 25 ? 'Normal range ✓'
            : dashboard.user.bmi < 30 ? 'Overweight' : 'Obese'
            : undefined}
          trendUp={dashboard?.user?.bmi ? dashboard.user.bmi < 25 : undefined} />
        <StatCard value={dashboard?.user?.tdee?.toLocaleString() ?? '–'} label="Daily TDEE (kcal)"
          trend="your maintenance calories" />
        <StatCard value={bodyFat != null ? `${bodyFat}` : '–'} unit={bodyFat != null ? '%' : undefined}
          label="Est. body fat"
          trend={bodyFat != null ? (bodyFat < 20 ? 'Athletic range' : bodyFat < 25 ? 'Fitness range' : 'Average range') : undefined} />
      </div>

      {/* Weight Trend Chart */}
      {weightData.length > 0 ? (
        <div className="mx-4 mb-4">
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[14px] font-semibold">Weight trend</div>
              {weightChange !== null && (
                <Chip variant={weightChange < 0 ? 'green' : 'coral'}>
                  {weightChange < 0 ? '↓' : '↑'} {Math.abs(weightChange)}kg
                </Chip>
              )}
            </div>
            <WeightTrendChart data={weightData} />
          </Card>
        </div>
      ) : (
        <div className="mx-4 mb-4">
          <Card padding="md">
            <div className="text-[13px] text-[#8A8A85] text-center py-6">
              Log your weight below to start tracking your trend.
            </div>
          </Card>
        </div>
      )}

      {/* Daily check-in */}
      <SectionHeader title="Daily check-in" />

      {/* Mood logger */}
      <div className="mx-4 mb-3">
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold">How are you feeling?</div>
            {loggedToday.mood && <Chip variant="green">✓ Logged</Chip>}
          </div>
          <div className="flex justify-between">
            {MOOD_OPTIONS.map(m => (
              <button
                key={m.v}
                onClick={() => !loggedToday.mood && !moodSubmitting && beginMoodCheckIn(m.v)}
                disabled={moodSubmitting || loggedToday.mood}
                aria-label={`Mood ${m.v} out of 10`}
                className={clsx(
                  'text-[20px] p-1 rounded-lg transition-all disabled:cursor-not-allowed',
                  selectedMood === m.v ? 'scale-125 bg-[#D8F3DC]' : 'hover:scale-110 opacity-60 hover:opacity-100'
                )}
              >
                {m.emoji}
              </button>
            ))}
          </div>
          {!loggedToday.mood && showMoodFollowUp && selectedMood != null && (
            <div className="mt-4 rounded-2xl border border-[#E8E8E3] bg-[#F8F8F5] p-4">
              <div className="text-[12px] font-semibold text-[#1F2937]">
                Quick follow-up for today&apos;s check-in
              </div>
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8A8A85]">
                  Energy (1–10)
                </div>
                <div className="flex gap-1">
                  {SCORE_OPTIONS.map((score) => (
                    <button
                      key={`energy-${score}`}
                      onClick={() => setMoodEnergy(score)}
                      className={clsx(
                        'flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all',
                        score === moodEnergy ? 'bg-[#2D6A4F] text-white' : 'bg-white text-[#6B7280]'
                      )}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8A8A85]">
                  Stress (1–10)
                </div>
                <div className="flex gap-1">
                  {SCORE_OPTIONS.map((score) => (
                    <button
                      key={`stress-${score}`}
                      onClick={() => setMoodStress(score)}
                      className={clsx(
                        'flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all',
                        score === moodStress ? 'bg-[#DC4A3D] text-white' : 'bg-white text-[#6B7280]'
                      )}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={logMood}
                  disabled={moodSubmitting}
                  className="flex-1 rounded-xl bg-[#1A1A1A] px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#2D6A4F] disabled:opacity-50"
                >
                  {moodSubmitting ? 'Saving…' : 'Save check-in'}
                </button>
                <button
                  onClick={() => {
                    setShowMoodFollowUp(false)
                    setSelectedMood(null)
                  }}
                  disabled={moodSubmitting}
                  className="rounded-xl border border-[#E8E8E3] px-4 py-2.5 text-[12px] font-medium text-[#6B7280] transition-colors hover:border-[#D1D5DB] hover:bg-white disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Sleep logger */}
      <div className="mx-4 mb-3">
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold">Log last night's sleep</div>
            {loggedToday.sleep && <Chip variant="purple">✓ Logged</Chip>}
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={sleepHours}
              onChange={e => setSleepHours(e.target.value)}
              type="number" step="0.5" min="0" max="24"
              placeholder="Hours slept (e.g. 7.5)"
              disabled={loggedToday.sleep || sleepSubmitting}
              className="flex-1 px-3 py-2.5 rounded-xl border border-[#E8E8E3] text-[14px] outline-none focus:border-[#6D28D9] transition-colors disabled:bg-[#F1F1EC]"
            />
            <button
              onClick={logSleep}
              disabled={sleepSubmitting || loggedToday.sleep || !sleepHours}
              className="px-4 py-2.5 rounded-xl bg-[#EDE9FE] text-[#6D28D9] text-[13px] font-semibold hover:bg-[#6D28D9] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sleepSubmitting ? '…' : 'Log'}
            </button>
          </div>
          {/* MEDIUM 2: Sleep quality star picker */}
          {!loggedToday.sleep && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A85] mb-1.5">
                Sleep quality (1–10)
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(q => (
                  <button
                    key={q}
                    onClick={() => setSleepQuality(q)}
                    className={clsx(
                      'flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                      q <= sleepQuality ? 'bg-[#6D28D9] text-white' : 'bg-[#F1F1EC] text-[#8A8A85]'
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Weight logger */}
      <div className="mx-4 mb-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold">Log today's weight</div>
            {loggedToday.weight && <Chip variant="green">✓ Logged</Chip>}
          </div>
          <div className="flex gap-2">
            <input
              value={weight}
              onChange={e => setWeight(e.target.value)}
              type="number" step="0.1"
              placeholder="Weight in kg"
              disabled={loggedToday.weight}
              className="flex-1 px-3 py-2.5 rounded-xl border border-[#E8E8E3] text-[14px] outline-none focus:border-[#2D6A4F] transition-colors disabled:bg-[#F1F1EC]"
            />
            <button
              onClick={logWeight}
              disabled={weightSubmitting || loggedToday.weight || !weight}
              className="px-4 py-2.5 rounded-xl bg-[#D8F3DC] text-[#2D6A4F] text-[13px] font-semibold hover:bg-[#2D6A4F] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {weightSubmitting ? '…' : 'Log'}
            </button>
          </div>
        </Card>
      </div>

      {/* Sleep breakdown */}
      {lastSleep && (
        <>
          <SectionHeader title="Last night's sleep" />
          <div className="mx-4 mb-4 p-6 rounded-3xl text-white"
            style={{ background: 'linear-gradient(135deg,#1e1b4b,#4338ca)' }}>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-50 mb-2">Sleep duration</div>
            <div className="font-display text-[64px] font-bold leading-none">
              {lastSleep.hours?.toFixed(1)}<span className="text-[28px]">h</span>
            </div>
            <div className="text-[14px] font-semibold opacity-80 mt-1">
              {lastSleep.quality >= 8 ? 'Excellent' : lastSleep.quality >= 6 ? 'Good' : lastSleep.quality >= 4 ? 'Fair' : 'Poor'} quality
            </div>

            <div className="grid grid-cols-4 gap-3 mt-5">
              {[
                { label: 'Deep',  value: lastSleep.deepHours != null ? `${lastSleep.deepHours}h` : '–' },
                { label: 'REM',   value: lastSleep.remHours  != null ? `${lastSleep.remHours}h`  : '–' },
                { label: 'HRV',   value: lastSleep.hrv       != null ? `${lastSleep.hrv}ms`      : '–' },
                { label: 'Score', value: lastSleep.quality   != null ? `${lastSleep.quality}/10` : '–' },
              ].map(phase => (
                <div key={phase.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div className="font-display text-[16px] font-bold">{phase.value}</div>
                  <div className="text-[10px] uppercase tracking-wide opacity-60 mt-1">{phase.label}</div>
                </div>
              ))}
            </div>

            {sleepQualityPct != null && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] opacity-60 mb-1.5">
                  <span>Sleep quality</span><span>{lastSleep.quality} / 10</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white/80 transition-all duration-700"
                    style={{ width: `${sleepQualityPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Badges — from real API */}
      <SectionHeader title="Badges earned" />
      <div className="flex gap-3 px-4 overflow-x-auto hide-scrollbar pb-2 mb-4">
        {loading ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex-shrink-0 w-[88px] h-[104px] rounded-2xl bg-[#F1F1EC] animate-pulse" />
          ))
        ) : (
          badges.map(badge => (
            <div
              key={badge.id}
              className={clsx(
                'flex-shrink-0 w-[88px] p-4 rounded-2xl bg-white border border-[#E8E8E3] text-center transition-all',
                !badge.unlocked && 'opacity-35 grayscale'
              )}
              title={badge.unlocked ? `${badge.name} — Unlocked!` : `${badge.name} — Locked`}
            >
              <div className="text-[28px] mb-2">{badge.icon}</div>
              <div className="text-[11px] font-semibold leading-tight">{badge.name}</div>
            </div>
          ))
        )}
      </div>

      {/* Biomarkers — UX 4: Enter manually opens form */}
      <SectionHeader title="Biomarkers" action="Import lab results" />
      <div className="px-4 mb-4">
        {!showBiomarkerForm ? (
          <Card padding="md">
            <div className="text-[13px] text-[#8A8A85] leading-relaxed">
              Import blood work or lab results to unlock your longevity score, biological age estimation, and advanced health insights.
            </div>
            <div className="flex gap-2 mt-3">
              <button
                className="px-4 py-2 rounded-xl bg-[#FEF3C7] text-[#B45309] text-[12px] font-semibold hover:bg-[#B45309] hover:text-white transition-all cursor-not-allowed opacity-60"
                title="PDF import coming soon"
              >
                📋 Import PDF (soon)
              </button>
              <button
                onClick={() => setShowBiomarkerForm(true)}
                className="px-4 py-2 rounded-xl border border-[#E8E8E3] text-[12px] font-medium hover:border-[#1A1A1A] hover:bg-[#F8F8F5] transition-colors"
              >
                Enter manually
              </button>
            </div>
          </Card>
        ) : (
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-semibold">Enter biomarkers</div>
              <button
                onClick={() => { setShowBiomarkerForm(false); setBiomarkerMsg('') }}
                className="text-[12px] text-[#8A8A85] hover:text-[#1A1A1A] transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="grid gap-3">
              {BIOMARKER_TYPES.map(bm => (
                <div key={bm.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[#374151]">{bm.label}</div>
                    <div className="text-[11px] text-[#8A8A85]">{bm.unit}</div>
                  </div>
                  <input
                    type="number"
                    step="any"
                    placeholder={bm.placeholder}
                    value={biomarkerValues[bm.id] ?? ''}
                    onChange={e => setBiomarkerValues(prev => ({ ...prev, [bm.id]: e.target.value }))}
                    className="w-24 px-3 py-2 rounded-xl border border-[#E8E8E3] text-[13px] text-right outline-none focus:border-[#2D6A4F] transition-colors"
                  />
                </div>
              ))}
            </div>

            {biomarkerMsg && (
              <div className={clsx(
                'mt-4 rounded-xl px-3 py-2 text-[12px] font-medium',
                biomarkerMsg.includes('✓') ? 'bg-[#D8F3DC] text-[#2D6A4F]' : 'bg-[#FEE2E2] text-[#DC4A3D]'
              )}>
                {biomarkerMsg}
              </div>
            )}

            <button
              onClick={submitBiomarkers}
              disabled={biomarkerSubmitting}
              className="mt-4 w-full py-3 rounded-2xl bg-[#1A1A1A] text-white text-[13px] font-semibold hover:bg-[#2D6A4F] transition-colors disabled:opacity-50"
            >
              {biomarkerSubmitting ? 'Saving…' : 'Save biomarkers'}
            </button>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
