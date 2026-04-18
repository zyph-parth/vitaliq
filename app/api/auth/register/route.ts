// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { computeAllMetrics } from '@/lib/calculations'

// Simple but effective email-format check — avoids heavyweight validator deps
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, age, sex, heightCm, weightKg, activityLevel, goal } = body

    // ── Required field presence ─────────────────────────────────────────
    if (!name || !email || !password || !age || !sex || !heightCm || !weightKg || !activityLevel || !goal) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // ── Email format ────────────────────────────────────────────────────
    const normalizedEmail = String(email).toLowerCase().trim()
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // ── Password strength ───────────────────────────────────────────────
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (String(password).length > 128) {
      return NextResponse.json({ error: 'Password is too long (max 128 characters)' }, { status: 400 })
    }

    // ── Numeric field validation ────────────────────────────────────────
    const parsedAge = parseInt(age, 10)
    const parsedHeight = parseFloat(heightCm)
    const parsedWeight = parseFloat(weightKg)

    if (isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      return NextResponse.json({ error: 'Please enter a valid age (13–120)' }, { status: 400 })
    }
    if (isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 280) {
      return NextResponse.json({ error: 'Height must be between 100 and 280 cm' }, { status: 400 })
    }
    if (isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 500) {
      return NextResponse.json({ error: 'Weight must be between 20 and 500 kg' }, { status: 400 })
    }

    // ── Enum validation ─────────────────────────────────────────────────
    const VALID_SEX = new Set(['male', 'female'])
    const VALID_ACTIVITY = new Set(['sedentary', 'light', 'moderate', 'active', 'athlete'])
    const VALID_GOAL = new Set(['lose', 'muscle', 'maintain', 'longevity'])

    if (!VALID_SEX.has(sex)) {
      return NextResponse.json({ error: 'Invalid sex value' }, { status: 400 })
    }
    if (!VALID_ACTIVITY.has(activityLevel)) {
      return NextResponse.json({ error: 'Invalid activity level' }, { status: 400 })
    }
    if (!VALID_GOAL.has(goal)) {
      return NextResponse.json({ error: 'Invalid goal value' }, { status: 400 })
    }

    // ── Duplicate check ─────────────────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // ── Hash password ───────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(String(password), 12)

    // ── Calculate all body metrics ──────────────────────────────────────
    const metrics = computeAllMetrics(parsedWeight, parsedHeight, parsedAge, sex, activityLevel, goal)

    // ── Create user + initial streak ────────────────────────────────────
    const user = await prisma.user.create({
      data: {
        name: String(name).trim().slice(0, 100),
        email: normalizedEmail,
        passwordHash,
        age: parsedAge,
        sex,
        heightCm: parsedHeight,
        weightKg: parsedWeight,
        activityLevel,
        goal,
        bmi: metrics.bmi,
        bmr: metrics.bmr,
        tdee: metrics.tdee,
        bodyFatPct: metrics.estimatedBodyFat ?? null,
        streak: { create: { currentDays: 0, bestDays: 0 } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        bmi: true,
        bmr: true,
        tdee: true,
      },
    })

    // ── Log initial weight ──────────────────────────────────────────────
    await prisma.weightLog.create({
      data: {
        userId: user.id,
        weightKg: parsedWeight,
        bodyFatPct: metrics.estimatedBodyFat ?? null,
      },
    })

    return NextResponse.json(
      { user, metrics, message: 'Account created successfully' },
      { status: 201 }
    )

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
