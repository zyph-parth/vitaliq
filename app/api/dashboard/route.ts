// app/api/dashboard/route.ts
// The core intelligence endpoint — aggregates all pillars and computes readiness

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { computeReadinessScore, getStreakMessage, computeMacroTargets } from '@/lib/calculations'
import { authOptions } from '@/lib/auth'
import { getDayBounds } from '@/lib/dates'

// MEDIUM 1 — Realistic intensity map per session type
const SESSION_INTENSITY: Record<string, number> = {
  hiit: 9, cardio: 7, push: 7, pull: 7, legs: 8,
  full_body: 7, yoga: 3, rest: 1,
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUserId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    include: { streak: true },
  })

  if (!user) {
    return NextResponse.json(
      {
        error: 'Your session is out of date. Please sign in again.',
        code: 'ACCOUNT_MISSING',
      },
      { status: 401 }
    )
  }

  const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC'
  const { today, tomorrow } = getDayBounds(tz)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // ── FETCH ALL PILLAR DATA IN PARALLEL ──────────────────────────────────
  const [
    todayMeals,
    lastSleep,
    lastMood,
    recentWorkouts,
    weeklyMeals,
    recentWeights,
  ] = await Promise.all([
    // Today's nutrition
    prisma.mealLog.findMany({
      where: { userId: user.id, loggedAt: { gte: today, lt: tomorrow } },
    }),

    // Most recent sleep
    prisma.sleepLog.findFirst({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
    }),

    // Most recent mood check-in
    prisma.moodLog.findFirst({
      where: { userId: user.id },
      orderBy: { loggedAt: 'desc' },
    }),

    // Last 7 days completed workouts
    prisma.workoutSession.findMany({
      where: { userId: user.id, completedAt: { gte: sevenDaysAgo, lt: tomorrow } },
      orderBy: { completedAt: 'desc' },
    }),

    // 7-day meal history for chart
    prisma.mealLog.findMany({
      where: { userId: user.id, loggedAt: { gte: sevenDaysAgo, lt: tomorrow } },
    }),

    // Recent weights for trend
    prisma.weightLog.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 30,
    }),
  ])

  // ── NUTRITION TOTALS ────────────────────────────────────────────────────
  const nutritionToday = todayMeals.reduce((acc, m) => ({
    calories: acc.calories + m.calories,
    protein: acc.protein + m.proteinG,
    carbs: acc.carbs + m.carbsG,
    fat: acc.fat + m.fatG,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  // ── COMPUTE READINESS SCORE ────────────────────────────────────────────
  const lastWorkout = recentWorkouts[0]

  const daysSinceWorkout = lastWorkout
    ? Math.max(0, Math.floor(
        (today.getTime() - new Date(lastWorkout.completedAt ?? lastWorkout.startedAt).setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24)
      ))
    : 3

  // MEDIUM 1: use session-type based intensity instead of hardcoded 6
  const lastWorkoutIntensity = lastWorkout
    ? (SESSION_INTENSITY[lastWorkout.sessionType] ?? 6)
    : 3

  const readiness = computeReadinessScore({
    sleepHours: lastSleep?.totalHours,
    sleepQuality: lastSleep?.quality,
    hrv: lastSleep?.hrv ?? undefined,
    restingHR: lastSleep?.restingHR ?? undefined,
    moodScore: lastMood?.mood,
    lastWorkoutIntensity,
    daysSinceLastWorkout: daysSinceWorkout,
  })

  // ── WEEKLY CHART DATA ───────────────────────────────────────────────────
  const weeklyCalData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    const dayMeals = weeklyMeals.filter(m => {
      const mDate = new Date(m.loggedAt)
      return mDate.toDateString() === d.toDateString()
    })
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      calories: dayMeals.reduce((s, m) => s + m.calories, 0),
      date: d.toISOString(),
    }
  })

  // ── CROSS-PILLAR INSIGHTS ───────────────────────────────────────────────
  const insights: string[] = []

  // Sleep x Nutrition pattern
  if (lastSleep && lastSleep.totalHours < 6 && nutritionToday.calories > user.tdee * 0.9) {
    insights.push('Poor sleep often drives overeating. Consider adding protein to your next meal to improve satiety.')
  }

  // Protein tracking — use lean body mass estimate for target
  const macroTargets = computeMacroTargets(user)
  if (nutritionToday.protein > 0 && nutritionToday.protein < macroTargets.protein * 0.7) {
    insights.push(`You're tracking ${Math.round(nutritionToday.protein)}g protein vs your ${macroTargets.protein}g target. Add a protein source to your next meal.`)
  }

  // Calorie deficit warning
  const consecutiveLowDays = weeklyCalData.slice(-3).filter(d => d.calories > 0 && d.calories < user.tdee * 0.7).length
  if (consecutiveLowDays >= 2) {
    insights.push(`You've been significantly under your calorie target for ${consecutiveLowDays} days. This can slow recovery and metabolism.`)
  }

  // ── PERSIST INSIGHTS TO DB ──────────────────────────────────────────────
  // Only write once per day — skip if insights already exist for today
  const existingCount = await prisma.insight.count({
    where: { userId: user.id, generatedAt: { gte: today, lt: tomorrow } },
  })

  if (existingCount === 0 && insights.length > 0) {
    await prisma.insight.createMany({
      data: insights.slice(0, 2).map(text => ({
        userId: user.id,
        type: 'cross_pillar',
        readinessScore: readiness.score,
        headline: text.slice(0, 100),
        body: text,
        actionable: null,
        pillarsUsed: ['nutrition', 'sleep'],
        dismissed: false,
      })),
    }).catch(() => {}) // non-critical
  }

  // ── STREAK DATA ─────────────────────────────────────────────────────────
  const streakData = {
    current: user.streak?.currentDays || 0,
    best: user.streak?.bestDays || 0,
    message: getStreakMessage(user.streak?.currentDays || 0),
  }

  // ── MACRO TARGETS ───────────────────────────────────────────────────────
  const { protein: proteinTargetG, fat: fatTargetG, carbs: carbTargetG, fibre: fibreTargetG } = macroTargets

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      goal: user.goal,
      sex: user.sex,
      weightKg: user.weightKg,
      heightCm: user.heightCm,
      age: user.age,
      activityLevel: user.activityLevel,
      tdee: user.tdee,
      bmi: user.bmi,
      bmr: user.bmr ?? null,
      bodyFatPct: user.bodyFatPct ?? null,
      targets: {
        calories: user.tdee,
        protein: proteinTargetG,
        carbs: carbTargetG,
        fat: fatTargetG,
        fibre: fibreTargetG,
      },
    },
    readiness,
    pillars: {
      nutrition: {
        today: nutritionToday,
        target: user.tdee,
        remaining: Math.max(0, user.tdee - nutritionToday.calories),
        mealCount: todayMeals.length,
      },
      sleep: lastSleep ? {
        hours: lastSleep.totalHours,
        quality: lastSleep.quality,
        hrv: lastSleep.hrv,
        deepHours: lastSleep.deepHours,
        remHours: lastSleep.remHours,
      } : null,
      training: {
        sessionsThisWeek: recentWorkouts.length,
        lastSession: lastWorkout ? {
          title: lastWorkout.title,
          type: lastWorkout.sessionType,
          daysAgo: daysSinceWorkout,
        } : null,
      },
      mental: lastMood ? {
        mood: lastMood.mood,
        energy: lastMood.energy,
        stress: lastMood.stress,
      } : null,
    },
    weeklyCalChart: weeklyCalData,
    weightTrend: recentWeights.slice(0, 10).reverse().map(w => ({
      date: w.date,
      weight: w.weightKg,
    })),
    insights: insights.slice(0, 2),
    streak: streakData,
  })
}
