// app/api/health/route.ts — Public health check endpoint (not in middleware matcher)
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
