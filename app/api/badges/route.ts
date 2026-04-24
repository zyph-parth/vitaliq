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

// Badge writes must stay server-derived so users cannot self-award milestones.
export async function POST() {
  return NextResponse.json(
    { error: 'Badges are awarded automatically from verified activity.' },
    { status: 405, headers: { Allow: 'GET' } }
  )
}
