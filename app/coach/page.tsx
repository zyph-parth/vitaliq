'use client'
// app/coach/page.tsx

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '@/components/layout/AppShell'
import { LoadingDots } from '@/components/ui'
import { useDashboard } from '@/lib/useDashboard'
import { clsx } from 'clsx'
import { format } from 'date-fns'

// UX 6: Add a unique id to each message for stable React keys
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
  glassesToday?: number  // MEDIUM — hydration context
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

const SUGGESTED_QUESTIONS = [
  'What should I eat to hit my protein today?',
  'How can I improve my sleep quality?',
  'Is my readiness score good enough to train hard today?',
  'Give me a quick 20-minute home workout I can do right now.',
  "Why is my weight not changing even though I'm eating less?",
]

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

export default function CoachPage() {
  const { data: session, status } = useSession()
  const { dashboard } = useDashboard()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: nextId(),
      role: 'ai',
      content: `Hey 👋 I'm your VitalIQ Coach, powered by Gemini AI. I have full context on your nutrition, sleep, training, and readiness data today. Ask me anything — from what to eat tonight to how to structure your week, whether you train at home, outdoors, or the gym.`,
      time: format(new Date(), 'HH:mm'),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [userCtx, setUserCtx] = useState<UserContext>(DEFAULT_CONTEXT)
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // UX 5: Use shared dashboard hook — no extra fetch
  useEffect(() => {
    if (!dashboard) return
    const u = dashboard.user
    const p = dashboard.pillars
    const r = dashboard.readiness

    // MEDIUM — read today's hydration from localStorage for coach context
    const todayKey = `vitaliq_hydration_${new Date().toISOString().slice(0, 10)}`
    let glassesToday: number | undefined
    try {
      const saved = localStorage.getItem(todayKey)
      if (saved) glassesToday = parseInt(saved, 10)
    } catch { /* ignore */ }

    setUserCtx({
      name: u?.name || session?.user?.name || 'User',
      goal: u?.goal || 'maintain',
      weightKg: u?.weightKg || 70,
      heightCm: u?.heightCm || 170,
      age: u?.age || 25,
      sex: u?.sex || 'male',
      glassesToday,
      today: {
        caloriesConsumed: p?.nutrition?.today?.calories ?? 0,
        caloriesTarget: u?.tdee ?? 2000,
        proteinConsumed: p?.nutrition?.today?.protein ?? 0,
        proteinTarget: u?.targets?.protein ?? 126,
        readinessScore: r?.score ?? 70,
        sleepHours: p?.sleep?.hours ?? null,
        hrv: p?.sleep?.hrv ?? null,
        workoutsThisWeek: p?.training?.sessionsThisWeek ?? 0,
      },
    })
  }, [dashboard, session])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const q = text || input.trim()
    if (!q || loading) return
    setInput('')

    // UX 6: Use the nextId() helper for stable keys
    const userMsg: Message = { id: nextId(), role: 'user', content: q, time: format(new Date(), 'HH:mm') }
    setMessages(m => [...m, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'coach_chat',
          payload: {
            question: q,
            chatHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
            // MEDIUM — include hydration in context sent to Gemini
            userContext: userCtx,
          },
        }),
      })

      if (status === 'authenticated' && !res.ok) {
        if (res.status === 429) {
          setMessages(m => [...m, {
            id: nextId(),
            role: 'ai',
            content: "I'm getting too many requests right now. Please wait a moment and try again.",
            time: format(new Date(), 'HH:mm'),
          }])
          return
        }
      }

      const data = await res.json()
      const reply = data.result || "I'm here to help! Could you rephrase that?"

      setMessages(m => [...m, { id: nextId(), role: 'ai', content: reply, time: format(new Date(), 'HH:mm') }])
    } catch {
      setMessages(m => [...m, {
        id: nextId(),
        role: 'ai',
        content: "I'm having trouble connecting right now. Make sure your Gemini API key is configured in .env.local",
        time: format(new Date(), 'HH:mm'),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      {/* Premium Hero Header */}
      <section className="px-4 pb-6 pt-2 lg:px-0 lg:pt-2">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(140deg,#f0fdf4_0%,#fafaf7_46%,#eef2ff_100%)] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] animate-pulse" />
                <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#2D6A4F]">
                  Gemini AI active
                </div>
              </div>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-[#111827] sm:text-[3rem]">
                Ask your coach anything.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#4b5563] sm:text-[15px]">
                Your VitalIQ Coach has full context on your nutrition, sleep, training, and readiness — ask it anything from what to eat tonight to why your progress has slowed.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[440px]">
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Calories today</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {userCtx.today.caloriesConsumed.toLocaleString()}
                </div>
                <div className="text-xs text-[#6b7280]">of {userCtx.today.caloriesTarget.toLocaleString()} kcal</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Readiness</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {userCtx.today.readinessScore}
                </div>
                <div className="text-xs text-[#6b7280]">out of 100</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-[#111827] p-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">This week</div>
                <div className="mt-2 font-display text-[2rem] font-semibold">
                  {userCtx.today.workoutsThisWeek}
                </div>
                <div className="text-xs text-white/60">sessions logged</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chat messages */}
      <div
        ref={chatRef}
        className="px-4 lg:px-0 flex flex-col gap-4 overflow-y-auto hide-scrollbar"
        style={{ minHeight: '200px', paddingBottom: '160px' }}
      >
        {/* UX 6: use msg.id as key instead of idx */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={clsx(
              'flex flex-col max-w-[85%] animate-fade-up',
              msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
            )}
          >
            <div
              className={clsx(
                'px-4 py-3.5 rounded-2xl text-[14px] leading-relaxed',
                msg.role === 'user'
                  ? 'bg-[#1A1A1A] text-white rounded-br-md'
                  : 'bg-white border border-[#E8E8E3] text-[#1A1A1A] rounded-bl-md shadow-sm'
              )}
            >
              {msg.content}
            </div>
            <div className="text-[11px] text-[#8A8A85] mt-1 px-1">{msg.time}</div>
          </div>
        ))}

        {/* AI typing indicator */}
        {loading && (
          <div className="self-start max-w-[85%] animate-fade-up">
            <div className="bg-white border border-[#E8E8E3] rounded-2xl rounded-bl-md px-4 py-3.5 shadow-sm">
              <LoadingDots />
            </div>
          </div>
        )}
      </div>

      {/* Suggested questions */}
      {messages.length <= 2 && (
        <div className="px-4 lg:px-0 mt-4 mb-2">
          <div className="text-[11px] font-semibold text-[#8A8A85] uppercase tracking-widest mb-3">
            Try asking
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-left px-4 py-3 rounded-xl bg-white border border-[#E8E8E3] text-[13px] text-[#3D3D3A] hover:border-[#2D6A4F] hover:shadow-sm transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div
        className="fixed bottom-[96px] left-0 right-0 z-30 px-4"
        style={{
          background: 'rgba(246,245,240,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(232,232,227,0.6)',
        }}
      >
        <div className="mx-auto max-w-[1180px] py-3">
          <div className="flex gap-3 items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask anything about your health..."
              className="flex-1 px-4 py-3.5 rounded-2xl border border-[#E8E8E3] bg-white text-[14px] outline-none focus:border-[#2D6A4F] transition-colors shadow-sm"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-12 h-12 rounded-2xl bg-[#1A1A1A] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#2D6A4F] transition-all hover:scale-105 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
