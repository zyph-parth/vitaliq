import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSafeTimeZone } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { updateStreak } from '@/lib/streak'

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_GLASSES = 20

function getLocalDate(req: NextRequest, bodyDate?: unknown): string {
  const candidate =
    typeof bodyDate === 'string'
      ? bodyDate
      : req.nextUrl.searchParams.get('localDate') ?? ''

  if (LOCAL_DATE_RE.test(candidate)) return candidate

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getSafeTimeZone(req.nextUrl.searchParams.get('tz') ?? 'UTC'),
  }).format(new Date())
}

function parseGlasses(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(MAX_GLASSES, Math.max(0, Math.round(parsed)))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const localDate = getLocalDate(req)
  const log = await prisma.hydrationLog.findUnique({
    where: {
      userId_localDate: {
        userId: session.user.id,
        localDate,
      },
    },
  })

  return NextResponse.json({
    localDate,
    glasses: log?.glasses ?? 0,
    log,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const glasses = parseGlasses((body as { glasses?: unknown }).glasses)
  if (glasses === null) {
    return NextResponse.json({ error: 'glasses must be a number' }, { status: 400 })
  }

  const tz = getSafeTimeZone(req.nextUrl.searchParams.get('tz') ?? 'UTC')
  const localDate = getLocalDate(req, (body as { localDate?: unknown }).localDate)

  const log = await prisma.hydrationLog.upsert({
    where: {
      userId_localDate: {
        userId: session.user.id,
        localDate,
      },
    },
    create: {
      userId: session.user.id,
      localDate,
      timeZone: tz,
      glasses,
    },
    update: {
      timeZone: tz,
      glasses,
    },
  })

  if (glasses > 0) {
    await updateStreak(session.user.id, tz).catch(() => {})
  }

  return NextResponse.json({ log, glasses })
}
