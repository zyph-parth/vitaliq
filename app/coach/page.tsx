'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import AppShell from '@/components/layout/AppShell'
import CoachMessageBody from '@/components/chat/CoachMessageBody'
import { Chip, LoadingDots } from '@/components/ui'
import { useStore } from '@/lib/store'
import { useDashboard } from '@/lib/useDashboard'
import { getLocalDateKey, withTimeZone } from '@/lib/client-time'

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  time: string
}

interface UserContext {
  name: string
  goal: string
  weightKg: number
  heightCm: number
  age: number
  sex: string
  glassesToday?: number
  today: {
    caloriesConsumed: number
    caloriesTarget: number
    proteinConsumed: number
    proteinTarget: number
    readinessScore: number
    sleepHours: number | null
    hrv: number | null
    workoutsThisWeek: number
  }
}

interface StarterQuestion {
  label: string
  prompt: string
  surfaceClassName: string
  accentClassName: string
}

interface PriorityGuide {
  eyebrow: string
  title: string
  description: string
  prompt: string
}

const INTRO_MESSAGE =
  "I'm your VitalIQ Coach. I can help with meals, sleep, training, recovery, and how today's signals fit together. Ask for a plan, a decision, or a quick explanation."

const SUGGESTED_QUESTIONS: StarterQuestion[] = [
  {
    label: 'Nutrition',
    prompt: 'What should I eat to hit my protein today?',
    surfaceClassName: 'border-[#DCEEDD] bg-[linear-gradient(180deg,#F5FCF7_0%,#FFFFFF_100%)]',
    accentClassName: 'bg-[#D8F3DC] text-[#166534]',
  },
  {
    label: 'Recovery',
    prompt: 'How can I improve my sleep quality tonight?',
    surfaceClassName: 'border-[#DDE9FF] bg-[linear-gradient(180deg,#F3F7FF_0%,#FFFFFF_100%)]',
    accentClassName: 'bg-[#DBEAFE] text-[#1D4ED8]',
  },
  {
    label: 'Training',
    prompt: 'Should I push training today or keep it moderate?',
    surfaceClassName: 'border-[#EEE3FF] bg-[linear-gradient(180deg,#F8F5FF_0%,#FFFFFF_100%)]',
    accentClassName: 'bg-[#EDE9FE] text-[#6D28D9]',
  },
  {
    label: 'Quick plan',
    prompt: 'Give me a quick 20-minute home workout I can do right now.',
    surfaceClassName: 'border-[#F8E1BE] bg-[linear-gradient(180deg,#FFF8ED_0%,#FFFFFF_100%)]',
    accentClassName: 'bg-[#FEF3C7] text-[#B45309]',
  },
]

const GOAL_LABELS: Record<string, string> = {
  lose: 'Lose fat',
  muscle: 'Build muscle',
  maintain: 'Stay fit',
  longevity: 'Longevity',
}

const DEFAULT_CONTEXT: UserContext = {
  name: 'User',
  goal: 'maintain',
  weightKg: 70,
  heightCm: 170,
  age: 25,
  sex: 'male',
  today: {
    caloriesConsumed: 0,
    caloriesTarget: 2000,
    proteinConsumed: 0,
    proteinTarget: 126,
    readinessScore: 70,
    sleepHours: null,
    hrv: null,
    workoutsThisWeek: 0,
  },
}

let msgCounter = 0
const nextId = () => `msg-${++msgCounter}-${Date.now()}`
const COACH_THREAD_STORAGE_PREFIX = 'vitaliq_coach_thread_v1'
const COACH_HISTORY_LIMIT = 6

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getGoalLabel(goal: string): string {
  return GOAL_LABELS[goal] || 'Stay fit'
}

function isStoredMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'string' &&
    (candidate.role === 'user' || candidate.role === 'ai') &&
    typeof candidate.content === 'string' &&
    typeof candidate.time === 'string'
  )
}

function getReadinessMeta(score: number) {
  if (score >= 80) {
    return {
      label: 'Ready to push',
      note: 'Higher-output work or a focused strength session fits today.',
      chip: 'green' as const,
    }
  }

  if (score >= 65) {
    return {
      label: 'Good to go',
      note: 'Moderate to hard training is reasonable if form stays sharp.',
      chip: 'amber' as const,
    }
  }

  return {
    label: 'Ease in',
    note: 'Recovery, technique work, or lower intensity is the better move today.',
    chip: 'coral' as const,
  }
}

function formatSleep(sleepHours: number | null): string {
  if (sleepHours == null) return 'Sleep not logged'
  return `${sleepHours.toFixed(1)}h sleep`
}

function getPriorityGuide(
  readinessScore: number,
  proteinRemaining: number,
  caloriesRemaining: number,
  sleepHours: number | null
): PriorityGuide {
  if (sleepHours == null) {
    return {
      eyebrow: 'Recovery first',
      title: 'Anchor the day with recovery before forcing intensity.',
      description:
        "Sleep is not logged yet, which makes a hard-training call lower confidence. Start by asking how aggressive today should be or what to prioritize tonight.",
      prompt: 'I have not logged sleep yet. How should I approach training and recovery today?',
    }
  }

  if (proteinRemaining >= 35 && caloriesRemaining >= 250) {
    return {
      eyebrow: 'Nutrition opportunity',
      title: 'Close the protein gap while calories are still available.',
      description:
        'You still have room to eat and a meaningful protein target to close, so the best next move is probably a smart meal decision rather than generic advice.',
      prompt: 'What should I eat next to close my protein gap without overshooting calories?',
    }
  }

  if (readinessScore < 65) {
    return {
      eyebrow: 'Protect recovery',
      title: 'Scale the day instead of forcing a session that misses the signal.',
      description:
        'Lower readiness usually means technique work, lighter training, or better recovery will outperform brute force. The coach should help you make that call clearly.',
      prompt: 'My readiness is low today. What kind of workout or recovery plan makes the most sense?',
    }
  }

  if (readinessScore >= 80) {
    return {
      eyebrow: 'Training window',
      title: 'Today has enough signal to support a more ambitious session.',
      description:
        'Readiness is strong, which means the most valuable question is often how to turn that into a focused training plan instead of wasting a high-quality day.',
      prompt: 'My readiness is high today. What is the best workout structure for the next 45 minutes?',
    }
  }

  return {
    eyebrow: 'Decision support',
    title: "Turn today's mixed signals into one clear next move.",
    description:
      'You have enough context to ask for a real decision now: training intensity, meal timing, or how to spend the rest of the day with less guesswork.',
    prompt: 'Based on my readiness and intake today, what should I focus on next?',
  }
}

export default function CoachPage() {
  const { data: session, status } = useSession()
  const { dashboard, error } = useDashboard()
  const glassesToday = useStore((s) => s.glassesToday)
  const setGlassesToday = useStore((s) => s.setGlassesToday)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userCtx, setUserCtx] = useState<UserContext>(DEFAULT_CONTEXT)
  const [threadReady, setThreadReady] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadOwner = (session?.user?.email || session?.user?.name || 'guest')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
  const threadStorageKey = `${COACH_THREAD_STORAGE_PREFIX}_${threadOwner}`
  const hasConversation = threadReady && messages.length > 0

  useEffect(() => {
    if (status === 'loading') return

    setThreadReady(false)

    try {
      const saved = window.sessionStorage.getItem(threadStorageKey)

      if (!saved) {
        setMessages([])
        return
      }

      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        setMessages([])
        return
      }

      const restoredMessages = parsed.filter(isStoredMessage).slice(-12)
      setMessages(restoredMessages)
    } catch {
      setMessages([])
    } finally {
      setThreadReady(true)
    }
  }, [status, threadStorageKey])

  useEffect(() => {
    if (status !== 'authenticated') return

    let cancelled = false

    fetch(withTimeZone(`/api/hydration?localDate=${encodeURIComponent(getLocalDateKey())}`))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && typeof data?.glasses === 'number') {
          setGlassesToday(data.glasses)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [setGlassesToday, status])

  useEffect(() => {
    if (!dashboard) return

    const user = dashboard.user
    const pillars = dashboard.pillars
    const readiness = dashboard.readiness

    setUserCtx({
      name: user?.name || session?.user?.name || 'User',
      goal: user?.goal || 'maintain',
      weightKg: user?.weightKg || 70,
      heightCm: user?.heightCm || 170,
      age: user?.age || 25,
      sex: user?.sex || 'male',
      glassesToday,
      today: {
        caloriesConsumed: pillars?.nutrition?.today?.calories ?? 0,
        caloriesTarget: user?.tdee ?? 2000,
        proteinConsumed: pillars?.nutrition?.today?.protein ?? 0,
        proteinTarget: user?.targets?.protein ?? 126,
        readinessScore: readiness?.score ?? 70,
        sleepHours: pillars?.sleep?.hours ?? null,
        hrv: pillars?.sleep?.hrv ?? null,
        workoutsThisWeek: pillars?.training?.sessionsThisWeek ?? 0,
      },
    })
  }, [dashboard, glassesToday, session])

  useEffect(() => {
    if (!hasConversation && !loading) return
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [hasConversation, loading, messages])

  useEffect(() => {
    if (!threadReady) return

    try {
      if (messages.length === 0) {
        window.sessionStorage.removeItem(threadStorageKey)
        return
      }

      // Store more than COACH_HISTORY_LIMIT so the UI shows full conversation history;
      // only COACH_HISTORY_LIMIT messages are sent to the API for context.
      window.sessionStorage.setItem(threadStorageKey, JSON.stringify(messages.slice(-12)))
    } catch {
      // Ignore storage failures and keep the in-memory chat usable.
    }
  }, [messages, threadReady, threadStorageKey])

  useEffect(() => {
    const field = inputRef.current
    if (!field) return

    field.style.height = '0px'
    field.style.height = `${Math.min(Math.max(field.scrollHeight, 56), 144)}px`
  }, [input])

  useEffect(() => {
    if (!loading) inputRef.current?.focus()
  }, [loading])

  const resetConversation = () => {
    setMessages([])
    setInput('')

    try {
      window.sessionStorage.removeItem(threadStorageKey)
    } catch {
      // Ignore storage failures and still clear the in-memory thread.
    }

    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const sendMessage = async (text?: string) => {
    const question = text || input.trim()
    if (!question || loading) return

    setInput('')

    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: question,
      time: format(new Date(), 'HH:mm'),
    }

    const chatHistory = [...messages, userMessage]
      .slice(-COACH_HISTORY_LIMIT)
      .map((message) => ({ role: message.role, content: message.content }))

    setMessages((current) => [...current, userMessage])
    setLoading(true)

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'coach_chat',
          payload: {
            question,
            chatHistory,
            userContext: userCtx,
          },
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (status === 'authenticated' && !response.ok && response.status === 429) {
        setMessages((current) => [
          ...current,
          {
            id: nextId(),
            role: 'ai',
            content: "I'm getting too many requests right now. Please wait a moment and try again.",
            time: format(new Date(), 'HH:mm'),
          },
        ])
        return
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Coach response failed')
      }

      const reply = data.result || "I'm here to help. Could you rephrase that?"

      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'ai',
          content: reply,
          time: format(new Date(), 'HH:mm'),
        },
      ])
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: 'ai',
          content:
            "I'm having trouble connecting right now. Please try again in a moment.",
          time: format(new Date(), 'HH:mm'),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const firstName = userCtx.name.split(' ')[0] || 'User'
  const userInitials = getInitials(userCtx.name)
  const readinessMeta = getReadinessMeta(userCtx.today.readinessScore)
  const proteinRemaining = Math.max(0, Math.round(userCtx.today.proteinTarget - userCtx.today.proteinConsumed))
  const caloriesRemaining = Math.max(0, Math.round(userCtx.today.caloriesTarget - userCtx.today.caloriesConsumed))
  const hydrationSummary =
    typeof userCtx.glassesToday === 'number'
      ? `${userCtx.glassesToday} glasses logged`
      : 'Hydration not logged'
  const priorityGuide = getPriorityGuide(
    userCtx.today.readinessScore,
    proteinRemaining,
    caloriesRemaining,
    userCtx.today.sleepHours
  )
  const compactContext = [
    { label: 'Goal', value: getGoalLabel(userCtx.goal) },
    { label: 'Readiness', value: String(userCtx.today.readinessScore) },
    { label: 'Protein gap', value: `${proteinRemaining}g` },
  ]
  const sidePanels = [
    {
      label: 'Primary goal',
      value: getGoalLabel(userCtx.goal),
      note: 'The coach weights this priority first when shaping advice.',
      className: 'bg-white/88',
    },
    {
      label: 'Recovery',
      value: formatSleep(userCtx.today.sleepHours),
      note: userCtx.today.hrv ? `HRV ${userCtx.today.hrv}` : 'HRV not logged yet',
      className: 'bg-[linear-gradient(180deg,#F5F9FF_0%,#FFFFFF_100%)]',
    },
    {
      label: 'Hydration',
      value: hydrationSummary,
      note: 'Useful when appetite, fatigue, or training quality feels off.',
      className: 'bg-[linear-gradient(180deg,#F2FBF6_0%,#FFFFFF_100%)]',
    },
  ]
  const workspaceLabel = !threadReady
    ? 'Restoring thread'
    : hasConversation
      ? `${messages.length} messages live`
      : 'Context synced'

  const composer = (
    <div className="border-t border-[#ECEBE4] bg-[linear-gradient(180deg,rgba(250,250,247,0.94),rgba(246,245,240,0.98))] p-4 backdrop-blur-xl sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
          Ask VitalIQ Coach
        </div>
        <div className="hidden text-[11px] text-[#9CA3AF] sm:block">
          {loading ? 'Thinking...' : `Helping ${firstName} right now`}
        </div>
      </div>

      {hasConversation && (
        <div className="mb-3 px-1">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A8A85]">
            Quick prompts
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={`live-${question.label}`}
                onClick={() => void sendMessage(question.prompt)}
                className="rounded-full border border-[#E8E8E3] bg-white px-3 py-1.5 text-[12px] font-medium text-[#4B5563] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2D6A4F] hover:text-[#111827] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
              >
                {question.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-3">
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void sendMessage()
            }
          }}
          placeholder="Ask about a meal choice, today's workout, recovery, or what your data means..."
          className="min-h-[56px] max-h-36 flex-1 resize-none rounded-[24px] border border-[#E8E8E3] bg-white px-4 py-3.5 text-[14px] leading-6 text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#2D6A4F] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
        />
        <button
          onClick={() => void sendMessage()}
          disabled={loading || !input.trim()}
          className="flex h-[56px] min-w-[56px] items-center justify-center rounded-[20px] bg-[#111827] px-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2D6A4F] hover:shadow-[0_16px_34px_rgba(45,106,79,0.24)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      <div className="mt-2 px-1 text-[11px] text-[#9CA3AF]">
        Press Enter to send. Use Shift + Enter for a new line.
      </div>
    </div>
  )

  return (
    <AppShell>
      <section className="px-4 pb-5 pt-2 lg:px-0">
        <div className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(140deg,#eefaf2_0%,#fbfaf7_50%,#eef2ff_100%)] px-6 py-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:px-8 lg:py-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#2D6A4F] animate-pulse" />
                <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#2D6A4F]">
                  Coach online
                </div>
              </div>
              <h1 className="mt-3 font-display text-[2.4rem] font-semibold leading-[0.96] tracking-tight text-[#111827] sm:text-[3rem] lg:text-[3.35rem]">
                Ask for the next best move.
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#4B5563]">
                Meals, recovery, training decisions, or why today feels off. The coach already has
                your context, so you can skip the setup and get to a sharper answer.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Chip variant="green">Goal {getGoalLabel(userCtx.goal)}</Chip>
                <Chip variant={readinessMeta.chip}>{readinessMeta.label}</Chip>
                <Chip variant="gray">{formatSleep(userCtx.today.sleepHours)}</Chip>
                <Chip variant="gray">{hydrationSummary}</Chip>
              </div>
              {error && (
                <div className="mt-4 inline-flex rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-semibold text-[#B91C1C]">
                  {error}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/80 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">Readiness</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {userCtx.today.readinessScore}
                </div>
                <div className="text-xs text-[#6B7280]">{readinessMeta.label}</div>
              </div>

              <div className="rounded-[24px] border border-white/80 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">Calories left</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {caloriesRemaining.toLocaleString()}
                </div>
                <div className="text-xs text-[#6B7280]">kcal runway today</div>
              </div>

              <div className="rounded-[24px] border border-[#111827] bg-[#111827] p-4 text-white shadow-[0_18px_36px_rgba(15,23,42,0.16)]">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Protein gap</div>
                <div className="mt-2 font-display text-[2rem] font-semibold">{proteinRemaining}g</div>
                <div className="text-xs text-white/65">
                  {proteinRemaining > 0 ? 'left to target' : 'target already hit'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-6 lg:px-0">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/[0.62] shadow-[0_20px_52px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-[#ECEBE4] px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
                Coach workspace
              </div>
              <div className="mt-1 text-sm leading-6 text-[#6B7280]">
                Ask for a plan, a decision, or a quick explanation grounded in today's data.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasConversation && (
                <button
                  onClick={resetConversation}
                  className="inline-flex items-center rounded-full border border-[#E8E8E3] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4B5563] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#111827] hover:text-[#111827] hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                >
                  New chat
                </button>
              )}
              <span className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#6B7280] shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
                {workspaceLabel}
              </span>
            </div>
          </div>

          <div
            className={clsx(
              'grid',
              hasConversation
                ? 'lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start'
                : 'lg:grid-cols-[minmax(0,1fr)_320px]'
            )}
          >
            <div className="self-start border-b border-[#ECEBE4] lg:border-b-0 lg:border-r">
              {!threadReady ? (
                <div className="flex min-h-[560px] items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,250,252,0.92))] px-6 text-center">
                  <div className="flex flex-col items-center gap-3 text-[#6B7280]">
                    <LoadingDots />
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                      Restoring coach thread
                    </div>
                  </div>
                </div>
              ) : hasConversation ? (
                <div className="flex min-h-[620px] flex-col lg:h-[680px] xl:h-[720px]">
                  <div className="border-b border-[#ECEBE4] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,250,252,0.78))] px-5 py-4 sm:px-6">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
                      Live context
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip variant="green">Goal {getGoalLabel(userCtx.goal)}</Chip>
                      <Chip variant={readinessMeta.chip}>Readiness {userCtx.today.readinessScore}</Chip>
                      <Chip variant="gray">{proteinRemaining}g protein gap</Chip>
                      <Chip variant="gray">{caloriesRemaining.toLocaleString()} kcal left</Chip>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(216,243,220,0.20),transparent_22rem),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,250,252,0.94))] px-5 py-6 hide-scrollbar sm:px-6">
                    <div className="flex flex-col gap-6">
                      {messages.map((message) => {
                        const isUser = message.role === 'user'

                        return (
                          <div
                            key={message.id}
                            className={clsx(
                              'flex flex-col gap-1.5 animate-fade-up',
                              isUser ? 'items-end' : 'items-start'
                            )}
                          >
                            {isUser ? (
                              <div className="flex items-center gap-2 px-1 text-[11px] text-[#9CA3AF]">
                                <span>{message.time}</span>
                                <span className="font-semibold uppercase tracking-[0.18em] text-[#8A8A85]">
                                  You
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-1 text-[11px] text-[#6B7280]">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111827] text-[10px] font-semibold text-white">
                                  AI
                                </div>
                                <span className="font-semibold uppercase tracking-[0.18em]">VitalIQ Coach</span>
                                <span className="text-[#9CA3AF]">{message.time}</span>
                              </div>
                            )}

                            <div
                              className={clsx(
                                'rounded-[24px] border px-4 py-4 text-[14px] leading-7 shadow-[0_14px_34px_rgba(15,23,42,0.08)] sm:px-5',
                                isUser
                                  ? 'max-w-[min(78%,620px)] rounded-br-md border-[#111827] bg-[#111827] text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)]'
                                  : 'max-w-[min(100%,760px)] rounded-bl-md border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] text-[#1A1A1A]'
                              )}
                            >
                              <CoachMessageBody content={message.content} role={message.role} />
                            </div>
                          </div>
                        )
                      })}

                      {loading && (
                        <div className="flex flex-col gap-1.5 animate-fade-up">
                          <div className="flex items-center gap-2 px-1 text-[11px] text-[#6B7280]">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111827] text-[10px] font-semibold text-white">
                              AI
                            </div>
                            <span className="font-semibold uppercase tracking-[0.18em]">VitalIQ Coach</span>
                            <span className="text-[#9CA3AF]">typing</span>
                          </div>
                          <div className="max-w-[min(100%,760px)] rounded-[24px] rounded-bl-md border border-white/80 bg-white/95 px-4 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
                            <LoadingDots />
                          </div>
                        </div>
                      )}

                      <div ref={endRef} />
                    </div>
                  </div>

                  {composer}
                </div>
              ) : (
                <div className="space-y-4 p-5 sm:p-6">
                  <div className="overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top_right,rgba(82,183,136,0.22),transparent_20rem),linear-gradient(145deg,#111827_0%,#0F172A_100%)] p-6 text-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                        {priorityGuide.eyebrow}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60">
                        {readinessMeta.label}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-end">
                      <div>
                        <div className="font-display text-[1.9rem] font-semibold leading-tight text-white sm:text-[2.15rem]">
                          {priorityGuide.title}
                        </div>
                        <div className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
                          {priorityGuide.description}
                        </div>
                      </div>

                      <button
                        onClick={() => void sendMessage(priorityGuide.prompt)}
                        className="group rounded-[24px] border border-white/12 bg-white/6 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/52">
                            Ask this now
                          </div>
                          <div className="text-white/40 transition-transform duration-200 group-hover:translate-x-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M5 12h14M13 5l7 7-7 7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-3 text-[15px] leading-7 text-white">
                          {priorityGuide.prompt}
                        </div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
                      Start with one of these
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {SUGGESTED_QUESTIONS.map((question) => (
                        <button
                          key={question.prompt}
                          onClick={() => void sendMessage(question.prompt)}
                          className={clsx(
                            'group rounded-[24px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]',
                            question.surfaceClassName
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={clsx(
                                'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                                question.accentClassName
                              )}
                            >
                              {question.label}
                            </span>
                            <div className="text-[#9CA3AF] transition-transform duration-200 group-hover:translate-x-0.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M5 12h14M13 5l7 7-7 7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                          </div>
                          <div className="mt-3 text-[15px] leading-7 text-[#111827]">{question.prompt}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] sm:p-5">
                    <div className="mb-2 flex items-center gap-2 text-[11px] text-[#6B7280]">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111827] text-[10px] font-semibold text-white">
                        AI
                      </div>
                      <span className="font-semibold uppercase tracking-[0.18em]">VitalIQ Coach</span>
                    </div>
                    <div className="text-[15px] leading-7 text-[#4B5563]">
                      <CoachMessageBody content={INTRO_MESSAGE} role="ai" />
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
                    {composer}
                  </div>

                  <div ref={endRef} />
                </div>
              )}
            </div>

            <aside
              className={clsx(
                'self-start p-5 sm:p-6',
                hasConversation
                  ? 'bg-[linear-gradient(180deg,rgba(247,249,252,0.72),rgba(255,255,255,0.62))]'
                  : 'bg-[linear-gradient(180deg,rgba(247,249,252,0.72),rgba(255,255,255,0.62))]'
              )}
            >
              {hasConversation ? (
                <div className="space-y-3">
                  <div className="rounded-[28px] bg-[#111827] p-5 text-white shadow-[0_20px_38px_rgba(15,23,42,0.18)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Context blend</div>
                    <div className="mt-3 font-display text-[1.75rem] font-semibold leading-tight">
                      {getGoalLabel(userCtx.goal)}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-white/68">
                      Readiness is {userCtx.today.readinessScore}, calories left are{' '}
                      {caloriesRemaining.toLocaleString()}, and the protein gap is {proteinRemaining}g.
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[20px] bg-white/6 p-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Calories left</div>
                        <div className="mt-2 text-[1.25rem] font-semibold">
                          {caloriesRemaining.toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-[20px] bg-white/6 p-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Protein gap</div>
                        <div className="mt-2 text-[1.25rem] font-semibold">{proteinRemaining}g</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/80 bg-white/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">Suggested angle</div>
                    <div className="mt-2 text-[15px] font-semibold text-[#111827]">{priorityGuide.eyebrow}</div>
                    <div className="mt-1 text-sm leading-6 text-[#6B7280]">{priorityGuide.title}</div>
                  </div>

                  <div className="grid gap-3">
                    {sidePanels.slice(1).map((panel) => (
                      <div
                        key={panel.label}
                        className={clsx(
                          'rounded-[22px] border border-white/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]',
                          panel.className
                        )}
                      >
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                          {panel.label}
                        </div>
                        <div className="mt-2 text-[16px] font-semibold text-[#111827]">{panel.value}</div>
                        <div className="mt-1 text-xs leading-6 text-[#6B7280]">{panel.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-[28px] bg-[#111827] p-5 text-white shadow-[0_20px_38px_rgba(15,23,42,0.18)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">Context blend</div>
                    <div className="mt-3 font-display text-[1.75rem] font-semibold leading-tight">
                      {getGoalLabel(userCtx.goal)}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-white/68">
                      Readiness is {userCtx.today.readinessScore}, calories left are{' '}
                      {caloriesRemaining.toLocaleString()}, and the protein gap is {proteinRemaining}g.
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {compactContext.slice(1).map((item) => (
                        <div key={item.label} className="rounded-[20px] bg-white/6 p-3">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                            {item.label}
                          </div>
                          <div className="mt-2 text-[1.25rem] font-semibold">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {sidePanels.map((panel) => (
                    <div
                      key={panel.label}
                      className={clsx(
                        'rounded-[22px] border border-white/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]',
                        panel.className
                      )}
                    >
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                        {panel.label}
                      </div>
                      <div className="mt-2 text-[16px] font-semibold text-[#111827]">{panel.value}</div>
                      <div className="mt-1 text-xs leading-6 text-[#6B7280]">{panel.note}</div>
                    </div>
                  ))}

                  <div className="rounded-[22px] border border-[#E8E8E3] bg-white/92 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">Suggested angle</div>
                    <div className="mt-2 text-[15px] font-semibold text-[#111827]">{priorityGuide.eyebrow}</div>
                    <div className="mt-1 text-sm leading-6 text-[#6B7280]">{priorityGuide.title}</div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
