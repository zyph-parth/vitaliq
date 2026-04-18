// app/api/meals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { updateStreak } from '@/lib/streak'
import { computeMacroTargets } from '@/lib/calculations'
import { getDayBounds } from '@/lib/dates'

// GET — fetch today's meals
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC'
  const { today, tomorrow } = getDayBounds(tz)

  const meals = await prisma.mealLog.findMany({
    where: {
      userId,
      loggedAt: { gte: today, lt: tomorrow },
    },
    orderBy: { loggedAt: 'asc' },
  })

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + m.calories,
    protein: acc.protein + m.proteinG,
    carbs: acc.carbs + m.carbsG,
    fat: acc.fat + m.fatG,
    fibre: acc.fibre + m.fibreG,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 })

  // LBM-based macro targets — shared with dashboard route
  const { protein: proteinTarget, fat: fatTarget, carbs: carbTarget, fibre: fibreTarget } = computeMacroTargets(user)

  return NextResponse.json({
    meals,
    totals,
    target: user.tdee,
    remaining: Math.max(0, user.tdee - totals.calories),
    macroTargets: { protein: proteinTarget, carbs: carbTarget, fat: fatTarget, fibre: fibreTarget },
  })
}

// POST — log a new meal (AI-parsed data comes from client after /api/gemini call)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  // Only need user profile for TDEE/protein targets — fetch by id
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { description, calories, proteinG, carbsG, fatG, fibreG, mealType, aiInsight, ingredients } = body

  // ── Input validation ────────────────────────────────────────────────────
  if (!description || typeof description !== 'string') {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }
  const parsedCalories = Math.round(Number(calories) || 0)
  const parsedProtein = parseFloat((Number(proteinG) || 0).toFixed(1))
  const parsedCarbs = parseFloat((Number(carbsG) || 0).toFixed(1))
  const parsedFat = parseFloat((Number(fatG) || 0).toFixed(1))
  const parsedFibre = parseFloat((Number(fibreG) || 0).toFixed(1))

  if (parsedCalories < 0 || parsedProtein < 0 || parsedCarbs < 0 || parsedFat < 0) {
    return NextResponse.json({ error: 'Macro values cannot be negative' }, { status: 400 })
  }

  const meal = await prisma.mealLog.create({
    data: {
      userId,
      description: description.trim().slice(0, 500),
      calories: parsedCalories,
      proteinG: parsedProtein,
      carbsG: parsedCarbs,
      fatG: parsedFat,
      fibreG: parsedFibre,
      mealType: mealType || 'snack',
      aiInsight: aiInsight ? String(aiInsight).slice(0, 500) : null,
      ingredients: Array.isArray(ingredients) ? ingredients : [],
    },
  })

  // Update streak after successful meal log
  const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC'
  await updateStreak(userId, tz).catch(() => {}) // non-blocking

  return NextResponse.json({ meal }, { status: 201 })
}

// DELETE — remove a meal log entry (ownership enforced)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const mealId = req.nextUrl.searchParams.get('id')

  if (!mealId) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // deleteMany with userId in where clause acts as ownership check
  const result = await prisma.mealLog.deleteMany({
    where: { id: mealId, userId },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: 'Meal not found or access denied' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
