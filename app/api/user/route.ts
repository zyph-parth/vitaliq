// app/api/user/route.ts - PATCH user profile stats
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { computeAllMetrics } from '@/lib/calculations'
import type { ActivityLevel, Goal, Sex } from '@/lib/calculations'

const VALID_SEX = new Set(['male', 'female'])
const VALID_ACTIVITY = new Set(['sedentary', 'light', 'moderate', 'active', 'athlete'])
const VALID_GOAL = new Set(['lose', 'muscle', 'maintain', 'longevity'])

type BaseProfile = {
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
}

function isBaseProfile(value: {
  age?: number | null
  sex?: string | null
  heightCm?: number | null
  weightKg?: number | null
  activityLevel?: string | null
  goal?: string | null
}): value is BaseProfile {
  return (
    typeof value.age === 'number' &&
    VALID_SEX.has(String(value.sex)) &&
    typeof value.heightCm === 'number' &&
    typeof value.weightKg === 'number' &&
    VALID_ACTIVITY.has(String(value.activityLevel)) &&
    VALID_GOAL.has(String(value.goal))
  )
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json()
  const { name, age, sex, heightCm, weightKg, activityLevel, goal } = body

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = String(name).trim().slice(0, 100)
  if (age !== undefined) updateData.age = Number.parseInt(String(age), 10)
  if (sex !== undefined) updateData.sex = sex
  if (heightCm !== undefined) updateData.heightCm = Number.parseFloat(String(heightCm))
  if (weightKg !== undefined) updateData.weightKg = Number.parseFloat(String(weightKg))
  if (activityLevel !== undefined) updateData.activityLevel = activityLevel
  if (goal !== undefined) updateData.goal = goal

  if (updateData.sex && !VALID_SEX.has(updateData.sex as string)) {
    return NextResponse.json({ error: 'Invalid sex value' }, { status: 400 })
  }
  if (updateData.activityLevel && !VALID_ACTIVITY.has(updateData.activityLevel as string)) {
    return NextResponse.json({ error: 'Invalid activity level' }, { status: 400 })
  }
  if (updateData.goal && !VALID_GOAL.has(updateData.goal as string)) {
    return NextResponse.json({ error: 'Invalid goal value' }, { status: 400 })
  }

  if (updateData.age !== undefined && (Number.isNaN(updateData.age as number) || (updateData.age as number) < 10 || (updateData.age as number) > 120)) {
    return NextResponse.json({ error: 'age must be between 10 and 120' }, { status: 400 })
  }
  if (updateData.weightKg !== undefined && (Number.isNaN(updateData.weightKg as number) || (updateData.weightKg as number) <= 0 || (updateData.weightKg as number) > 500)) {
    return NextResponse.json({ error: 'weightKg must be a positive number' }, { status: 400 })
  }
  if (updateData.heightCm !== undefined && (Number.isNaN(updateData.heightCm as number) || (updateData.heightCm as number) < 100 || (updateData.heightCm as number) > 250)) {
    return NextResponse.json({ error: 'heightCm must be between 100 and 250 cm' }, { status: 400 })
  }

  const bodyFieldsChanged = ['weightKg', 'heightCm', 'age', 'sex', 'activityLevel', 'goal']
    .some((key) => updateData[key] !== undefined)

  if (bodyFieldsChanged) {
    const mergedProfile = {
      weightKg: (updateData.weightKg as number | undefined) ?? user.weightKg,
      heightCm: (updateData.heightCm as number | undefined) ?? user.heightCm,
      age: (updateData.age as number | undefined) ?? user.age,
      sex: (updateData.sex as string | undefined) ?? user.sex,
      activityLevel: (updateData.activityLevel as string | undefined) ?? user.activityLevel,
      goal: (updateData.goal as string | undefined) ?? user.goal,
    }

    if (!isBaseProfile(mergedProfile)) {
      return NextResponse.json(
        { error: 'Age, sex, height, weight, activity level, and goal are required to complete your profile.' },
        { status: 400 }
      )
    }

    const metrics = computeAllMetrics(
      mergedProfile.weightKg,
      mergedProfile.heightCm,
      mergedProfile.age,
      mergedProfile.sex,
      mergedProfile.activityLevel,
      mergedProfile.goal
    )

    updateData.bmi = metrics.bmi
    updateData.bmr = metrics.bmr
    updateData.tdee = metrics.tdee
    updateData.bodyFatPct = metrics.estimatedBodyFat
    updateData.profileComplete = true
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })

  if (updateData.weightKg !== undefined) {
    await prisma.weightLog.create({
      data: {
        userId,
        weightKg: updateData.weightKg as number,
        bodyFatPct: (updateData.bodyFatPct as number | undefined) ?? null,
        notes: user.profileComplete ? 'Updated via settings' : 'Initial profile setup',
      },
    }).catch(() => {})
  }

  const { passwordHash: _passwordHash, googleId: _googleId, ...safeUser } = updatedUser
  return NextResponse.json({ user: safeUser })
}
