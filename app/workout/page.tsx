'use client'
// app/workout/page.tsx

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import AppShell from '@/components/layout/AppShell'
import { Card, SectionHeader, Button } from '@/components/ui'
import { validateWorkoutGeneration } from '@/lib/llm-validation'
import { withTimeZone } from '@/lib/client-time'
import { useDashboard } from '@/lib/useDashboard'
import {
  getElapsedWorkoutSeconds,
  getWorkoutStartedAtIso,
  parseWorkoutRepsOrDuration,
  parseWorkoutWeightKg,
  recoverWorkoutTimerState,
} from '@/lib/workout-utils'
import { clsx } from 'clsx'

interface Exercise {
  name: string
  sets: number
  repsOrDuration: string
  weight: string
  restSec?: number
  tip?: string
}

interface WorkoutSession {
  id?: string
  title: string
  sessionType: string
  durationMins: number
  estimatedCalories: number
  coachNote: string
  exercises: Exercise[]
  source?: 'ai' | 'fallback'
}

interface UserProfile {
  goal: string
  weightKg: number
  sex: string
  readinessScore: number
}

type Environment = 'home' | 'outdoor' | 'gym'
type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'

interface WorkoutDraft {
  version: number
  environment: Environment
  fitnessLevel: FitnessLevel
  workoutSession: WorkoutSession | null
  completedSets: Record<string, boolean>
  timer: number
  timerRunning: boolean
  timerStartedAtMs: number | null
  savedAt: number
}

interface WorkoutExercisePayload {
  name: string
  sets: number
  repsOrDuration: string
  reps?: number
  durationSec?: number
  weight: string
  weightKg?: number
  restSec?: number
  tip?: string
  completedSets: boolean[]
}

const WORKOUT_DRAFT_STORAGE_PREFIX = 'vitaliq:workout-draft:v2:'
const WORKOUT_DRAFT_VERSION = 2

const ENVIRONMENTS: { id: Environment; icon: string; label: string; desc: string }[] = [
  { id: 'home',    icon: '🏠', label: 'Home',    desc: 'Bodyweight, bands, dumbbells' },
  { id: 'outdoor', icon: '🌿', label: 'Outdoor', desc: 'Running, parks, bodyweight' },
  { id: 'gym',     icon: '🏋️', label: 'Gym',     desc: 'Full equipment, machines' },
]

const FITNESS_LEVELS: { id: FitnessLevel; label: string; desc: string }[] = [
  { id: 'beginner',     label: 'Beginner',     desc: 'New to structured training' },
  { id: 'intermediate', label: 'Intermediate', desc: '6+ months consistent training' },
  { id: 'advanced',     label: 'Advanced',     desc: '2+ years, structured programs' },
]

const SESSION_TYPE_COLORS: Record<string, string> = {
  push:      'linear-gradient(135deg,#1a1a1a,#2d6a4f)',
  pull:      'linear-gradient(135deg,#1a1a1a,#1D4ED8)',
  legs:      'linear-gradient(135deg,#1a1a1a,#6D28D9)',
  full_body: 'linear-gradient(135deg,#1a1a1a,#B45309)',
  cardio:    'linear-gradient(135deg,#1a1a1a,#DC4A3D)',
  hiit:      'linear-gradient(135deg,#1a1a1a,#DC4A3D)',
  yoga:      'linear-gradient(135deg,#1a1a1a,#0891b2)',
  rest:      'linear-gradient(135deg,#374151,#6b7280)',
}

// Realistic fallback workouts by environment so API failures still feel real
const FALLBACK_SESSIONS: Record<Environment, Record<FitnessLevel, WorkoutSession>> = {
  home: {
    beginner: {
      title: 'Home Foundation',
      sessionType: 'full_body',
      durationMins: 30,
      estimatedCalories: 200,
      coachNote: 'Focus on form over speed. Rest 60s between sets. These movements build your foundation.',
      exercises: [
        { name: 'Wall Push-ups',      sets: 3, repsOrDuration: '12 reps',    weight: 'bodyweight', tip: 'Keep core tight, straight line from head to heels' },
        { name: 'Chair Squats',       sets: 3, repsOrDuration: '15 reps',    weight: 'bodyweight', tip: 'Sit back like reaching for the chair, stand fully' },
        { name: 'Knee Plank',         sets: 3, repsOrDuration: '20 seconds', weight: 'bodyweight', tip: 'Squeeze your glutes, breathe steadily' },
        { name: 'Glute Bridge',       sets: 3, repsOrDuration: '15 reps',    weight: 'bodyweight', tip: 'Drive hips up, squeeze at the top for 1 second' },
        { name: 'Superman Hold',      sets: 3, repsOrDuration: '10 reps',    weight: 'bodyweight', tip: 'Lift arms and legs slowly, hold 2s at top' },
      ],
    },
    intermediate: {
      title: 'Home Power Circuit',
      sessionType: 'full_body',
      durationMins: 40,
      estimatedCalories: 320,
      coachNote: 'Minimal rest between exercises, 90s between rounds. Readiness is solid — push the intensity.',
      exercises: [
        { name: 'Push-ups',           sets: 4, repsOrDuration: '15 reps',    weight: 'bodyweight', tip: 'Lower chest to 1 inch from floor, full lockout at top' },
        { name: 'Jump Squats',        sets: 3, repsOrDuration: '12 reps',    weight: 'bodyweight', tip: 'Land softly, absorb through knees and hips' },
        { name: 'Plank to Downdog',   sets: 3, repsOrDuration: '10 reps',    weight: 'bodyweight', tip: 'Push floor away, keep core engaged throughout' },
        { name: 'Reverse Lunges',     sets: 3, repsOrDuration: '10 each leg', weight: 'bodyweight', tip: 'Back knee hovers 1 inch from floor' },
        { name: 'Mountain Climbers',  sets: 3, repsOrDuration: '30 seconds', weight: 'bodyweight', tip: 'Hips level, drive knees toward chest fast' },
        { name: 'Tricep Dips (chair)', sets: 3, repsOrDuration: '12 reps',   weight: 'bodyweight', tip: 'Elbows track back, not out' },
      ],
    },
    advanced: {
      title: 'Home HIIT Challenge',
      sessionType: 'hiit',
      durationMins: 50,
      estimatedCalories: 480,
      coachNote: 'Hard intervals with clean form. Work around an 8/10 effort and keep each round sharp.',
      exercises: [
        { name: 'Burpees',            sets: 4, repsOrDuration: '40 seconds', weight: 'bodyweight', tip: 'Full pushup at bottom, explosive jump at top' },
        { name: 'Pistol Squat (assisted)', sets: 3, repsOrDuration: '6 each leg', weight: 'bodyweight', tip: 'Use a door frame for balance if needed' },
        { name: 'Archer Push-ups',    sets: 4, repsOrDuration: '8 each side', weight: 'bodyweight', tip: 'Extended arm straight, working arm drives' },
        { name: 'Single-leg Glute Bridge', sets: 3, repsOrDuration: '15 each', weight: 'bodyweight', tip: 'Non-working leg extended, drive through heel' },
        { name: 'Plank Up-downs',     sets: 3, repsOrDuration: '30 seconds', weight: 'bodyweight', tip: 'Alternate arms, keep hips from rocking' },
        { name: 'Jumping Lunges',     sets: 4, repsOrDuration: '40 seconds', weight: 'bodyweight', tip: 'Switch legs in air, land in full lunge position' },
      ],
    },
  },
  outdoor: {
    beginner: {
      title: 'First Outdoor Session',
      sessionType: 'cardio',
      durationMins: 35,
      estimatedCalories: 220,
      coachNote: 'Easy effort — you should be able to hold a conversation throughout. Consistency beats intensity.',
      exercises: [
        { name: 'Brisk Walk',         sets: 1, repsOrDuration: '10 minutes', weight: 'bodyweight', tip: 'Arms swing naturally, chin up, full strides' },
        { name: 'Alternating Jog/Walk', sets: 4, repsOrDuration: '2 min jog / 1 min walk', weight: 'bodyweight', tip: 'Slow jog, not a sprint — sustainable pace' },
        { name: 'Park Bench Push-ups', sets: 3, repsOrDuration: '10 reps',   weight: 'bodyweight', tip: 'Incline push-up on bench edge' },
        { name: 'Step-ups',           sets: 3, repsOrDuration: '12 each leg', weight: 'bodyweight', tip: 'Drive through the heel of the stepping foot' },
        { name: 'Cool-down Walk',     sets: 1, repsOrDuration: '5 minutes',  weight: 'bodyweight', tip: 'Easy pace, deep breaths, let heart rate drop' },
      ],
    },
    intermediate: {
      title: 'Outdoor Run + Strength',
      sessionType: 'cardio',
      durationMins: 45,
      estimatedCalories: 400,
      coachNote: 'Blends cardio and functional strength. Run sections at 70% effort — controlled breathing.',
      exercises: [
        { name: 'Easy Warm-up Jog',   sets: 1, repsOrDuration: '5 minutes',  weight: 'bodyweight', tip: 'Conversation pace to prime the body' },
        { name: 'Tempo Run',          sets: 1, repsOrDuration: '15 minutes', weight: 'bodyweight', tip: '80% effort — breathing hard but controlled' },
        { name: 'Park Push-ups',      sets: 3, repsOrDuration: '15 reps',    weight: 'bodyweight', tip: 'Ground level, full range of motion' },
        { name: 'Bulgarian Split Squats (park bench)', sets: 3, repsOrDuration: '10 each leg', weight: 'bodyweight', tip: 'Rear foot elevated, knee tracks over toes' },
        { name: 'Sprint Intervals',   sets: 5, repsOrDuration: '20s sprint / 40s walk', weight: 'bodyweight', tip: 'Run fast but controlled, then fully recover' },
      ],
    },
    advanced: {
      title: 'Outdoor Athletic Circuit',
      sessionType: 'hiit',
      durationMins: 55,
      estimatedCalories: 560,
      coachNote: 'Athletic field session with strong but controlled output. Leave one gear in reserve and stay crisp.',
      exercises: [
        { name: 'Run Intervals',      sets: 5, repsOrDuration: '2 min fast / 1 min walk', weight: 'bodyweight', tip: 'Open controlled, then hold a strong repeatable pace' },
        { name: 'Explosive Push-ups', sets: 4, repsOrDuration: '10 reps',    weight: 'bodyweight', tip: 'Hands leave floor at top — clap optional' },
        { name: 'Box Jumps (bench)',  sets: 4, repsOrDuration: '8 reps',     weight: 'bodyweight', tip: 'Soft landing, step down (not jump)' },
        { name: 'Broad Jumps',        sets: 4, repsOrDuration: '6 reps',     weight: 'bodyweight', tip: 'Max horizontal distance each rep' },
        { name: 'Bear Crawl',         sets: 3, repsOrDuration: '20 metres',  weight: 'bodyweight', tip: 'Knees hover 2 inches from ground' },
      ],
    },
  },
  gym: {
    beginner: {
      title: 'Gym Orientation',
      sessionType: 'full_body',
      durationMins: 45,
      estimatedCalories: 280,
      coachNote: 'Light weights, perfect form. Every rep is about learning the movement pattern first.',
      exercises: [
        { name: 'Goblet Squat',       sets: 3, repsOrDuration: '12 reps', weight: '8–12kg', tip: 'Hold dumbbell at chest, squat between knees' },
        { name: 'DB Chest Press',     sets: 3, repsOrDuration: '10 reps', weight: '6–10kg', tip: 'Feet flat, lower until elbows at 90°' },
        { name: 'Seated Cable Row',   sets: 3, repsOrDuration: '12 reps', weight: 'light',  tip: 'Pull to navel, elbows close to body' },
        { name: 'Leg Press',          sets: 3, repsOrDuration: '15 reps', weight: 'light',  tip: 'Feet shoulder-width, knees track toes' },
        { name: 'Plank',              sets: 3, repsOrDuration: '30 seconds', weight: 'bodyweight', tip: 'Straight line from ears to heels' },
      ],
    },
    intermediate: {
      title: 'Upper Body Strength',
      sessionType: 'push',
      durationMins: 55,
      estimatedCalories: 400,
      coachNote: 'Solid readiness for a strong strength session. Keep rest disciplined and every rep clean.',
      exercises: [
        { name: 'Bench Press',        sets: 4, repsOrDuration: '8 reps',  weight: 'challenging load', tip: 'Retract scapula, drive through feet' },
        { name: 'Incline DB Press',   sets: 3, repsOrDuration: '10 reps', weight: '24kg',    tip: 'Control the eccentric (lower slowly)' },
        { name: 'Overhead Press',     sets: 4, repsOrDuration: '8 reps',  weight: 'moderate-heavy', tip: 'Brace core, bar path straight up' },
        { name: 'Cable Lateral Raise', sets: 3, repsOrDuration: '15 reps', weight: 'light',  tip: 'Slight forward lean, lead with elbows' },
        { name: 'Tricep Pushdown',    sets: 3, repsOrDuration: '12 reps', weight: '30kg',    tip: 'Elbows pinned, only forearm moves' },
      ],
    },
    advanced: {
      title: 'Power & Hypertrophy',
      sessionType: 'push',
      durationMins: 70,
      estimatedCalories: 520,
      coachNote: 'Readiness is high for challenging compound work. Push the quality, but keep a little margin in reserve.',
      exercises: [
        { name: 'Barbell Squat',      sets: 5, repsOrDuration: '5 reps',  weight: 'challenging load', tip: 'Break at hips first, brace hard' },
        { name: 'Paused Bench Press', sets: 4, repsOrDuration: '6 reps',  weight: 'challenging load', tip: '1s pause on chest, explosive drive' },
        { name: 'Weighted Dips',      sets: 4, repsOrDuration: '8 reps',  weight: '+15kg',   tip: 'Slight forward lean for chest focus' },
        { name: 'DB Incline Flyes',   sets: 3, repsOrDuration: '12 reps', weight: '18kg',    tip: 'Long arc, slight bend in elbows' },
        { name: 'Face Pulls',         sets: 3, repsOrDuration: '20 reps', weight: 'light',   tip: 'Protects shoulder health, never skip' },
        { name: 'Skull Crushers',     sets: 3, repsOrDuration: '10 reps', weight: '20kg',    tip: 'Elbows stationary, lower to forehead' },
      ],
    },
  },
}

const LOW_READINESS_FALLBACKS: Record<Environment, WorkoutSession> = {
  home: {
    title: 'Home Recovery Reset',
    sessionType: 'yoga',
    durationMins: 25,
    estimatedCalories: 120,
    coachNote: 'Readiness is lower today. Keep the effort light, move smoothly, and finish feeling better than you started.',
    exercises: [
      { name: 'Cat-Cow Flow', sets: 2, repsOrDuration: '60 seconds', weight: 'bodyweight', restSec: 20, tip: 'Move slowly with your breath.' },
      { name: 'Dead Bug', sets: 3, repsOrDuration: '8 each side', weight: 'bodyweight', restSec: 30, tip: 'Keep your lower back gently braced.' },
      { name: 'Glute Bridge', sets: 3, repsOrDuration: '12 reps', weight: 'bodyweight', restSec: 30, tip: 'Pause briefly at the top.' },
      { name: 'Child\'s Pose', sets: 2, repsOrDuration: '45 seconds', weight: 'bodyweight', restSec: 15, tip: 'Relax your shoulders and jaw.' },
      { name: 'Easy Walk', sets: 1, repsOrDuration: '5 minutes', weight: 'bodyweight', restSec: 0, tip: 'Use an easy, nasal-breathing pace.' },
    ],
  },
  outdoor: {
    title: 'Outdoor Recovery Walk',
    sessionType: 'cardio',
    durationMins: 35,
    estimatedCalories: 180,
    coachNote: 'Lower readiness calls for easy aerobic work today. Keep the pace conversational and stay loose.',
    exercises: [
      { name: 'Easy Walk', sets: 1, repsOrDuration: '20 minutes', weight: 'bodyweight', restSec: 0, tip: 'Keep your stride relaxed and smooth.' },
      { name: 'Walking Lunges', sets: 2, repsOrDuration: '8 each leg', weight: 'bodyweight', restSec: 30, tip: 'Take controlled steps and stay upright.' },
      { name: 'Bench Incline Push-ups', sets: 2, repsOrDuration: '10 reps', weight: 'bodyweight', restSec: 45, tip: 'Stop a rep before form slows down.' },
      { name: 'Calf Raises', sets: 2, repsOrDuration: '15 reps', weight: 'bodyweight', restSec: 20, tip: 'Use a full range and steady tempo.' },
      { name: 'Cool-down Walk', sets: 1, repsOrDuration: '5 minutes', weight: 'bodyweight', restSec: 0, tip: 'Let your breathing settle fully.' },
    ],
  },
  gym: {
    title: 'Gym Recovery Circuit',
    sessionType: 'full_body',
    durationMins: 40,
    estimatedCalories: 220,
    coachNote: 'Today is about quality movement, not pushing load. Keep every set light and crisp.',
    exercises: [
      { name: 'Bike Warm-up', sets: 1, repsOrDuration: '5 minutes', weight: 'bodyweight', restSec: 0, tip: 'Stay at an easy spin pace.' },
      { name: 'Goblet Squat', sets: 2, repsOrDuration: '10 reps', weight: 'light', restSec: 45, tip: 'Move with full control and depth.' },
      { name: 'Seated Cable Row', sets: 2, repsOrDuration: '12 reps', weight: 'light', restSec: 45, tip: 'Pause briefly with your shoulder blades back.' },
      { name: 'Walking Lunges', sets: 2, repsOrDuration: '8 each leg', weight: 'bodyweight', restSec: 45, tip: 'Take deliberate, stable steps.' },
      { name: 'Bike Cool-down', sets: 1, repsOrDuration: '8 minutes', weight: 'bodyweight', restSec: 0, tip: 'Finish at a very easy effort.' },
    ],
  },
}

const DEFAULT_PROFILE: UserProfile = { goal: 'maintain', weightKg: 70, sex: 'male', readinessScore: 70 }

function isEnvironment(value: unknown): value is Environment {
  return value === 'home' || value === 'outdoor' || value === 'gym'
}

function isFitnessLevel(value: unknown): value is FitnessLevel {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced'
}

function buildWorkoutDraftKey(userKey: string) {
  return `${WORKOUT_DRAFT_STORAGE_PREFIX}${userKey}`
}

function cloneWorkoutSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({ ...exercise })),
  }
}

function getFallbackWorkoutSession(
  environment: Environment,
  fitnessLevel: FitnessLevel,
  readinessScore: number
): WorkoutSession {
  const session = readinessScore < 50
    ? LOW_READINESS_FALLBACKS[environment]
    : FALLBACK_SESSIONS[environment][fitnessLevel]

  return { ...cloneWorkoutSession(session), source: 'fallback' }
}

function buildWorkoutPayload(
  workoutSession: WorkoutSession,
  completedSets: Record<string, boolean>,
  elapsedSeconds: number
) {
  const actualDurationMins = elapsedSeconds > 0 ? Math.max(1, Math.round(elapsedSeconds / 60)) : workoutSession.durationMins
  const startedAt = getWorkoutStartedAtIso(elapsedSeconds)

  return {
    title: workoutSession.title,
    sessionType: workoutSession.sessionType,
    durationMins: actualDurationMins,
    estimatedCalories: workoutSession.estimatedCalories,
    aiGenerated: workoutSession.source !== 'fallback',
    notes: workoutSession.coachNote,
    startedAt,
    completedAt: new Date().toISOString(),
    exercises: workoutSession.exercises.map<WorkoutExercisePayload>((exercise, exerciseIdx) => {
      const parsed = parseWorkoutRepsOrDuration(exercise.repsOrDuration)

      return {
        name: exercise.name,
        sets: exercise.sets,
        repsOrDuration: exercise.repsOrDuration,
        reps: parsed.reps ?? undefined,
        durationSec: parsed.durationSec ?? undefined,
        weight: exercise.weight,
        weightKg: parseWorkoutWeightKg(exercise.weight) ?? undefined,
        restSec: exercise.restSec,
        tip: exercise.tip,
        completedSets: Array.from({ length: exercise.sets }, (_, setIdx) =>
          Boolean(completedSets[`${exerciseIdx}-${setIdx}`])
        ),
      }
    }),
  }
}

export default function WorkoutPage() {
  const { data: session, status } = useSession()
  const { dashboard, loading: dashboardLoading, error, clearDashboard } = useDashboard()
  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(null)
  const [generating, setGenerating] = useState(false)
  const [savingCompletion, setSavingCompletion] = useState(false)
  const [completedSets, setCompletedSets] = useState<Record<string, boolean>>({})
  const [timer, setTimer] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStartedAtMs, setTimerStartedAtMs] = useState<number | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [environment, setEnvironment] = useState<Environment>('home')
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('intermediate')
  const [completionError, setCompletionError] = useState<string | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [restoredDraft, setRestoredDraft] = useState(false)

  const draftStorageKey = session?.user?.id
    ? buildWorkoutDraftKey(String(session.user.id))
    : null

  // UX 5: use shared dashboard hook — pre-filled from cache, no extra fetch
  useEffect(() => {
    if (!dashboard) return
    setUserProfile({
      goal: dashboard.user?.goal ?? 'maintain',
      weightKg: dashboard.user?.weightKg ?? 70,
      sex: dashboard.user?.sex ?? 'male',
      readinessScore: dashboard.readiness?.score ?? 70,
    })
  }, [dashboard])

  useEffect(() => {
    if (status === 'loading') return

    if (typeof window === 'undefined') {
      setDraftReady(true)
      return
    }

    if (!draftStorageKey) {
      setDraftReady(true)
      return
    }

    try {
      const raw = window.sessionStorage.getItem(draftStorageKey)
      if (!raw) {
        setDraftReady(true)
        return
      }

      const draft = JSON.parse(raw) as WorkoutDraft
      if (draft.version !== WORKOUT_DRAFT_VERSION) {
        window.sessionStorage.removeItem(draftStorageKey)
        setDraftReady(true)
        return
      }

      setEnvironment(isEnvironment(draft.environment) ? draft.environment : 'home')
      setFitnessLevel(isFitnessLevel(draft.fitnessLevel) ? draft.fitnessLevel : 'intermediate')
      setWorkoutSession(draft.workoutSession)
      setCompletedSets(draft.workoutSession ? draft.completedSets ?? {} : {})

      const recoveredTimerState = recoverWorkoutTimerState(draft)

      setTimer(recoveredTimerState.timer)
      setTimerRunning(Boolean(draft.workoutSession && recoveredTimerState.timerRunning))
      setTimerStartedAtMs(draft.workoutSession ? recoveredTimerState.timerStartedAtMs : null)
      setRestoredDraft(Boolean(draft.workoutSession))
    } catch {
      window.sessionStorage.removeItem(draftStorageKey)
    } finally {
      setDraftReady(true)
    }
  }, [draftStorageKey, status])

  useEffect(() => {
    if (!timerRunning || timerStartedAtMs == null) return

    const syncTimer = () => {
      setTimer(getElapsedWorkoutSeconds(0, true, timerStartedAtMs))
    }

    syncTimer()

    const interval = window.setInterval(syncTimer, 1000)
    window.addEventListener('visibilitychange', syncTimer)
    window.addEventListener('focus', syncTimer)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('visibilitychange', syncTimer)
      window.removeEventListener('focus', syncTimer)
    }
  }, [timerRunning, timerStartedAtMs])

  useEffect(() => {
    if (!draftReady || typeof window === 'undefined' || !draftStorageKey) return

    const shouldPersist = Boolean(workoutSession) || environment !== 'home' || fitnessLevel !== 'intermediate'
    if (!shouldPersist) {
      window.sessionStorage.removeItem(draftStorageKey)
      return
    }

    const draft: WorkoutDraft = {
      version: WORKOUT_DRAFT_VERSION,
      environment,
      fitnessLevel,
      workoutSession,
      completedSets: workoutSession ? completedSets : {},
      timer: getElapsedWorkoutSeconds(timer, timerRunning, timerStartedAtMs),
      timerRunning: Boolean(workoutSession && timerRunning),
      timerStartedAtMs: workoutSession && timerRunning ? timerStartedAtMs : null,
      savedAt: Date.now(),
    }

    window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft))
  }, [
    completedSets,
    draftReady,
    draftStorageKey,
    environment,
    fitnessLevel,
    timer,
    timerRunning,
    timerStartedAtMs,
    workoutSession,
  ])

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const getEquipmentDescription = (env: Environment) => {
    if (env === 'home') return 'home (bodyweight, minimal equipment)'
    if (env === 'outdoor') return 'outdoor (bodyweight, park, running)'
    return 'full gym (barbells, machines, cables)'
  }

  const resetTimerState = () => {
    setTimer(0)
    setTimerRunning(false)
    setTimerStartedAtMs(null)
  }

  const toggleTimer = () => {
    if (timerRunning) {
      setTimer(getElapsedWorkoutSeconds(timer, true, timerStartedAtMs))
      setTimerRunning(false)
      setTimerStartedAtMs(null)
      return
    }

    setTimerStartedAtMs(Date.now() - Math.max(0, Math.floor(timer)) * 1000)
    setTimerRunning(true)
  }

  const hasInProgressWorkout = Boolean(workoutSession) && (timerRunning || timer > 0 || Object.values(completedSets).some(Boolean))
  const canReplaceWorkout = () => {
    if (!hasInProgressWorkout || typeof window === 'undefined') return true

    return window.confirm('Generate a new workout? Your current timer and completed sets will be cleared.')
  }

  const resetWorkout = (options?: { force?: boolean }) => {
    if (!options?.force && !canReplaceWorkout()) return

    setWorkoutSession(null)
    setCompletedSets({})
    resetTimerState()
    setRestoredDraft(false)
    setCompletionError(null)

    if (typeof window !== 'undefined' && draftStorageKey) {
      window.sessionStorage.removeItem(draftStorageKey)
    }
  }

  const generateWorkout = async () => {
    if (generating || !readyForGeneration || !dashboard?.user || !dashboard?.readiness) return
    if (!canReplaceWorkout()) return

    setGenerating(true)
    setCompletionError(null)
    setRestoredDraft(false)

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'workout_generation',
          payload: {
            userContext: {
              goal: userProfile.goal,
              weightKg: userProfile.weightKg,
              sex: userProfile.sex,
              fitnessLevel,
              environment,
            },
            readinessScore: userProfile.readinessScore,
            equipment: getEquipmentDescription(environment),
            fitnessLevel,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Workout generation failed')
      }

      const candidate = data.result as WorkoutSession | undefined
      const validatedCandidate = validateWorkoutGeneration(candidate, {
        bodyweightOnly: environment !== 'gym',
        readinessScore: userProfile.readinessScore,
      })

      if (validatedCandidate.ok) {
        setWorkoutSession({ ...validatedCandidate.value, source: 'ai' })
        setCompletedSets({})
        resetTimerState()
        setGenerating(false)
        return
      }
    } catch { /* fall through to fallback */ }

    setWorkoutSession(getFallbackWorkoutSession(environment, fitnessLevel, userProfile.readinessScore))
    setCompletedSets({})
    resetTimerState()
    setGenerating(false)
  }

  const completeWorkout = async () => {
    if (!workoutSession || completedCount === 0) return

    setSavingCompletion(true)
    setCompletionError(null)

    try {
      const elapsedSeconds = getElapsedWorkoutSeconds(timer, timerRunning, timerStartedAtMs)
      const saveRes = await fetch(withTimeZone('/api/workouts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildWorkoutPayload(workoutSession, completedSets, elapsedSeconds)),
      })

      if (!saveRes.ok) {
        throw new Error('Workout save failed')
      }

      clearDashboard()
      resetWorkout({ force: true })
    } catch {
      setCompletionError('We could not save this workout yet. Your progress is still here, so you can retry.')
    } finally {
      setSavingCompletion(false)
    }
  }

  const toggleSet = (exerciseIdx: number, setIdx: number) => {
    setCompletionError(null)
    const key = `${exerciseIdx}-${setIdx}`
    setCompletedSets(s => ({ ...s, [key]: !s[key] }))
  }

  const completedCount = Object.values(completedSets).filter(Boolean).length
  const totalSets = workoutSession?.exercises.reduce((s, e) => s + e.sets, 0) ?? 0
  const progress = totalSets > 0 ? completedCount / totalSets : 0
  const elapsedTimer = getElapsedWorkoutSeconds(timer, timerRunning, timerStartedAtMs)
  const readyForGeneration =
    status === 'authenticated' &&
    draftReady &&
    !dashboardLoading &&
    !error &&
    Boolean(dashboard?.user) &&
    Boolean(dashboard?.readiness)

  return (
    <AppShell>
      {/* Premium Hero Header */}
      <section className="px-4 pb-6 pt-2 lg:px-0 lg:pt-2">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(140deg,#edf7f0_0%,#fafaf7_46%,#e8eeff_100%)] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                Training workspace
              </div>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-[#111827] sm:text-[3rem]">
                Train with precision.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#4b5563] sm:text-[15px]">
                Generate a session tailored to your readiness, goal, fitness level, and environment — then log sets in real time.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[440px]">
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Readiness</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">{userProfile.readinessScore}</div>
                <div className="text-xs text-[#6b7280]">out of 100</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Goal</div>
                <div className="mt-2 font-display text-[1.25rem] font-semibold capitalize text-[#111827]">{userProfile.goal.replace('_', ' ')}</div>
                <div className="text-xs text-[#6b7280]">primary focus</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-[#111827] p-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Status</div>
                <div className="mt-2 font-display text-[1.25rem] font-semibold">
                  {workoutSession ? `${completedCount}/${totalSets}` : 'Ready'}
                </div>
                <div className="text-xs text-white/60">{workoutSession ? 'sets done' : 'to generate'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#B91C1C]">
          <span>{error}</span>
          <button
            type="button"
            onClick={clearDashboard}
            className="shrink-0 rounded-lg border border-[#FCA5A5] px-3 py-1 text-[11px] font-semibold text-[#991B1B] transition-colors hover:bg-[#FEE2E2]"
          >
            Retry context
          </button>
        </div>
      )}

      {!workoutSession ? (
        <div className="px-4">
          {/* Environment selector */}
          <SectionHeader title="Where are you working out?" />
          <div className="grid grid-cols-3 gap-3 mb-6">
            {ENVIRONMENTS.map(env => (
              <button
                key={env.id}
                onClick={() => setEnvironment(env.id)}
                className={clsx(
                  'rounded-2xl p-4 text-left transition-all border',
                  environment === env.id
                    ? 'bg-[#111827] text-white border-[#111827] shadow-lg scale-[1.02]'
                    : 'bg-white border-[#E8E8E3] hover:border-[#111827] hover:shadow-sm'
                )}
              >
                <div className="text-[24px] mb-2">{env.icon}</div>
                <div className={clsx('text-[13px] font-semibold', environment === env.id ? 'text-white' : 'text-[#111827]')}>
                  {env.label}
                </div>
                <div className={clsx('text-[11px] mt-0.5 leading-relaxed', environment === env.id ? 'text-white/60' : 'text-[#8A8A85]')}>
                  {env.desc}
                </div>
              </button>
            ))}
          </div>

          {/* Fitness level selector */}
          <SectionHeader title="Your fitness level" />
          <div className="flex flex-col gap-2 mb-8">
            {FITNESS_LEVELS.map(level => (
              <button
                key={level.id}
                onClick={() => setFitnessLevel(level.id)}
                className={clsx(
                  'flex items-center justify-between rounded-2xl px-4 py-3.5 text-left transition-all border',
                  fitnessLevel === level.id
                    ? 'bg-[#111827] text-white border-[#111827]'
                    : 'bg-white border-[#E8E8E3] hover:border-[#8A8A85]'
                )}
              >
                <div>
                  <div className={clsx('text-[14px] font-semibold', fitnessLevel !== level.id && 'text-[#111827]')}>
                    {level.label}
                  </div>
                  <div className={clsx('text-[12px] mt-0.5', fitnessLevel === level.id ? 'text-white/60' : 'text-[#8A8A85]')}>
                    {level.desc}
                  </div>
                </div>
                {fitnessLevel === level.id && (
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Generate CTA */}
          <div className="flex flex-col items-center pb-8">
            <Button
              onClick={generateWorkout}
              loading={generating}
              disabled={!readyForGeneration}
              size="lg"
              fullWidth
            >
              {generating ? 'Building your personalised plan…' : `⚡ Generate ${ENVIRONMENTS.find(e => e.id === environment)?.label} Workout`}
            </Button>
            <p className="mt-3 text-[12px] text-[#8A8A85] text-center">
              {error
                ? 'We could not load your readiness context yet. Retry and generate once your dashboard is back.'
                : readyForGeneration
                ? `Powered by Gemini AI · Adapted to readiness ${userProfile.readinessScore}/100`
                : 'Loading your readiness, goal, and recovery context...'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Session Hero */}
          <div
            className="mx-4 mb-4 p-6 rounded-3xl text-white relative overflow-hidden"
            style={{ background: SESSION_TYPE_COLORS[workoutSession.sessionType] ?? SESSION_TYPE_COLORS.full_body }}
          >
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-2">
              {workoutSession.source === 'fallback' ? 'Backup plan' : 'AI-generated'} · {environment} · {fitnessLevel} · {workoutSession.sessionType.replace(/_/g, ' ')}
            </div>
            <div className="font-display text-[26px] font-bold mb-1">{workoutSession.title}</div>
            <div className="text-[13px] opacity-70 mb-4">{workoutSession.coachNote}</div>
            {restoredDraft && (
              <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/80">
                Restored after refresh
              </div>
            )}

            <div className="flex gap-5">
              {[
                { v: workoutSession.exercises.length, l: 'Exercises' },
                { v: `~${workoutSession.durationMins}`, l: 'Min' },
                { v: `~${workoutSession.estimatedCalories}`, l: 'Kcal' },
                { v: formatTime(elapsedTimer), l: elapsedTimer > 0 || timerRunning ? 'Elapsed' : 'Timer' },
              ].map(({ v, l }) => (
                <div key={l} className="text-center">
                  <div className="font-display text-[20px] font-bold">{v}</div>
                  <div className="text-[10px] opacity-60 uppercase tracking-wide">{l}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={toggleTimer}
                className="px-4 py-2 rounded-xl bg-white/15 text-white text-[12px] font-semibold hover:bg-white/25 transition-colors"
              >
                {timerRunning ? '⏸ Pause' : elapsedTimer > 0 ? '▶ Resume timer' : '▶ Start timer'}
              </button>
              <button
                onClick={resetTimerState}
                className="px-3 py-2 rounded-xl bg-white/10 text-white text-[12px] hover:bg-white/20 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => resetWorkout()}
                className="ml-auto px-3 py-2 rounded-xl bg-white/10 text-white text-[12px] hover:bg-white/20 transition-colors"
              >
                ↺ New plan
              </button>
            </div>

            {totalSets > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] opacity-60 mb-1.5">
                  <span>{completedCount} sets done</span>
                  <span>{totalSets - completedCount} remaining</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progress * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Exercise List */}
          <SectionHeader
            title="Exercises"
            action="Regenerate ↺"
            onAction={generateWorkout}
            actionDisabled={generating}
          />

          <div className="px-4 flex flex-col gap-3 mb-4">
            {workoutSession.exercises.map((ex, exIdx) => {
              const completedInEx = Array.from({ length: ex.sets }, (_, i) => completedSets[`${exIdx}-${i}`]).filter(Boolean).length
              const allDone = completedInEx === ex.sets

              return (
                <Card key={`${ex.name}-${exIdx}`} padding="none" className={clsx(allDone && 'opacity-75')}>
                  <div className="flex items-center gap-3 p-4">
                    <div className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold flex-shrink-0 transition-all',
                      allDone ? 'bg-[#2D6A4F] text-white' : 'bg-[#1A1A1A] text-white'
                    )}>
                      {allDone ? '✓' : exIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={clsx('text-[14px] font-semibold', allDone && 'line-through text-[#8A8A85]')}>
                        {ex.name}
                      </div>
                      <div className="text-[12px] text-[#8A8A85] mt-0.5">
                        {ex.sets} × {ex.repsOrDuration}
                        {ex.weight && ex.weight !== 'bodyweight' && ` · ${ex.weight}`}
                      </div>
                    </div>
                    <div className="text-[11px] font-semibold text-[#8A8A85]">{completedInEx}/{ex.sets}</div>
                  </div>

                  <div className="px-4 pb-4 flex gap-2">
                    {Array.from({ length: ex.sets }, (_, setIdx) => {
                      const done = completedSets[`${exIdx}-${setIdx}`]
                      return (
                        <button
                          key={setIdx}
                          onClick={() => toggleSet(exIdx, setIdx)}
                          className={clsx(
                            'flex-1 py-2.5 rounded-xl text-[11px] font-semibold transition-all',
                            done ? 'bg-[#2D6A4F] text-white' : 'bg-[#F1F1EC] text-[#8A8A85] hover:bg-[#E8E8E3]'
                          )}
                        >
                          {done ? '✓' : `Set ${setIdx + 1}`}
                        </button>
                      )
                    })}
                  </div>

                  {ex.tip && (
                    <div className="px-4 pb-3 text-[11px] text-[#8A8A85] italic">
                      💡 {ex.tip}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {completionError && (
            <div className="px-4 mb-4">
              <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#B91C1C]">
                {completionError}
              </div>
            </div>
          )}

          {completedCount > 0 && (
            <div className="px-4 mb-4">
              <Button
                fullWidth
                loading={savingCompletion}
                variant={progress >= 1 ? 'primary' : 'secondary'}
                onClick={completeWorkout}
              >
                {progress >= 1 ? '🎉 Complete workout' : `Complete (${completedCount}/${totalSets} sets)`}
              </Button>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
