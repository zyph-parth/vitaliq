import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      profileComplete: true,
      createdAt: true,
      updatedAt: true,
      age: true,
      sex: true,
      heightCm: true,
      weightKg: true,
      activityLevel: true,
      goal: true,
      bmi: true,
      bmr: true,
      tdee: true,
      bodyFatPct: true,
      weightLogs: { orderBy: { date: 'asc' } },
      mealLogs: { orderBy: { loggedAt: 'asc' } },
      workoutSessions: {
        orderBy: { startedAt: 'asc' },
        include: {
          exercises: {
            orderBy: { orderIndex: 'asc' },
            include: {
              sets: { orderBy: { setNumber: 'asc' } },
            },
          },
        },
      },
      sleepLogs: { orderBy: { date: 'asc' } },
      moodLogs: { orderBy: { loggedAt: 'asc' } },
      hydrationLogs: { orderBy: { localDate: 'asc' } },
      biomarkers: { orderBy: { recordedAt: 'asc' } },
      insights: { orderBy: { generatedAt: 'asc' } },
      badges: { orderBy: { earnedAt: 'asc' } },
      streak: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    product: 'VitalIQ',
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      profileComplete: user.profileComplete,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: {
        age: user.age,
        sex: user.sex,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        activityLevel: user.activityLevel,
        goal: user.goal,
        bmi: user.bmi,
        bmr: user.bmr,
        tdee: user.tdee,
        bodyFatPct: user.bodyFatPct,
      },
    },
    data: {
      weightLogs: user.weightLogs,
      mealLogs: user.mealLogs,
      workoutSessions: user.workoutSessions,
      sleepLogs: user.sleepLogs,
      moodLogs: user.moodLogs,
      hydrationLogs: user.hydrationLogs,
      biomarkers: user.biomarkers,
      insights: user.insights,
      badges: user.badges,
      streak: user.streak,
    },
  })
}
