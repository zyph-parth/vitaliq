// app/api/sleep/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { updateStreak } from '@/lib/streak'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const logs = await prisma.sleepLog.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 30,
  })

  // Compute 7-day averages
  const last7 = logs.slice(0, 7)
  const avgHours = last7.length
    ? last7.reduce((s, l) => s + l.totalHours, 0) / last7.length
    : null
  const hrvLogs = last7.filter(l => l.hrv !== null)
  const avgHrv = hrvLogs.length
    ? hrvLogs.reduce((s, l) => s + (l.hrv ?? 0), 0) / hrvLogs.length
    : null

  return NextResponse.json({ logs, avgHours, avgHrv, latest: logs[0] ?? null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const body = await req.json()
  const {
    date, bedtimeAt, wakeAt, totalHours,
    deepHours, remHours, lightHours,
    hrv, restingHR, quality, source, notes,
  } = body

  // ── Input validation ────────────────────────────────────────────────────
  if (!bedtimeAt || !wakeAt) {
    return NextResponse.json({ error: 'bedtimeAt and wakeAt are required' }, { status: 400 })
  }

  const bedtimeDate = new Date(bedtimeAt)
  const wakeDate = new Date(wakeAt)
  if (Number.isNaN(bedtimeDate.getTime()) || Number.isNaN(wakeDate.getTime())) {
    return NextResponse.json({ error: 'bedtimeAt and wakeAt must be valid dates' }, { status: 400 })
  }

  const derivedHours = (wakeDate.getTime() - bedtimeDate.getTime()) / 3_600_000
  if (derivedHours <= 0 || derivedHours > 24) {
    return NextResponse.json({ error: 'wakeAt must be after bedtimeAt and within 24 hours' }, { status: 400 })
  }

  const parsedTotalHours = parseFloat(totalHours)
  if (isNaN(parsedTotalHours) || parsedTotalHours <= 0 || parsedTotalHours > 24) {
    return NextResponse.json({ error: 'totalHours must be a number between 0 and 24' }, { status: 400 })
  }
  if (Math.abs(parsedTotalHours - derivedHours) > 1) {
    return NextResponse.json(
      { error: 'totalHours must closely match the bedtimeAt/wakeAt duration' },
      { status: 400 }
    )
  }
  const parsedQuality = parseInt(quality)
  if (isNaN(parsedQuality) || parsedQuality < 1 || parsedQuality > 10) {
    return NextResponse.json({ error: 'quality must be an integer 1-10' }, { status: 400 })
  }

  const log = await prisma.sleepLog.create({
    data: {
      userId,
      date: date ? new Date(date) : new Date(),
      bedtimeAt: bedtimeDate,
      wakeAt: wakeDate,
      totalHours: Number(derivedHours.toFixed(2)),
      deepHours: deepHours != null ? parseFloat(deepHours) : null,
      remHours: remHours != null ? parseFloat(remHours) : null,
      lightHours: lightHours != null ? parseFloat(lightHours) : null,
      hrv: hrv != null ? parseFloat(hrv) : null,
      restingHR: restingHR != null ? parseInt(restingHR) : null,
      quality: parsedQuality,
      source: source || 'manual',
      notes: notes ? String(notes).slice(0, 1000) : null,
    },
  })

  // Update streak after successful sleep log
  const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC'
  await updateStreak(userId, tz).catch(() => {})

  return NextResponse.json({ log }, { status: 201 })
}

// DELETE — remove a sleep log entry (ownership enforced)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const result = await prisma.sleepLog.deleteMany({
    where: { id, userId },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: 'Sleep log not found or access denied' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
