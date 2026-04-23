import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { SESSION_TYPES } from '@/lib/llm-validation'
import { updateStreak } from '@/lib/streak'
import { parseWorkoutRepsOrDuration, parseWorkoutWeightKg } from '@/lib/workout-utils'

type WorkoutExerciseInput = {
  name?: string
  sets?: number
  tip?: string
  notes?: string
  reps?: number
  weightKg?: number
  durationSec?: number
  repsOrDuration?: string
  weight?: string
  restSec?: number
  completedSets?: unknown
}

const MAX_WORKOUT_DURATION_MINS = 240
const MAX_WORKOUT_CALORIES = 2000
const MAX_EXERCISES = 20
const MAX_SETS_PER_EXERCISE = 10
const MAX_REPS_PER_SET = 500
const MAX_SET_DURATION_SEC = 60 * 60
const MAX_WEIGHT_KG = 1000
const ALLOWED_SESSION_TYPES = new Set<string>(SESSION_TYPES)

function parseBoundedInt(
  value: unknown,
  options: { min?: number; max: number }
) {
  const parsed = Number(value)
  const min = options.min ?? 1

  if (!Number.isFinite(parsed) || parsed < min) return null
  return Math.min(options.max, Math.max(min, Math.round(parsed)))
}

function parseBoundedFloat(
  value: unknown,
  options: { min?: number; max: number }
) {
  const parsed = Number(value)
  const min = options.min ?? 0.1

  if (!Number.isFinite(parsed) || parsed < min) return null
  return Number(Math.min(options.max, Math.max(min, parsed)).toFixed(1))
}

function parseBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function parseDateValue(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function resolveWorkoutTiming(startedAt: unknown, durationMins: unknown) {
  const completedAtDate = new Date()
  const parsedStartedAt = parseDateValue(startedAt)
  const parsedDurationMins = parseBoundedInt(durationMins, { max: MAX_WORKOUT_DURATION_MINS })

  if (parsedStartedAt && parsedStartedAt <= completedAtDate) {
    const elapsedMins = Math.max(
      1,
      Math.round((completedAtDate.getTime() - parsedStartedAt.getTime()) / (1000 * 60))
    )
    const duration = Math.min(MAX_WORKOUT_DURATION_MINS, elapsedMins)

    return {
      startedAtDate: new Date(completedAtDate.getTime() - duration * 60 * 1000),
      completedAtDate,
      durationMins: duration,
    }
  }

  if (parsedDurationMins) {
    return {
      startedAtDate: new Date(completedAtDate.getTime() - parsedDurationMins * 60 * 1000),
      completedAtDate,
      durationMins: parsedDurationMins,
    }
  }

  return {
    startedAtDate: undefined,
    completedAtDate,
    durationMins: null,
  }
}

function buildSetStatuses(rawStatuses: unknown, setCount: number) {
  if (!Array.isArray(rawStatuses)) {
    return Array.from({ length: setCount }, () => false)
  }

  return Array.from({ length: setCount }, (_, index) => Boolean(rawStatuses[index]))
}

function buildExerciseNotes(
  exercise: WorkoutExerciseInput,
  parsed: ReturnType<typeof parseWorkoutRepsOrDuration>
) {
  const restSeconds = parseBoundedInt(exercise.restSec, { min: 1, max: 600 })
  const parts = [
    parsed.isAmrap
      ? 'AMRAP'
      : typeof exercise.repsOrDuration === 'string'
        ? exercise.repsOrDuration.trim()
        : null,
    typeof exercise.weight === 'string' &&
    exercise.weight.trim() &&
    exercise.weight.trim().toLowerCase() !== 'bodyweight'
      ? exercise.weight.trim()
      : null,
    restSeconds ? `Rest ${restSeconds}s` : null,
    typeof exercise.tip === 'string' ? exercise.tip.trim() : null,
    typeof exercise.notes === 'string' ? exercise.notes.trim() : null,
  ].filter(Boolean) as string[]

  return parts.length ? parts.join(' · ').slice(0, 500) : null
}

// GET - fetch recent completed workout sessions
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const rawLimit = parseInt(searchParams.get('limit') || '10', 10)
  const limit = Math.min(Math.max(rawLimit, 1), 50)

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    include: {
      exercises: {
        include: { sets: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { completedAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ sessions })
}

// POST - create a completed workout session
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const body = await req.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    title,
    sessionType,
    durationMins,
    estimatedCalories,
    exercises,
    aiGenerated,
    notes,
    startedAt,
  } = body as Record<string, unknown>

  const normalizedTitle = typeof title === 'string' ? title.trim().slice(0, 200) : ''
  if (!normalizedTitle) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (!Array.isArray(exercises) || exercises.length === 0) {
    return NextResponse.json({ error: 'exercises must be a non-empty array' }, { status: 400 })
  }

  if (exercises.length > MAX_EXERCISES) {
    return NextResponse.json({ error: `exercises cannot exceed ${MAX_EXERCISES}` }, { status: 400 })
  }

  const normalizedExercises = exercises.map((rawExercise: WorkoutExerciseInput, index: number) => {
    const setCount = parseBoundedInt(rawExercise?.sets, { max: MAX_SETS_PER_EXERCISE }) ?? 1
    const parsedFromText = parseWorkoutRepsOrDuration(rawExercise?.repsOrDuration)
    const reps = parseBoundedInt(rawExercise?.reps, { max: MAX_REPS_PER_SET }) ?? parsedFromText.reps
    const durationSec =
      parseBoundedInt(rawExercise?.durationSec, { max: MAX_SET_DURATION_SEC }) ??
      parsedFromText.durationSec
    const weightKg =
      parseBoundedFloat(rawExercise?.weightKg, { max: MAX_WEIGHT_KG }) ??
      parseWorkoutWeightKg(rawExercise?.weight)
    const completedSets = buildSetStatuses(rawExercise?.completedSets, setCount)

    return {
      name: String(rawExercise?.name || `Exercise ${index + 1}`).trim().slice(0, 200),
      orderIndex: index,
      notes: buildExerciseNotes(rawExercise ?? {}, parsedFromText),
      completedSetCount: completedSets.filter(Boolean).length,
      sets: Array.from({ length: setCount }, (_, setIndex) => ({
        setNumber: setIndex + 1,
        reps,
        weightKg,
        durationSec,
        completed: completedSets[setIndex],
      })),
    }
  })

  const completedSetCount = normalizedExercises.reduce(
    (sum, exercise) => sum + exercise.completedSetCount,
    0
  )

  if (completedSetCount === 0) {
    return NextResponse.json(
      { error: 'At least one completed set is required before saving a workout.' },
      { status: 400 }
    )
  }

  const { startedAtDate, completedAtDate, durationMins: resolvedDurationMins } = resolveWorkoutTiming(
    startedAt,
    durationMins
  )
  const normalizedSessionType =
    typeof sessionType === 'string' && ALLOWED_SESSION_TYPES.has(sessionType)
      ? sessionType
      : 'full_body'
  const normalizedCalories = parseBoundedInt(estimatedCalories, { max: MAX_WORKOUT_CALORIES })
  const normalizedNotes = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 1000) : null
  const normalizedAiGenerated = parseBoolean(aiGenerated, true)

  const workoutSession = await prisma.workoutSession.create({
    data: {
      userId,
      title: normalizedTitle,
      sessionType: normalizedSessionType,
      durationMins: resolvedDurationMins,
      caloriesBurned: normalizedCalories,
      aiGenerated: normalizedAiGenerated,
      notes: normalizedNotes,
      startedAt: startedAtDate,
      completedAt: completedAtDate,
      exercises: {
        create: normalizedExercises.map(({ completedSetCount: _completedSetCount, sets, ...exercise }) => ({
          ...exercise,
          sets: { create: sets },
        })),
      },
    },
    include: {
      exercises: {
        include: { sets: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC'
  await updateStreak(userId, tz).catch(() => {})

  return NextResponse.json({ session: workoutSession }, { status: 201 })
}

// Sessions are completed during POST in the current client flow.
// Add a PATCH handler back when a "finish later" workflow exists.
