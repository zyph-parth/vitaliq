// app/api/weight/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { calculateBMI, computeAllMetrics } from '@/lib/calculations'
import { authOptions } from '@/lib/auth'
import { updateStreak } from '@/lib/streak'
import type { ActivityLevel, Goal, Sex } from '@/lib/calculations'
import { hasCompleteHealthProfile, profileIncompleteResponseBody } from '@/lib/user-profile'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasCompleteHealthProfile(user)) {
    return NextResponse.json(profileIncompleteResponseBody(), { status: 428 })
  }

  const { searchParams } = new URL(req.url)
  const rawLimit = parseInt(searchParams.get('limit') || '30')
  const limit = Math.min(Math.max(rawLimit, 1), 90) // clamp 1-90

  const logs = await prisma.weightLog.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
  })

  const latest = logs[0] ?? null
  const oldest = logs[logs.length - 1] ?? null
  const change = latest && oldest && latest.id !== oldest.id
    ? parseFloat((latest.weightKg - oldest.weightKg).toFixed(1))
    : null

  return NextResponse.json({
    logs: [...logs].reverse(), // chronological order for charts
    latest,
    change,
    currentBMI: latest ? calculateBMI(latest.weightKg, user.heightCm) : user.bmi,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasCompleteHealthProfile(user)) {
    return NextResponse.json(profileIncompleteResponseBody(), { status: 428 })
  }

  const body = await req.json()
  const { weightKg, bodyFatPct, notes } = body

  // ── Input validation ────────────────────────────────────────────────────
  const parsedWeight = parseFloat(weightKg)
  if (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500) {
    return NextResponse.json({ error: 'weightKg must be a positive number (max 500)' }, { status: 400 })
  }
  const parsedBodyFat = bodyFatPct != null ? parseFloat(bodyFatPct) : null
  if (parsedBodyFat !== null && (parsedBodyFat < 0 || parsedBodyFat > 70)) {
    return NextResponse.json({ error: 'bodyFatPct must be between 0 and 70' }, { status: 400 })
  }

  const log = await prisma.weightLog.create({
    data: {
      userId,
      weightKg: parsedWeight,
      bodyFatPct: parsedBodyFat,
      notes: notes ? String(notes).slice(0, 500) : null,
    },
  })

  const metrics = computeAllMetrics(
    parsedWeight,
    user.heightCm,
    user.age,
    user.sex as Sex,
    user.activityLevel as ActivityLevel,
    user.goal as Goal
  )

  // Update user's current weight and recompute dependent body metrics
  await prisma.user.update({
    where: { id: userId },
    data: {
      weightKg: parsedWeight,
      bmi: metrics.bmi,
      bmr: metrics.bmr,
      tdee: metrics.tdee,
      bodyFatPct: metrics.estimatedBodyFat,
    },
  })

  // Update streak after successful weight log
  const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC'
  await updateStreak(userId, tz).catch(() => {})

  return NextResponse.json({ log }, { status: 201 })
}

// DELETE — remove a weight log entry (ownership enforced)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const result = await prisma.weightLog.deleteMany({
    where: { id, userId },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: 'Weight log not found or access denied' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
