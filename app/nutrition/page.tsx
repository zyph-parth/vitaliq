'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '@/components/layout/AppShell'
import { Button, Card, Chip, ProgressBar, SectionHeader, Skeleton } from '@/components/ui'
import { getLocalDateKey, withTimeZone } from '@/lib/client-time'
import { useStore } from '@/lib/store'
import { useDashboard } from '@/lib/useDashboard'
import { clsx } from 'clsx'

type LogMode = 'text' | 'photo' | 'voice'

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionResultEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

interface SpeechRecognitionErrorEvent extends Event {
  error?: string
}

interface LoggedMeal {
  id: string
  description: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fibreG: number
  mealType: string
  aiInsight?: string | null
}

// UX 1: Added mealType to FoodResult
interface FoodResult {
  foodName: string
  emoji: string
  totalCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  fibreG: number
  aiInsight?: string
  mealType?: string
  confidence?: number
  assumptions?: string[]
  items: { name: string; portion: string; calories: number }[]
}

const MEAL_ICONS: Record<string, string> = {
  breakfast: 'BR', lunch: 'LU', dinner: 'DI',
  snack: 'SN', pre_workout: 'PW', post_workout: 'AW',
}

const MEAL_COLORS: Record<string, string> = {
  breakfast: '#FEF3C7', lunch: '#D8F3DC', dinner: '#FEE2E2',
  snack: '#DBEAFE', pre_workout: '#EDE9FE', post_workout: '#D8F3DC',
}

const LOG_MODES: Array<{ id: LogMode; label: string; detail: string }> = [
  { id: 'text', label: 'Text', detail: 'Describe the meal naturally' },
  { id: 'photo', label: 'Photo', detail: 'Upload a food photo for analysis' },
  { id: 'voice', label: 'Voice', detail: 'Speak the meal out loud' },
]

const getMessageTone = (message: string) => {
  const normalized = message.toLowerCase()
  return normalized.includes('failed') ||
    normalized.includes('could not') ||
    normalized.includes('check') ||
    normalized.includes('try again') ||
    normalized.includes('error')
    ? 'error'
    : 'success'
}

export default function NutritionPage() {
  const { status } = useSession()
  const { dashboard, clearDashboard } = useDashboard()
  const glasses = useStore((s) => s.glassesToday)
  const setGlassesToday = useStore((s) => s.setGlassesToday)
  const [meals, setMeals] = useState<LoggedMeal[]>([])
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 })
  const [target, setTarget] = useState(2000)
  const [macroTargets, setMacroTargets] = useState({ protein: 150, carbs: 200, fat: 60, fibre: 30 })
  const [userGoal, setUserGoal] = useState('maintain')
  const [loading, setLoading] = useState(true)
  const [logMode, setLogMode] = useState<LogMode>('text')
  const [mealInput, setMealInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiMessageIsError, setAiMessageIsError] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<FoodResult | null>(null)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Persist hydration glasses per-day to localStorage
  const todayKey = `vitaliq_hydration_${getLocalDateKey()}`
  useEffect(() => {
    try {
      const saved = localStorage.getItem(todayKey)
      const parsed = saved ? parseInt(saved, 10) : 0
      setGlassesToday(Number.isFinite(parsed) ? parsed : 0)
    } catch { /* ignore */ }
  }, [setGlassesToday, todayKey])
  const setGlassesAndSave = (n: number) => {
    const val = Math.max(0, Math.min(12, n))
    setGlassesToday(val)
    try { localStorage.setItem(todayKey, String(val)) } catch { /* ignore */ }
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    void fetchMeals()
  }, [status])

  const fetchMeals = async () => {
    try {
      const response = await fetch(withTimeZone('/api/meals'))
      if (!response.ok) return
      const data = await response.json()
      setMeals(Array.isArray(data.meals) ? data.meals : [])
      if (data.totals) setTotals(data.totals)
      if (data.target) setTarget(data.target)
      if (data.macroTargets) setMacroTargets(data.macroTargets)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dashboard?.user?.goal) {
      setUserGoal(dashboard.user.goal)
    }
  }, [dashboard])

  const analyzeText = async (text: string) => {
    if (!text.trim()) return

    setAiLoading(true)
    setAiMessage('')
    setAnalysisResult(null)

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'meal_analysis',
          payload: { description: text, userContext: { goal: userGoal } },
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Could not analyze this meal.')
      }
      const parsed = data.result
      const items = Array.isArray(parsed.items) && parsed.items.length > 0
        ? parsed.items
        : (Array.isArray(parsed.ingredients) ? parsed.ingredients : []).map((ingredient: string) => ({
            name: ingredient,
            portion: '',
            calories: 0,
          }))
      // UX 1: Store mealType from AI response
      setAnalysisResult({
        foodName: parsed.foodName || text.slice(0, 60),
        emoji: 'ME',
        totalCalories: Number(parsed.calories) || 0,
        proteinG: Number(parsed.proteinG) || 0,
        carbsG: Number(parsed.carbsG) || 0,
        fatG: Number(parsed.fatG) || 0,
        fibreG: Number(parsed.fibreG) || 0,
        aiInsight: parsed.aiInsight,
        mealType: parsed.mealType || 'snack',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
        items,
      })
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'Could not analyze this meal.')
      setAiMessageIsError(true)
    } finally {
      setAiLoading(false)
    }
  }

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setAiLoading(true)
    setAiMessage('')
    setAnalysisResult(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      const response = await fetch('/api/gemini', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Photo analysis failed.')
      }
      setAnalysisResult({
        ...data.result,
        totalCalories: Number(data.result?.totalCalories) || 0,
        proteinG: Number(data.result?.proteinG) || 0,
        carbsG: Number(data.result?.carbsG) || 0,
        fatG: Number(data.result?.fatG) || 0,
        fibreG: Number(data.result?.fibreG) || 0,
        mealType: data.result?.mealType || 'snack',
        assumptions: Array.isArray(data.result?.assumptions) ? data.result.assumptions : [],
        items: Array.isArray(data.result?.items) ? data.result.items : [],
      })
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'Photo analysis failed.')
      setAiMessageIsError(true)
    } finally {
      setAiLoading(false)
    }
  }

  const toggleVoice = () => {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    type SpeechRecognitionCtor = new () => SpeechRecognitionInstance
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const SpeechRecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setAiMessage('Voice logging is not supported in this browser.')
      setAiMessageIsError(true)
      setLogMode('text')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    // UX 2: Use browser locale instead of hardcoded en-IN
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = false
    recognition.onresult = (voiceEvent: SpeechRecognitionResultEvent) => {
      const transcript = voiceEvent.results[0][0].transcript
      setRecording(false)
      setLogMode('text')
      setMealInput(transcript)
      void analyzeText(transcript)
    }
    recognition.onerror = (voiceEvent: SpeechRecognitionErrorEvent) => {
      setRecording(false)
      setLogMode('text')
      if (voiceEvent.error === 'not-allowed' || voiceEvent.error === 'service-not-allowed') {
        setAiMessage('Microphone access is blocked. Allow microphone permission in your browser and try again.')
      } else {
        setAiMessage('Voice capture failed. Try typing the meal instead.')
      }
      setAiMessageIsError(true)
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
    setAiMessage('')
  }

  // HIGH 4: Check response.ok before showing success
  const logMeal = async () => {
    if (!analysisResult) return

    setAiLoading(true)

    try {
      const response = await fetch(withTimeZone('/api/meals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: analysisResult.foodName || mealInput,
          calories: analysisResult.totalCalories,
          proteinG: analysisResult.proteinG,
          carbsG: analysisResult.carbsG,
          fatG: analysisResult.fatG,
          fibreG: analysisResult.fibreG || 0,
          mealType: analysisResult.mealType || 'snack',  // UX 1: use AI-detected type
          aiInsight: analysisResult.aiInsight,
          ingredients: analysisResult.items?.map((item) => item.name) || [],
        }),
      })

      if (!response.ok) {
        // HIGH 4: show error without clearing analysisResult so user can retry
        const errData = await response.json().catch(() => ({}))
        setAiMessage(errData?.error || 'Failed to save meal. Please try again.')
        setAiMessageIsError(true)
        return
      }

      // Only on success: show confirmation, clear result
      setAiMessage(
        `Saved ${analysisResult.totalCalories} kcal / P ${analysisResult.proteinG}g / C ${analysisResult.carbsG}g / F ${analysisResult.fatG}g`
      )
      setAiMessageIsError(false)
      setAnalysisResult(null)
      setMealInput('')
      clearDashboard() // bust dashboard cache
      await fetchMeals()
    } catch {
      setAiMessage('Failed to save this meal. Try again.')
      setAiMessageIsError(true)
    } finally {
      setAiLoading(false)
    }
  }

  // UX 3: Delete a logged meal
  const deleteMeal = async (mealId: string) => {
    try {
      const res = await fetch(`/api/meals?id=${mealId}`, { method: 'DELETE' })
      if (!res.ok) {
        setAiMessage('Could not delete meal — try again.')
        setAiMessageIsError(true)
        return
      }
      // Remove from local state and recompute totals
      setMeals(prev => {
        const updated = prev.filter(m => m.id !== mealId)
        const newTotals = updated.reduce(
          (acc, m) => ({
            calories: acc.calories + m.calories,
            protein: acc.protein + m.proteinG,
            carbs: acc.carbs + m.carbsG,
            fat: acc.fat + m.fatG,
            fibre: acc.fibre + m.fibreG,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
        )
        setTotals(newTotals)
        return updated
      })
      clearDashboard()
    } catch {
      setAiMessage('Could not delete meal — try again.')
      setAiMessageIsError(true)
    }
  }

  const calPct = Math.min(100, (totals.calories / target) * 100)
  const remaining = Math.max(0, target - totals.calories)
  const { protein: proteinTarget, carbs: carbTarget, fat: fatTarget, fibre: fibreTarget } = macroTargets
  const remainingProtein = Math.max(0, proteinTarget - totals.protein)
  const remainingCarbs = Math.max(0, carbTarget - totals.carbs)
  const remainingFat = Math.max(0, fatTarget - totals.fat)
  const remainingFibre = Math.max(0, fibreTarget - totals.fibre)
  const maxMacro = analysisResult
    ? Math.max(analysisResult.proteinG, analysisResult.carbsG, analysisResult.fatG, 1)
    : 1

  const macroSummary = [
    { label: 'Protein', val: totals.protein, target: proteinTarget, color: '#93C5FD', unit: 'g' },
    { label: 'Carbs', val: totals.carbs, target: carbTarget, color: '#86EFAC', unit: 'g' },
    { label: 'Fat', val: totals.fat, target: fatTarget, color: '#FCD34D', unit: 'g' },
    { label: 'Fibre', val: totals.fibre, target: fibreTarget, color: '#F9A8D4', unit: 'g' },
  ]

  // Suppress unused variable warnings for remainingCarbs etc.
  void remainingCarbs; void remainingFat; void remainingFibre;

  return (
    <AppShell>
      <section className="px-4 pb-6 pt-3 lg:px-0 lg:pt-2">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(145deg,#effaf3_0%,#fafaf7_44%,#eff6ff_100%)] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                Nutrition workspace
              </div>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-[#111827] sm:text-[3rem]">
                Fuel with more context.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#4b5563] sm:text-[15px]">
                Track intake, review macro gaps, and keep each meal tied to the target you are actually trying to hit today.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[460px]">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Remaining</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {remaining.toLocaleString()}
                </div>
                <div className="text-xs text-[#6b7280]">kcal left today</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Target</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">
                  {target.toLocaleString()}
                </div>
                <div className="text-xs text-[#6b7280]">daily calories</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-[#111827] p-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Protein left</div>
                <div className="mt-2 font-display text-[2rem] font-semibold">{Math.round(remainingProtein)}</div>
                <div className="text-xs text-white/60">grams to goal</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main two-column layout ──────────────────────────────────────── */}
      <section className="px-4 lg:px-0">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">

          {/* ── LEFT: AI meal logger + logged meals ── */}
          <div className="flex flex-col gap-4">

            {/* AI Meal Logger */}
            <Card padding="lg">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <div className="text-[15px] font-semibold text-[#111827]">Log a meal</div>
                  <p className="mt-1 text-sm text-[#6b7280]">
                    Describe it, snap a photo, or speak it — AI estimates the macros instantly.
                  </p>
                </div>
                <Chip variant="blue">AI Live</Chip>
              </div>

              {/* Mode tabs */}
              <div className="flex gap-2 rounded-2xl bg-[#F1F1EC] p-1">
                {LOG_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setLogMode(mode.id)
                      setAnalysisResult(null)
                      setAiMessage('')
                      setRecording(false)
                    }}
                    className={clsx(
                      'flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all',
                      logMode === mode.id
                        ? 'bg-[#111827] text-white shadow-sm'
                        : 'text-[#6b7280] hover:text-[#111827]'
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Input area */}
              <div className="mt-4 rounded-[24px] border border-[#e5e7eb] bg-[#fbfbfa] p-4">
                {logMode === 'text' && (
                  <div>
                    <textarea
                      value={mealInput}
                      onChange={(event) => setMealInput(event.target.value)}
                      placeholder="e.g. chicken bowl with rice, yogurt, and vegetables"
                      className="min-h-[100px] w-full resize-none border-0 bg-transparent text-[14px] leading-7 text-[#111827] outline-none placeholder:text-[#94a3b8]"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f0f0ee] pt-3">
                      <span className="text-xs text-[#9ca3af]">Describe it naturally — brand names, portions, cooking method all help.</span>
                      <Button size="sm" onClick={() => void analyzeText(mealInput)} loading={aiLoading} disabled={!mealInput.trim()}>
                        Analyze →
                      </Button>
                    </div>
                  </div>
                )}

                {logMode === 'photo' && (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed border-[#d1d5db] bg-white px-5 py-8 transition-all hover:border-[#111827]">
                    {aiLoading ? (
                      <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                        Analyzing image
                        <span className="flex gap-1">
                          {[0, 1, 2].map((index) => (
                            <span key={index} className="typing-dot h-1.5 w-1.5 rounded-full bg-[#6b7280]" style={{ animationDelay: `${index * 0.2}s` }} />
                          ))}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="text-3xl mb-3">📸</div>
                        <div className="text-[15px] font-semibold text-[#111827]">Tap to add a food photo</div>
                        <p className="mt-1 text-sm text-[#6b7280]">Gemini Vision estimates macros from the image</p>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                      </>
                    )}
                  </label>
                )}

                {logMode === 'voice' && (
                  <button
                    onClick={toggleVoice}
                    className={clsx(
                      'flex w-full flex-col items-center justify-center rounded-[20px] border border-dashed px-5 py-8 text-center transition-all',
                      recording ? 'border-[#2D6A4F] bg-[#D8F3DC] text-[#166534]' : 'border-[#d1d5db] bg-white text-[#111827] hover:border-[#111827]'
                    )}
                  >
                    <div className="text-3xl mb-3">{recording ? '🎙️' : '🎤'}</div>
                    <div className="text-[15px] font-semibold">{recording ? 'Listening…' : 'Tap to speak'}</div>
                    <p className="mt-1 text-sm opacity-70">Say something like: two eggs, oats, and a banana</p>
                  </button>
                )}
              </div>

              {aiMessage && (
                <div className={clsx('mt-4 rounded-2xl px-4 py-3 text-sm font-medium',
                  aiMessageIsError || getMessageTone(aiMessage) === 'error'
                    ? 'bg-[#FEE2E2] text-[#B91C1C]'
                    : 'bg-[#D8F3DC] text-[#166534]'
                )}>
                  {aiMessage}
                </div>
              )}

              {analysisResult && (
                <div className="mt-4 rounded-[24px] border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Analysis complete</div>
                      <div className="mt-2 font-display text-[1.4rem] font-semibold leading-tight text-[#111827]">{analysisResult.foodName}</div>
                      {analysisResult.aiInsight && (
                        <p className="mt-2 max-w-sm text-sm leading-6 text-[#166534]">{analysisResult.aiInsight}</p>
                      )}
                      {typeof analysisResult.confidence === 'number' && (
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
                          Confidence {Math.round(analysisResult.confidence * 100)}%
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl bg-[#f0fdf4] px-4 py-3 text-right flex-shrink-0">
                      <div className="font-display text-[1.8rem] font-semibold text-[#166534]">{analysisResult.totalCalories}</div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[#6b7280]">kcal</div>
                    </div>
                  </div>

                  {analysisResult.mealType && (
                    <div className="mt-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">Detected: </span>
                      <span className="text-[11px] text-[#374151] capitalize">{analysisResult.mealType.replace(/_/g, ' ')}</span>
                    </div>
                  )}

                  <div className="mt-4 space-y-2.5">
                    {[
                      { label: 'Protein', value: analysisResult.proteinG, color: '#93C5FD' },
                      { label: 'Carbs', value: analysisResult.carbsG, color: '#86EFAC' },
                      { label: 'Fat', value: analysisResult.fatG, color: '#FCD34D' },
                    ].map((macro) => (
                      <div key={macro.label} className="flex items-center gap-3">
                        <span className="w-12 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">{macro.label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e7eb]">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.round((macro.value / maxMacro) * 100)}%`, background: macro.color }} />
                        </div>
                        <span className="w-10 text-right text-[13px] font-semibold text-[#111827]">{macro.value}g</span>
                      </div>
                    ))}
                  </div>

                  {analysisResult.items.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {analysisResult.items.map((item) => (
                        <span key={`${item.name}-${item.portion}`}
                          className="rounded-full border border-[#e5e7eb] bg-[#fcfcfb] px-2.5 py-1 text-[11px] font-medium text-[#6b7280]">
                          {item.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {analysisResult.assumptions && analysisResult.assumptions.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-[#f8fafc] px-3 py-2 text-xs leading-6 text-[#64748b]">
                      Based on {analysisResult.assumptions.slice(0, 2).join('; ')}
                    </div>
                  )}

                  <div className="mt-5">
                    <Button fullWidth onClick={logMeal} loading={aiLoading}>Add to today&apos;s log</Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Logged meals */}
            <SectionHeader title="Logged today" action="Review entries" />
            <div className="space-y-3">
              {loading ? (
                <>{[1, 2, 3].map((item) => <Skeleton key={item} className="h-[92px] rounded-[24px]" />)}</>
              ) : meals.length === 0 ? (
                <Card padding="none">
                  <div className="flex flex-col items-center py-12 px-6 text-center">
                    <div className="text-4xl mb-3">🍽️</div>
                    <div className="text-[15px] font-semibold text-[#111827]">Nothing logged yet</div>
                    <p className="mt-2 text-sm text-[#6b7280]">Log a meal above — VitalIQ will estimate the macros instantly.</p>
                  </div>
                </Card>
              ) : (
                meals.map((meal) => (
                  <Card key={meal.id} padding="none">
                    <div className="flex items-start gap-4 p-5">
                      <div
                        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-[11px] font-semibold uppercase tracking-[0.18em] text-[#111827]"
                        style={{ background: MEAL_COLORS[meal.mealType] || '#F1F1EC' }}
                      >
                        {MEAL_ICONS[meal.mealType] || 'ME'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-semibold text-[#111827]">{meal.description}</div>
                        <div className="mt-1 text-sm text-[#6b7280]">
                          P {Math.round(meal.proteinG)}g · C {Math.round(meal.carbsG)}g · F {Math.round(meal.fatG)}g
                          {meal.mealType ? ` · ${meal.mealType.replace(/_/g, ' ')}` : ''}
                        </div>
                        {meal.aiInsight && (
                          <div className="mt-2.5 rounded-xl bg-[#f0fdf4] px-3 py-2 text-xs font-medium text-[#166534]">
                            {meal.aiInsight}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="rounded-2xl bg-[#fcfcfb] border border-[#f1f1ec] px-3 py-2 text-right">
                          <div className="font-display text-[1.35rem] font-semibold text-[#111827]">{meal.calories}</div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[#6b7280]">kcal</div>
                        </div>
                        {/* UX 3: Delete button */}
                        <button
                          onClick={() => deleteMeal(meal.id)}
                          className="w-7 h-7 rounded-full bg-[#FEE2E2] text-[#DC4A3D] text-[13px] font-bold hover:bg-[#DC4A3D] hover:text-white transition-all flex items-center justify-center"
                          title="Remove this meal"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT: Calorie summary + macros + hydration (sticky) ── */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">

            {/* Calorie summary */}
            <Card padding="lg">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[15px] font-semibold text-[#111827]">Today&apos;s intake</div>
                <Chip variant={calPct > 100 ? 'coral' : calPct > 80 ? 'amber' : 'green'}>
                  {Math.round(calPct)}% of target
                </Chip>
              </div>
              <p className="mt-1 text-sm text-[#6b7280]">
                {totals.calories.toLocaleString()} / {target.toLocaleString()} kcal consumed
              </p>

              <div className="mt-4">
                <div className="font-display text-[2.8rem] font-semibold leading-none text-[#111827]">
                  {remaining.toLocaleString()}
                </div>
                <div className="mt-1.5 text-sm text-[#6b7280]">kcal remaining today</div>
              </div>

              <ProgressBar
                className="mt-4"
                value={totals.calories}
                max={target}
                color={calPct > 100 ? '#DC4A3D' : '#2D6A4F'}
                height={8}
              />

              {/* Macro bars */}
              <div className="mt-5 space-y-3.5">
                {macroSummary.map((macro) => (
                  <div key={macro.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[12px] font-semibold text-[#374151]">
                        {macro.label}
                        <span className="ml-1.5 text-[#9ca3af] font-normal">
                          {Math.round(macro.val)}/{macro.target}{macro.unit}
                        </span>
                      </div>
                      <span
                        className="text-[11px] font-semibold rounded-full px-2 py-0.5"
                        style={{ background: macro.color, color: '#111827' }}
                      >
                        {Math.round((macro.val / macro.target) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, (macro.val / macro.target) * 100)}%`,
                          background: macro.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Hydration */}
            <Card padding="lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[15px] font-semibold text-[#111827]">Hydration</div>
                  <div className="mt-0.5 text-sm text-[#6b7280]">{glasses} of 8 glasses · {glasses * 250}ml</div>
                </div>
                <Chip variant="blue">{glasses} / 8</Chip>
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {Array.from({ length: 8 }, (_, index) => (
                  <button
                    key={index}
                    onClick={() => setGlassesAndSave(glasses + 1)}
                    className={clsx(
                      'h-8 rounded-xl transition-all',
                      index < glasses ? 'bg-[#93C5FD]' : 'bg-[#E8E8E3] hover:bg-[#bfdbfe]'
                    )}
                    aria-label={`Log glass ${index + 1}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setGlassesAndSave(glasses + 1)}
                  disabled={glasses >= 8}
                  className="flex-1 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2.5 text-sm font-semibold text-[#1d4ed8] transition-colors hover:bg-[#dbeafe] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {glasses >= 8 ? '🥤 Goal reached!' : '+ Add glass (250ml)'}
                </button>
                {glasses > 0 && (
                  <button
                    onClick={() => setGlassesAndSave(glasses - 1)}
                    className="rounded-xl border border-[#E8E8E3] bg-white px-3 py-2.5 text-sm font-medium text-[#8A8A85] hover:bg-[#F1F1EC] transition-colors"
                  >
                    Undo
                  </button>
                )}
              </div>
            </Card>

            {/* Meal pacing */}
            <Card padding="lg" className="bg-[#f8fafc]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[#64748b] mb-2">Meal pacing</div>
              <div className="font-display text-[1.4rem] font-semibold leading-tight text-[#111827]">
                {remaining > 0
                  ? `${remaining.toLocaleString()} kcal left to fill today.`
                  : "You've hit your calorie target. 🎉"}
              </div>
              <p className="mt-3 text-sm leading-6 text-[#475569]">
                {remainingProtein > 0
                  ? `Still ${Math.round(remainingProtein)}g short on protein. Prioritize a protein source in your next meal.`
                  : 'Protein target hit. Focus on quality carbs and good fats to finish the day.'}
              </p>
            </Card>
          </div>

        </div>
      </section>
    </AppShell>
  )
}
