// app/api/mood/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { updateStreak } from '@/lib/streak'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const logs = await prisma.moodLog.findMany({
    where: { userId },
    orderBy: { loggedAt: 'desc' },
    take: 14,
  })

  return NextResponse.json({ logs, latest: logs[0] ?? null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const body = await req.json()
  const { mood, energy, stress, focus, notes, triggers } = body

  // ── Input validation ────────────────────────────────────────────────────
  const parsedMood = parseInt(mood)
  if (isNaN(parsedMood) || parsedMood < 1 || parsedMood > 10) {
    return NextResponse.json({ error: 'mood must be an integer 1-10' }, { status: 400 })
  }

  // Clamp all scores to 1-10, defaulting to mood value if not provided
  const clamp = (val: unknown, fallback: number) => {
    const n = parseInt(String(val))
    return isNaN(n) ? fallback : Math.min(10, Math.max(1, n))
  }

  const log = await prisma.moodLog.create({
    data: {
      userId,
      mood: parsedMood,
      energy: clamp(energy, parsedMood),
      stress: clamp(stress, 5),
      focus: clamp(focus, parsedMood),
      notes: notes ? String(notes).slice(0, 1000) : null,
      triggers: Array.isArray(triggers) ? triggers.slice(0, 10) : [],
    },
  })

  // ── Update streak (centralized) ─────────────────────────────────────────
  const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC'
  await updateStreak(userId, tz).catch(() => {})

  return NextResponse.json({ log }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const result = await prisma.moodLog.deleteMany({
    where: { id, userId },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: 'Mood log not found or access denied' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
