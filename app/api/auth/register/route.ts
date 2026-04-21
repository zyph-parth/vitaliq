import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { prisma } from '@/lib/prisma'
import { computeAllMetrics } from '@/lib/calculations'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function ensureUpstashRedisEnv(): boolean {
  const hasUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL)
  const hasToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

  if (hasUrl && hasToken) return true

  const message = '[VitalIQ] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set for register rate limiting.'
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message)
  }

  console.warn(`${message} Rate limiting is disabled in development.`)
  return false
}

const registerRateLimit = ensureUpstashRedisEnv()
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix: 'vitaliq:register',
    })
  : null

async function checkRateLimit(key: string): Promise<boolean> {
  if (!registerRateLimit) return true
  const { success } = await registerRateLimit.limit(key)
  return success
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitKey = req.ip ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (!(await checkRateLimit(rateLimitKey))) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': '900' } }
      )
    }

    const body = await req.json()
    const { name, email, password, age, sex, heightCm, weightKg, activityLevel, goal } = body

    if (!name || !email || !password || !age || !sex || !heightCm || !weightKg || !activityLevel || !goal) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    const normalizedEmail = String(email).toLowerCase().trim()
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (String(password).length > 128) {
      return NextResponse.json({ error: 'Password is too long (max 128 characters)' }, { status: 400 })
    }

    const parsedAge = parseInt(age, 10)
    const parsedHeight = parseFloat(heightCm)
    const parsedWeight = parseFloat(weightKg)

    if (isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      return NextResponse.json({ error: 'Please enter a valid age (13-120)' }, { status: 400 })
    }
    if (isNaN(parsedHeight) || parsedHeight < 100 || parsedHeight > 280) {
      return NextResponse.json({ error: 'Height must be between 100 and 280 cm' }, { status: 400 })
    }
    if (isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 500) {
      return NextResponse.json({ error: 'Weight must be between 20 and 500 kg' }, { status: 400 })
    }

    const validSex = new Set(['male', 'female'])
    const validActivity = new Set(['sedentary', 'light', 'moderate', 'active', 'athlete'])
    const validGoal = new Set(['lose', 'muscle', 'maintain', 'longevity'])

    if (!validSex.has(sex)) {
      return NextResponse.json({ error: 'Invalid sex value' }, { status: 400 })
    }
    if (!validActivity.has(activityLevel)) {
      return NextResponse.json({ error: 'Invalid activity level' }, { status: 400 })
    }
    if (!validGoal.has(goal)) {
      return NextResponse.json({ error: 'Invalid goal value' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(String(password), 12)
    const metrics = computeAllMetrics(parsedWeight, parsedHeight, parsedAge, sex, activityLevel, goal)

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: String(name).trim().slice(0, 100),
          email: normalizedEmail,
          passwordHash,
          profileComplete: true,
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

      await tx.weightLog.create({
        data: {
          userId: createdUser.id,
          weightKg: parsedWeight,
          bodyFatPct: metrics.estimatedBodyFat ?? null,
        },
      })

      return createdUser
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
