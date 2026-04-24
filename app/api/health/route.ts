// app/api/health/route.ts - Public health check endpoint (not in middleware matcher)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString()
  const deep = req.nextUrl.searchParams.get('deep') === '1'

  if (!deep) {
    return NextResponse.json({ status: 'ok', timestamp })
  }

  const checks = {
    database: false,
    authSecret: Boolean(process.env.NEXTAUTH_SECRET),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    upstashConfigured: Boolean(
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ),
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch (error) {
    console.error('[VitalIQ] health database check failed:', error)
  }

  const ready = Object.values(checks).every(Boolean)

  return NextResponse.json(
    {
      status: ready ? 'ok' : 'degraded',
      timestamp,
      checks,
    },
    { status: ready ? 200 : 503 }
  )
}
