// app/api/biomarkers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// Reference ranges for biomarkers
const REFERENCE_RANGES: Record<string, { min: number; max: number; unit: string; label: string }> = {
  glucose:           { min: 70,   max: 100,  unit: 'mg/dL',     label: 'Fasting glucose' },
  cholesterol_total: { min: 0,    max: 200,  unit: 'mg/dL',     label: 'Total cholesterol' },
  ldl:               { min: 0,    max: 100,  unit: 'mg/dL',     label: 'LDL cholesterol' },
  hdl:               { min: 40,   max: 999,  unit: 'mg/dL',     label: 'HDL cholesterol' },
  triglycerides:     { min: 0,    max: 150,  unit: 'mg/dL',     label: 'Triglycerides' },
  vitamin_d:         { min: 30,   max: 80,   unit: 'ng/mL',     label: 'Vitamin D' },
  ferritin:          { min: 12,   max: 300,  unit: 'ng/mL',     label: 'Ferritin' },
  creatinine:        { min: 0.6,  max: 1.2,  unit: 'mg/dL',     label: 'Creatinine' },
  vo2max:            { min: 40,   max: 999,  unit: 'mL/kg/min', label: 'VO₂ max' },
  biological_age:    { min: 0,    max: 999,  unit: 'years',     label: 'Biological age' },
}

const VALID_TYPES = new Set(Object.keys(REFERENCE_RANGES))

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const markers = await prisma.biomarker.findMany({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
  })

  // Get latest value per type
  const latest: Record<string, {
    id: string; type: string; value: number; unit: string; source: string;
    notes: string | null; recordedAt: Date;
    label: string; inRange: boolean; refMin: number | null; refMax: number | null;
  }> = {}

  for (const m of markers) {
    if (!latest[m.type]) {
      const ref = REFERENCE_RANGES[m.type]
      latest[m.type] = {
        ...m,
        label: ref?.label ?? m.type,
        unit: ref?.unit ?? m.unit,
        inRange: ref ? m.value >= ref.min && m.value <= ref.max : true,
        refMin: ref?.min ?? null,
        refMax: ref?.max === 999 ? null : ref?.max ?? null, // hide sentinel 999
      }
    }
  }

  // Compute longevity score (weighted % of in-range markers)
  const markerList = Object.values(latest)
  const inRangeCount = markerList.filter((m) => m.inRange).length
  const longevityScore = markerList.length > 0
    ? Math.round((inRangeCount / markerList.length) * 100)
    : null

  return NextResponse.json({ markers: markerList, history: markers, longevityScore })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id

  const body = await req.json()
  const { entries } = body

  // ── Input validation ────────────────────────────────────────────────────
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'entries must be a non-empty array' }, { status: 400 })
  }
  if (entries.length > 20) {
    return NextResponse.json({ error: 'Cannot submit more than 20 biomarkers at once' }, { status: 400 })
  }

  for (const e of entries) {
    if (!e.type || !VALID_TYPES.has(e.type)) {
      return NextResponse.json({ error: `Invalid biomarker type: ${e.type}` }, { status: 400 })
    }
    const val = parseFloat(e.value)
    if (isNaN(val) || val < 0) {
      return NextResponse.json({ error: `Invalid value for ${e.type}` }, { status: 400 })
    }
  }

  const created = await prisma.biomarker.createMany({
    data: entries.map((e: { type: string; value: string | number; unit?: string; source?: string; notes?: string }) => ({
      userId,
      type: e.type,
      value: parseFloat(String(e.value)),
      unit: e.unit || REFERENCE_RANGES[e.type]?.unit || 'units',
      source: e.source || 'manual',
      notes: e.notes ? String(e.notes).slice(0, 500) : null,
    })),
  })

  return NextResponse.json({ count: created.count }, { status: 201 })
}
