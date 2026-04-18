// app/api/badges/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// GET — fetch all badges earned by the current user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const badges = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: 'asc' },
  })

  return NextResponse.json({ badges })
}

// POST — award a badge (idempotent via upsert)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const { badgeId } = await req.json()

  if (!badgeId || typeof badgeId !== 'string') {
    return NextResponse.json({ error: 'badgeId is required' }, { status: 400 })
  }

  const badge = await prisma.userBadge.upsert({
    where: { userId_badgeId: { userId, badgeId } },
    create: { userId, badgeId },
    update: {}, // no-op if already exists (idempotent)
  })

  return NextResponse.json({ badge }, { status: 201 })
}
