'use client'

import { useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import AppShell from '@/components/layout/AppShell'
import ReadinessRing from '@/components/charts/ReadinessRing'
import WeeklyCalChart from '@/components/charts/WeeklyCalChart'
import { Card, Chip, SectionHeader, Skeleton } from '@/components/ui'
import { clsx } from 'clsx'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const QUICK_LOGS = [
  {
    label: 'Log meal',
    caption: 'Capture calories, protein, and meal quality',
    href: '/nutrition',
    accent: '#2D6A4F',
    surface: '#D8F3DC',
  },
  {
    label: 'Log workout',
    caption: 'Track sets and session completion',
    href: '/workout',
    accent: '#1D4ED8',
    surface: '#DBEAFE',
  },
  {
    label: 'Log sleep',
    caption: 'Add recovery data to tomorrow\'s readiness',
    href: '/progress',
    accent: '#6D28D9',
    surface: '#EDE9FE',
  },
  {
    label: 'Mood check',
    caption: 'See stress and focus next to training',
    href: '/progress',
    accent: '#DC4A3D',
    surface: '#FEE2E2',
  },
  {
    label: 'Log weight',
    caption: 'Keep your long-term trendline honest',
    href: '/progress',
    accent: '#B45309',
    surface: '#FEF3C7',
  },
]

const PILLAR_CONFIG = [
  {
    key: 'nutrition',
    code: 'NU',
    name: 'Nutrition',
    color: '#D8F3DC',
    href: '/nutrition',
    getValue: (pillars: any) =>
      pillars.nutrition ? `${Math.round(pillars.nutrition.today.calories).toLocaleString()} kcal` : '--',
    getTrend: (pillars: any) =>
      pillars.nutrition
        ? pillars.nutrition.today.calories >= pillars.nutrition.target * 0.7
          ? { label: 'On track', up: true }
          : { label: 'Log a meal', up: false }
        : null,
  },
  {
    key: 'training',
    code: 'TR',
    name: 'Training',
    color: '#DBEAFE',
    href: '/workout',
    getValue: (pillars: any) =>
      pillars.training ? `${pillars.training.sessionsThisWeek} sessions` : '0 sessions',
    getTrend: (pillars: any) =>
      pillars.training?.sessionsThisWeek >= 3
        ? { label: 'Consistent', up: true }
        : { label: 'Time to train', up: false },
  },
  {
    key: 'sleep',
    code: 'SL',
    name: 'Sleep',
    color: '#EDE9FE',
    href: '/progress',
    getValue: (pillars: any) => (pillars.sleep ? `${pillars.sleep.hours}h` : 'Log sleep'),
    getTrend: (pillars: any) =>
      pillars.sleep
        ? pillars.sleep.hours >= 7
          ? { label: 'Well rested', up: true }
          : { label: 'Below target', up: false }
        : null,
  },
  {
    key: 'mental',
    code: 'ME',
    name: 'Mental',
    color: '#FEE2E2',
    href: '/progress',
    getValue: (pillars: any) => (pillars.mental ? `${pillars.mental.mood}/10` : 'Check in'),
    getTrend: (pillars: any) =>
      pillars.mental
        ? pillars.mental.mood >= 6
          ? { label: 'Balanced', up: true }
          : { label: 'Needs attention', up: false }
        : null,
  },
  {
    key: 'longevity',
    code: 'LG',
    name: 'Longevity',
    color: '#FEF3C7',
    href: '/progress',
    getValue: (_pillars: any, extra?: any) =>
      extra?.longevityScore != null ? `${extra.longevityScore} score` : 'Log biomarkers',
    getTrend: (_pillars: any, extra?: any) =>
      extra?.longevityScore != null
        ? extra.longevityScore >= 70
          ? { label: 'Strong', up: true }
          : { label: 'Needs attention', up: false }
        : null,
  },
]

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [longevityScore, setLongevityScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [router, status])

  useEffect(() => {
    if (status !== 'authenticated') return

    let isMounted = true

    const loadDashboard = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        const [dashRes, bioRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/biomarkers'),
        ])

        const payload = await dashRes.json().catch(() => null)

        if (!dashRes.ok) {
          if (payload?.code === 'ACCOUNT_MISSING') {
            await signOut({ callbackUrl: '/onboarding' })
            return
          }
          throw new Error(payload?.error || 'Could not load dashboard')
        }

        if (!isMounted) return
        setData(payload)

        // Longevity score — best-effort, don't fail the whole dashboard if unavailable
        if (bioRes.ok) {
          const bioPayload = await bioRes.json().catch(() => null)
          if (bioPayload?.longevityScore != null) setLongevityScore(bioPayload.longevityScore)
        }
      } catch (error) {
        if (!isMounted) return
        setData(null)
        setLoadError(error instanceof Error ? error.message : 'Could not load dashboard')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      isMounted = false
    }
  }, [status])

  const firstName = session?.user?.name?.split(' ')[0] || 'there'
  const today = format(new Date(), 'EEEE, MMMM d')
  const weeklyDays = Array.isArray(data?.weeklyCalChart) ? data.weeklyCalChart : []
  const activeDays = weeklyDays.filter((day: any) => (day?.calories || 0) > 0)
  const averageCalories =
    activeDays.length > 0
      ? Math.round(
          activeDays.reduce((sum: number, day: any) => sum + (day?.calories || 0), 0) / activeDays.length
        )
      : 0

  return (
    <AppShell>
      <section className="px-4 pb-6 pt-2 lg:px-0 lg:pt-2">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(140deg,#edf7f0_0%,#fafaf7_46%,#fff7df_100%)] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:px-8 lg:py-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                Daily command center
              </div>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-[#111827] sm:text-[3rem]">
                {getGreeting()}, {firstName}.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#4b5563] sm:text-[15px]">
                See the tradeoffs between recovery, training, and nutrition in one place, then act while the signals are still fresh.
              </p>
              <div className="mt-4 text-sm font-medium text-[#374151]">{today}</div>
              {loadError && (
                <div className="mt-4 inline-flex rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-semibold text-[#B91C1C]">
                  {loadError}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[440px]">
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Readiness</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {loading ? '--' : data?.readiness?.score ?? '--'}
                </div>
                <div className="text-xs text-[#6b7280]">{loading ? 'Loading...' : data?.readiness?.label || 'Pending'}</div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Calories avg</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {averageCalories ? averageCalories.toLocaleString() : '--'}
                </div>
                <div className="text-xs text-[#6b7280]">kcal across logged days</div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-[#111827] p-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Current streak</div>
                <div className="mt-2 font-display text-[2rem] font-semibold">
                  {loading ? '--' : data?.streak?.current ?? '--'}
                </div>
                <div className="text-xs text-white/60">days of momentum</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 lg:px-0">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.3fr)_360px] lg:gap-4">
          {loading ? (
            <Skeleton className="mb-4 h-[270px] rounded-[28px]" />
          ) : data?.readiness ? (
            <ReadinessRing
              className="mb-4 h-full min-h-[250px]"
              score={data.readiness.score}
              label={data.readiness.label}
              recommendation={data.readiness.recommendation}
              pillars={data.readiness.pillars}
            />
          ) : (
            <Card padding="lg" className="mb-4">
              <div className="text-sm font-semibold text-[#111827]">Readiness unavailable</div>
              <p className="mt-3 text-sm leading-7 text-[#6b7280]">
                We could not load your readiness summary yet. Try refreshing once your dashboard data is available again.
              </p>
            </Card>
          )}

          <Card padding="lg" className="mb-4 border-[#f6d36c] bg-[linear-gradient(180deg,#fff7d1_0%,#fffaf0_100%)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b45309]">AI insight</div>
            <div className="mt-3 font-display text-[1.6rem] font-semibold leading-tight text-[#713f12]">
              Cross-pillar context
            </div>
            <p className="mt-3 text-sm leading-7 text-[#7c5a19]">
              {data?.insights?.[0] ||
                'We will surface the first meaningful pattern here once your meals, recovery, and workouts start building history together.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Chip variant="amber">Sleep + training</Chip>
              <Chip variant="gray">Shared signals</Chip>
            </div>
          </Card>
        </div>
      </section>

      <section className="mb-4">
        <SectionHeader title="Quick log" action="Open a workflow" />
        <div className="grid gap-3 px-4 sm:grid-cols-2 lg:px-0 xl:grid-cols-5">
          {QUICK_LOGS.map((item) => (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className="rounded-[24px] border border-[#e5e7eb] bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.1)]"
            >
              <div
                className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: item.accent, background: item.surface }}
              >
                Open
              </div>
              <div className="mt-4 font-display text-xl font-semibold text-[#111827]">{item.label}</div>
              <p className="mt-2 text-sm leading-6 text-[#6b7280]">{item.caption}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <SectionHeader title="Today's pillars" action="See all signals" />
        <div className="grid gap-3 px-4 sm:grid-cols-2 lg:px-0 xl:grid-cols-5">
          {PILLAR_CONFIG.map((pillar) => {
            const pillars = data?.pillars
            const extra = { longevityScore }
            const value = pillars ? pillar.getValue(pillars, extra) : '--'
            const trend = pillars ? pillar.getTrend(pillars, extra) : null

            return (
              <Card key={pillar.key} padding="md" onClick={() => router.push(pillar.href)} className="h-full">
                <div
                  className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#111827]"
                  style={{ background: pillar.color }}
                >
                  {pillar.code}
                </div>
                <div className="mt-5 text-sm font-semibold text-[#374151]">{pillar.name}</div>
                <div className="mt-2 font-display text-[1.4rem] font-semibold leading-tight text-[#111827]">
                  {loading ? <Skeleton className="h-6 w-24" /> : value}
                </div>
                {trend && (
                  <div
                    className={clsx(
                      'mt-3 text-xs font-semibold uppercase tracking-[0.18em]',
                      trend.up ? 'text-[#166534]' : 'text-[#b91c1c]'
                    )}
                  >
                    {trend.up ? 'Uptrend' : 'Attention'} / {trend.label}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      <section className="px-4 pb-6 lg:px-0">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <Card padding="lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-[#111827]">Weekly intake</div>
                <p className="mt-1 text-sm text-[#6b7280]">
                  Compare the last seven days of logged intake against your current target.
                </p>
              </div>
              <Chip variant="green">Avg {averageCalories ? averageCalories.toLocaleString() : '--'} kcal</Chip>
            </div>

            {loading ? (
              <Skeleton className="mt-5 h-[160px] w-full rounded-2xl" />
            ) : weeklyDays.length > 0 ? (
              <div className="mt-5">
                <WeeklyCalChart data={weeklyDays} target={data?.user?.tdee || 2000} />
              </div>
            ) : loadError ? (
              <div className="mt-5 rounded-2xl border border-[#F5D0D0] bg-[#FFF5F5] px-4 py-3 text-sm text-[#9F2D2D]">
                {loadError}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-[#f8fafc] px-4 py-5 text-sm text-[#6b7280]">
                Start logging meals and this chart will fill in automatically.
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card padding="lg" className="border-[#f6d36c] bg-[linear-gradient(135deg,#fef3c7_0%,#fde68a_100%)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#92400e]">Streak</div>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <div className="font-display text-[3.2rem] font-semibold leading-none text-[#92400e]">
                    {data?.streak?.current ?? '--'}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[#92400e]">days in a row</div>
                </div>
                <Chip variant="amber">Best {data?.streak?.best ?? '--'}</Chip>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#7c2d12]">
                {data?.streak?.message || 'Log one meaningful health action today to keep the chain alive.'}
              </p>
            </Card>

            <Card padding="lg" className="bg-[#f8fafc]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1d4ed8]">Pattern watch</div>
              <div className="mt-3 font-display text-[1.5rem] font-semibold text-[#111827]">
                Keep an eye on consistency
              </div>
              <p className="mt-3 text-sm leading-7 text-[#475569]">
                {data?.insights?.[1] ||
                  'As your logs deepen, this space will start connecting meal timing, sleep quality, and training performance.'}
              </p>
            </Card>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
