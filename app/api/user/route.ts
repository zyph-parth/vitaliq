// app/api/user/route.ts — PATCH user profile stats
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { computeAllMetrics } from '@/lib/calculations'
import type { ActivityLevel, Goal, Sex } from '@/lib/calculations'

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { name, age, sex, heightCm, weightKg, activityLevel, goal } = body

  // Build update data — only fields that are provided
  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = String(name).trim().slice(0, 100)
  if (age !== undefined) updateData.age = parseInt(age)
  if (sex !== undefined) updateData.sex = sex
  if (heightCm !== undefined) updateData.heightCm = parseFloat(heightCm)
  if (weightKg !== undefined) updateData.weightKg = parseFloat(weightKg)
  if (activityLevel !== undefined) updateData.activityLevel = activityLevel
  if (goal !== undefined) updateData.goal = goal

  // Validate enum fields
  const VALID_SEX = new Set(['male', 'female'])
  const VALID_ACTIVITY = new Set(['sedentary', 'light', 'moderate', 'active', 'athlete'])
  const VALID_GOAL = new Set(['lose', 'muscle', 'maintain', 'longevity'])

  if (updateData.sex && !VALID_SEX.has(updateData.sex as string))
    return NextResponse.json({ error: 'Invalid sex value' }, { status: 400 })
  if (updateData.activityLevel && !VALID_ACTIVITY.has(updateData.activityLevel as string))
    return NextResponse.json({ error: 'Invalid activity level' }, { status: 400 })
  if (updateData.goal && !VALID_GOAL.has(updateData.goal as string))
    return NextResponse.json({ error: 'Invalid goal value' }, { status: 400 })

  // Validate numeric fields
  if (updateData.age !== undefined && (isNaN(updateData.age as number) || (updateData.age as number) < 10 || (updateData.age as number) > 120)) {
    return NextResponse.json({ error: 'age must be between 10 and 120' }, { status: 400 })
  }
  if (updateData.weightKg !== undefined && (isNaN(updateData.weightKg as number) || (updateData.weightKg as number) <= 0 || (updateData.weightKg as number) > 500)) {
    return NextResponse.json({ error: 'weightKg must be a positive number' }, { status: 400 })
  }
  if (updateData.heightCm !== undefined && (isNaN(updateData.heightCm as number) || (updateData.heightCm as number) < 100 || (updateData.heightCm as number) > 250)) {
    return NextResponse.json({ error: 'heightCm must be between 100 and 250' }, { status: 400 })
  }

  // Recompute body metrics if any relevant field changed
  const bodyFieldsChanged = ['weightKg', 'heightCm', 'age', 'sex', 'activityLevel', 'goal'].some(k => updateData[k] !== undefined)
  if (bodyFieldsChanged) {
    const mergedWeight = (updateData.weightKg as number | undefined) ?? user.weightKg
    const mergedHeight = (updateData.heightCm as number | undefined) ?? user.heightCm
    const mergedAge = (updateData.age as number | undefined) ?? user.age
    const mergedSex = (updateData.sex as Sex | undefined) ?? (user.sex as Sex)
    const mergedActivity = (updateData.activityLevel as ActivityLevel | undefined) ?? (user.activityLevel as ActivityLevel)
    const mergedGoal = (updateData.goal as Goal | undefined) ?? (user.goal as Goal)

    const metrics = computeAllMetrics(mergedWeight, mergedHeight, mergedAge, mergedSex, mergedActivity, mergedGoal)
    updateData.bmi = metrics.bmi
    updateData.bmr = metrics.bmr
    updateData.tdee = metrics.tdee
    updateData.bodyFatPct = metrics.estimatedBodyFat
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })

  // If weight changed, also create a weight log entry
  if (updateData.weightKg !== undefined) {
    await prisma.weightLog.create({
      data: {
        userId,
        weightKg: updateData.weightKg as number,
        notes: 'Updated via settings',
      },
    }).catch(() => {}) // non-critical
  }

  // Return user without passwordHash
  const { passwordHash: _omit, ...safeUser } = updatedUser
  return NextResponse.json({ user: safeUser })
}
