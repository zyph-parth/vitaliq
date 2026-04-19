import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { toZonedTime } from 'date-fns-tz'
import { prisma } from '@/lib/prisma'
import { computeReadinessScore, getStreakMessage, computeMacroTargets } from '@/lib/calculations'
import { authOptions } from '@/lib/auth'
import { getDayBounds, getSafeTimeZone } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const SESSION_INTENSITY: Record<string, number> = {
  hiit: 9,
  cardio: 7,
  push: 7,
  pull: 7,
  legs: 8,
  full_body: 7,
  yoga: 3,
  rest: 1,
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const tz = getSafeTimeZone(req.nextUrl.searchParams.get('tz') ?? 'UTC')
    const { today, tomorrow } = getDayBounds(tz)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [todayMeals, lastSleep, lastMood, recentWorkouts, weeklyMeals, recentWeights] = await Promise.all([
      prisma.mealLog.findMany({
        where: { userId: user.id, loggedAt: { gte: today, lt: tomorrow } },
      }),
      prisma.sleepLog.findFirst({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
      }),
      prisma.moodLog.findFirst({
        where: { userId: user.id },
        orderBy: { loggedAt: 'desc' },
      }),
      prisma.workoutSession.findMany({
        where: { userId: user.id, completedAt: { gte: sevenDaysAgo, lt: tomorrow } },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.mealLog.findMany({
        where: { userId: user.id, loggedAt: { gte: sevenDaysAgo, lt: tomorrow } },
      }),
      prisma.weightLog.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ])

    const nutritionToday = todayMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.proteinG,
        carbs: acc.carbs + meal.carbsG,
        fat: acc.fat + meal.fatG,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    const lastWorkout = recentWorkouts[0]
    const daysSinceWorkout = lastWorkout
      ? Math.max(
          0,
          Math.floor(
            (today.getTime() - new Date(lastWorkout.completedAt ?? lastWorkout.startedAt).setHours(0, 0, 0, 0)) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 3

    const lastWorkoutIntensity = lastWorkout ? (SESSION_INTENSITY[lastWorkout.sessionType] ?? 6) : 3

    const readiness = computeReadinessScore({
      sleepHours: lastSleep?.totalHours,
      sleepQuality: lastSleep?.quality,
      hrv: lastSleep?.hrv ?? undefined,
      restingHR: lastSleep?.restingHR ?? undefined,
      moodScore: lastMood?.mood,
      lastWorkoutIntensity,
      daysSinceLastWorkout: daysSinceWorkout,
    })

    const weeklyCalData = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today)
      day.setDate(day.getDate() - (6 - index))

      const dayMeals = weeklyMeals.filter((meal) => {
        const mealDate = new Date(meal.loggedAt)
        const zonedMealDate = toZonedTime(mealDate, tz)
        const zonedDayDate = toZonedTime(day, tz)

        return (
          zonedMealDate.getFullYear() === zonedDayDate.getFullYear() &&
          zonedMealDate.getMonth() === zonedDayDate.getMonth() &&
          zonedMealDate.getDate() === zonedDayDate.getDate()
        )
      })

      return {
        day: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(day),
        calories: dayMeals.reduce((sum, meal) => sum + meal.calories, 0),
        date: day.toISOString(),
      }
    })

    const insights: Array<{ text: string; pillarsUsed: string[] }> = []

    if (lastSleep && lastSleep.totalHours < 6 && nutritionToday.calories > user.tdee * 0.9) {
      insights.push({
        text: 'Poor sleep often drives overeating. Consider adding protein to your next meal to improve satiety.',
        pillarsUsed: ['sleep', 'nutrition'],
      })
    }

    const macroTargets = computeMacroTargets(user)
    if (nutritionToday.protein > 0 && nutritionToday.protein < macroTargets.protein * 0.7) {
      insights.push({
        text: `You're tracking ${Math.round(nutritionToday.protein)}g protein vs your ${macroTargets.protein}g target. Add a protein source to your next meal.`,
        pillarsUsed: ['nutrition'],
      })
    }

    const consecutiveLowDays = weeklyCalData
      .slice(-3)
      .filter((day) => day.calories > 0 && day.calories < user.tdee * 0.7).length

    if (consecutiveLowDays >= 2) {
      insights.push({
        text: `You've been significantly under your calorie target for ${consecutiveLowDays} days. This can slow recovery and metabolism.`,
        pillarsUsed: ['nutrition'],
      })
    }

    try {
      const existingCount = await prisma.insight.count({
        where: { userId: user.id, generatedAt: { gte: today, lt: tomorrow } },
      })

      if (existingCount === 0 && insights.length > 0) {
        await prisma.insight.createMany({
          data: insights.slice(0, 2).map(({ text, pillarsUsed }) => ({
            userId: user.id,
            type: 'cross_pillar',
            readinessScore: readiness.score,
            headline: text.slice(0, 100),
            body: text,
            actionable: null,
            pillarsUsed,
            dismissed: false,
          })),
        })
      }
    } catch (error) {
      console.error('[VitalIQ] Dashboard insight persistence failed:', error)
    }

    const streakData = {
      current: user.streak?.currentDays || 0,
      best: user.streak?.bestDays || 0,
      message: getStreakMessage(user.streak?.currentDays || 0),
    }

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
        sleep: lastSleep
          ? {
              hours: lastSleep.totalHours,
              quality: lastSleep.quality,
              hrv: lastSleep.hrv,
              deepHours: lastSleep.deepHours,
              remHours: lastSleep.remHours,
            }
          : null,
        training: {
          sessionsThisWeek: recentWorkouts.length,
          lastSession: lastWorkout
            ? {
                title: lastWorkout.title,
                type: lastWorkout.sessionType,
                daysAgo: daysSinceWorkout,
              }
            : null,
        },
        mental: lastMood
          ? {
              mood: lastMood.mood,
              energy: lastMood.energy,
              stress: lastMood.stress,
            }
          : null,
      },
      weeklyCalChart: weeklyCalData,
      weightTrend: recentWeights.slice(0, 10).reverse().map((weight) => ({
        date: weight.date,
        weight: weight.weightKg,
      })),
      insights: insights.slice(0, 2).map(({ text }) => text),
      streak: streakData,
    })
  } catch (error) {
    console.error('[VitalIQ] Dashboard route failed:', error)
    return NextResponse.json(
      { error: 'Could not load your dashboard right now.' },
      { status: 500 }
    )
  }
}
