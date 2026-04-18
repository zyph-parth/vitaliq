// app/api/workouts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { updateStreak } from '@/lib/streak'

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

function parsePositiveInt(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function parsePositiveFloat(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseDateValue(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

type ParsedRepsOrDuration = {
  reps: number | null
  durationSec: number | null
  isAmrap: boolean
}

function parseRepsOrDuration(value: unknown) {
  if (typeof value !== 'string') {
    return { reps: null, durationSec: null, isAmrap: false } satisfies ParsedRepsOrDuration
  }

  const text = value.trim().toLowerCase()

  const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes)\b/)
  if (minuteMatch) {
    return { reps: null, durationSec: Math.round(Number(minuteMatch[1]) * 60), isAmrap: false }
  }

  const secondMatch = text.match(/(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|s)\b/)
  if (secondMatch) {
    return { reps: null, durationSec: Math.round(Number(secondMatch[1])), isAmrap: false }
  }

  const setMatch = text.match(/(\d+)\s*[x×]\s*\d+/)
  if (setMatch) {
    return { reps: parseInt(setMatch[1], 10), durationSec: null, isAmrap: false }
  }

  const repMatch = text.match(/(\d+(?:\.\d+)?)\s*reps?\b/)
  if (repMatch) {
    return { reps: Math.round(Number(repMatch[1])), durationSec: null, isAmrap: false }
  }

  const eachMatch = text.match(/(\d+(?:\.\d+)?)\s*each\b/)
  if (eachMatch) {
    return { reps: Math.round(Number(eachMatch[1])), durationSec: null, isAmrap: false }
  }

  if (text.includes('amrap')) {
    return { reps: null, durationSec: null, isAmrap: true }
  }

  console.warn('Unrecognized repsOrDuration format:', value)
  return { reps: null, durationSec: null, isAmrap: false }
}

function parseWeightKg(value: unknown) {
  if (typeof value === 'number') {
    return parsePositiveFloat(value)
  }

  if (typeof value !== 'string') return null

  const text = value.trim().toLowerCase()
  if (!text || text === 'bodyweight' || text === 'light') return null

  const numberMatch = text.match(/-?\d+(?:\.\d+)?/)
  return numberMatch ? parsePositiveFloat(numberMatch[0]) : null
}

function buildSetStatuses(rawStatuses: unknown, setCount: number) {
  if (!Array.isArray(rawStatuses)) {
    return Array.from({ length: setCount }, () => false)
  }

  return Array.from({ length: setCount }, (_, index) => Boolean(rawStatuses[index]))
}

function buildExerciseNotes(exercise: WorkoutExerciseInput, parsed: ParsedRepsOrDuration) {
  const restSeconds = parsePositiveInt(exercise.restSec)
  const parts = [
    parsed.isAmrap
      ? 'AMRAP'
      : typeof exercise.repsOrDuration === 'string'
        ? exercise.repsOrDuration.trim()
        : null,
    typeof exercise.weight === 'string' && exercise.weight.trim() && exercise.weight.trim().toLowerCase() !== 'bodyweight'
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
  const rawLimit = parseInt(searchParams.get('limit') || '10')
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

// POST - create a new workout session
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const body = await req.json()
  const {
    title,
    sessionType,
    durationMins,
    estimatedCalories,
    exercises,
    aiGenerated,
    notes,
    startedAt,
    completedAt,
  } = body

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (!Array.isArray(exercises) || exercises.length === 0) {
    return NextResponse.json({ error: 'exercises must be a non-empty array' }, { status: 400 })
  }

  const startedAtDate = parseDateValue(startedAt)
  const completedAtDate = parseDateValue(completedAt)

  const workoutSession = await prisma.workoutSession.create({
    data: {
      userId,
      title: title.trim().slice(0, 200),
      sessionType: typeof sessionType === 'string' && sessionType.trim() ? sessionType : 'full_body',
      durationMins: parsePositiveInt(durationMins),
      caloriesBurned: parsePositiveInt(estimatedCalories),
      aiGenerated: aiGenerated ?? true,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 1000) : null,
      startedAt: startedAtDate ?? undefined,
      completedAt: completedAtDate ?? undefined,
      exercises: {
        create: exercises.map((rawExercise: WorkoutExerciseInput, index: number) => {
          const setCount = Math.max(1, parsePositiveInt(rawExercise.sets) ?? 1)
          const parsedFromText = parseRepsOrDuration(rawExercise.repsOrDuration)
          const reps = parsePositiveInt(rawExercise.reps) ?? parsedFromText.reps
          const durationSec = parsePositiveInt(rawExercise.durationSec) ?? parsedFromText.durationSec
          const weightKg = parsePositiveFloat(rawExercise.weightKg) ?? parseWeightKg(rawExercise.weight)
          const completedSets = buildSetStatuses(rawExercise.completedSets, setCount)

          return {
            name: String(rawExercise.name || `Exercise ${index + 1}`).trim().slice(0, 200),
            orderIndex: index,
            notes: buildExerciseNotes(rawExercise, parsedFromText),
            sets: {
              create: Array.from({ length: setCount }, (_, setIndex) => ({
                setNumber: setIndex + 1,
                reps,
                weightKg,
                durationSec,
                completed: completedSets[setIndex],
              })),
            },
          }
        }),
      },
    },
    include: {
      exercises: {
        include: { sets: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  if (completedAtDate) {
    const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC'
    await updateStreak(userId, tz).catch(() => {})
  }

  return NextResponse.json({ session: workoutSession }, { status: 201 })
}

// Sessions are completed during POST in the current client flow.
// Add a PATCH handler back when a "finish later" workflow exists.
