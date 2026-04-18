// app/api/workouts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { updateStreak } from '@/lib/streak'

// GET — fetch recent workout sessions
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const rawLimit = parseInt(searchParams.get('limit') || '10')
  const limit = Math.min(Math.max(rawLimit, 1), 50) // clamp 1-50

  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    include: {
      exercises: {
        include: { sets: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ sessions })
}

// POST — create a new workout session (AI-generated or manual)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const body = await req.json()
  const { title, sessionType, durationMins, estimatedCalories, exercises, aiGenerated } = body

  // ── Input validation ────────────────────────────────────────────────────
  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return NextResponse.json({ error: 'exercises must be a non-empty array' }, { status: 400 })
  }

  const workoutSession = await prisma.workoutSession.create({
    data: {
      userId,
      title: title.trim().slice(0, 200),
      sessionType: sessionType || 'full_body',
      durationMins: Number(durationMins) || null,
      caloriesBurned: Number(estimatedCalories) || null,
      aiGenerated: aiGenerated ?? true,
      exercises: {
        create: exercises.map((ex: { name?: string; sets?: number; tip?: string; reps?: number; weightKg?: number; durationSec?: number }, idx: number) => ({
          name: String(ex.name || '').slice(0, 200),
          orderIndex: idx,
          notes: ex.tip ? String(ex.tip).slice(0, 500) : null,
          sets: {
            create: Array.from({ length: Math.max(1, Number(ex.sets) || 1) }, (_, i) => ({
              setNumber: i + 1,
              reps: ex.reps ? Number(ex.reps) : null,
              weightKg: ex.weightKg ? Number(ex.weightKg) : null,
              durationSec: ex.durationSec ? Number(ex.durationSec) : null,
              completed: false,
            })),
          },
        })),
      },
    },
    include: {
      exercises: { include: { sets: true }, orderBy: { orderIndex: 'asc' } },
    },
  })

  return NextResponse.json({ session: workoutSession }, { status: 201 })
}

// PATCH — mark workout as complete
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const body = await req.json()
  const { sessionId, actualDuration, notes } = body

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  // ── Ownership check — prevent users from mutating other users' sessions ──
  const updated = await prisma.workoutSession.updateMany({
    where: { id: sessionId, userId },
    data: {
      completedAt: new Date(),
      durationMins: actualDuration ? Number(actualDuration) : undefined,
      notes: notes ? String(notes).slice(0, 1000) : undefined,
    },
  })

  if (updated.count === 0) {
    return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 })
  }

  // Update streak after completing a workout
  await updateStreak(userId).catch(() => {})

  return NextResponse.json({ success: true })
}
