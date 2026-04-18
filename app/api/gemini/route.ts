// app/api/gemini/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// ── Model candidates with sane defaults ─────────────────────────────────────
const DEFAULT_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash']

// ── Per-user in-memory rate limiter (max 20 req/min per user) ───────────────
// ⚠ In-memory — resets on server restart. Acceptable for hackathon/demo.
// Production: replace with Redis INCR + EXPIRE.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now - entry.windowStart > 60_000) {
    rateLimitMap.set(userId, { count: 1, windowStart: now })
    return true
  }
  entry.count += 1
  return entry.count <= 20
}

// ── Stale entry GC — runs every 5 min to prevent memory bloat ───────────────
setInterval(() => {
  const threshold = Date.now() - 70_000
  for (const [id, entry] of rateLimitMap) {
    if (entry.windowStart < threshold) rateLimitMap.delete(id)
  }
}, 5 * 60 * 1000)

function getKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not configured on this server.')
  return key
}

function getCandidateModels(): string[] {
  const primary = process.env.GEMINI_MODEL_PRIMARY?.trim()
  const fallbacks = process.env.GEMINI_MODEL_FALLBACKS
    ?.split(',').map(m => m.trim()).filter(Boolean) ?? []

  return Array.from(
    new Set([primary, ...fallbacks, ...DEFAULT_GEMINI_MODELS].filter((m): m is string => Boolean(m)))
  )
}

// ── Core Gemini caller with multi-model fallback ─────────────────────────────
async function callGemini(
  body: { contents: object[] },
  key: string,
  maxTokens = 800,
  temp = 0.3,
  responseMimeType?: 'application/json'
): Promise<string> {
  let lastError: Error | null = null

  for (const model of getCandidateModels()) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    const generationConfig: Record<string, unknown> = {
      temperature: temp,
      maxOutputTokens: maxTokens,
    }

    // gemini-2.5 requires explicit thinkingBudget: 0 for non-thinking mode
    if (model.startsWith('gemini-2.5')) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 }
    }

    // Only request JSON mime type for models that support it
    if (responseMimeType && !model.startsWith('gemini-1.0')) {
      generationConfig.responseMimeType = responseMimeType
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: body.contents, generationConfig }),
        // FIX: add a 15-second timeout so a hung Gemini request doesn't block forever
        signal: AbortSignal.timeout(15_000),
      })

      if (response.ok) {
        const data = await response.json()
        const text = (data.candidates?.[0]?.content?.parts as Array<{ text?: string }> | undefined)
          ?.map(p => (typeof p?.text === 'string' ? p.text : ''))
          .join('') ?? ''

        if (!text.trim()) {
          // Empty response — Gemini returned a candidate with no text (safety block, etc.)
          lastError = new Error(`Empty response from ${model}`)
          continue
        }

        return text
      }

      const errorText = await response.text().catch(() => `HTTP ${response.status}`)
      const normalizedError = errorText.toLowerCase()

      const shouldFallthrough =
        response.status === 429 ||    // quota / rate limit
        response.status >= 500 ||    // server-side Gemini error
        (response.status === 404 && normalizedError.includes('not found')) ||
        (response.status === 400 && (
          normalizedError.includes('thinking_budget') ||
          normalizedError.includes('response mime type') ||
          normalizedError.includes('not supported')
        ))

      if (shouldFallthrough) {
        lastError = new Error(`${model}: ${response.status} — ${errorText.slice(0, 200)}`)
        continue
      }

      // Non-retriable error (bad request, auth failure) — surface immediately
      throw new Error(`Gemini error from ${model}: ${errorText.slice(0, 400)}`)
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        lastError = new Error(`${model} timed out after 15s`)
        continue
      }
      throw err  // re-throw non-timeout errors
    }
  }

  throw lastError ?? new Error(`No Gemini model responded. Tried: ${getCandidateModels().join(', ')}`)
}

// ── Safe JSON parser — strips code-fence wrappers Gemini sometimes adds ──────
function parseJSON(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(cleaned)
}

// ── Input sanitisation helpers ───────────────────────────────────────────────
const MAX_DESCRIPTION_LEN = 500
const MAX_QUESTION_LEN = 800

function sanitize(text: string, maxLen: number): string {
  return String(text).replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, maxLen)
}

// ── ALLOWED request types — rejects anything outside this set ────────────────
const ALLOWED_TYPES = new Set([
  'meal_analysis', 'workout_generation', 'coach_chat',
  'bmi_recommendations', 'daily_insight', 'meal_swap',
])

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate limiting ─────────────────────────────────────────────────────────
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': '60' },  // FIX: add Retry-After header
        }
      )
    }

    const key = getKey()
    const contentType = req.headers.get('content-type') ?? ''

    // ── Multipart branch — photo meal analysis ────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const imageFile = formData.get('image') as File | null
      const text = formData.get('text') as string | null

      if (!imageFile && !text) {
        return NextResponse.json({ error: 'No input provided.' }, { status: 400 })
      }

      if (imageFile) {
        // Validate MIME
        const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
        if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
          return NextResponse.json(
            { error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' },
            { status: 400 }
          )
        }
        // Validate size
        if (imageFile.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: 'Image must be under 5 MB.' }, { status: 400 })
        }
      }

      const contents = imageFile
        ? [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: imageFile.type,
                    data: Buffer.from(await imageFile.arrayBuffer()).toString('base64'),
                  },
                },
                {
                  text: 'You are a precise nutrition AI for VitalIQ. Identify all food items in this image and estimate their calories and macros. ONLY answer about food and nutrition. Return ONLY valid JSON with no extra text:\n{"foodName":"string","emoji":"single emoji","totalCalories":number,"proteinG":number,"carbsG":number,"fatG":number,"fibreG":number,"aiInsight":"one sentence about nutritional quality","mealType":"breakfast|lunch|dinner|snack|pre_workout|post_workout","items":[{"name":"string","portion":"string","calories":number}]}',
                },
              ],
            },
          ]
        : [
            {
              parts: [
                {
                  text: `You are a precise nutrition AI for VitalIQ. ONLY answer about food and nutrition. Estimate calories and macros for: "${sanitize(text!, MAX_DESCRIPTION_LEN)}". Return ONLY valid JSON:\n{"foodName":"string","emoji":"single emoji","totalCalories":number,"proteinG":number,"carbsG":number,"fatG":number,"fibreG":number,"aiInsight":"one sentence","mealType":"breakfast|lunch|dinner|snack|pre_workout|post_workout","items":[{"name":"string","portion":"string","calories":number}]}`,
                },
              ],
            },
          ]

      const raw = await callGemini({ contents }, key, 600, 0.2, 'application/json')
      const result = parseJSON(raw) as Record<string, unknown>

      // Sanitise numeric outputs — prevent garbage values reaching the DB
      result.totalCalories = Math.max(0, Math.round(Number(result.totalCalories) || 0))
      result.proteinG      = Math.max(0, Math.round(Number(result.proteinG)      || 0))
      result.carbsG        = Math.max(0, Math.round(Number(result.carbsG)        || 0))
      result.fatG          = Math.max(0, Math.round(Number(result.fatG)          || 0))
      result.fibreG        = Math.max(0, Math.round(Number(result.fibreG)        || 0))

      // Paranoia cap — Gemini hallucinating 10 000 kcal for a salad shouldn't reach the DB
      if ((result.totalCalories as number) > 5000) {
        return NextResponse.json(
          { error: 'The AI returned an implausible calorie estimate. Please re-describe or retry.' },
          { status: 422 }
        )
      }

      return NextResponse.json({ result })
    }

    // ── JSON branch — all structured request types ────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const { type, payload } = body as { type: string; payload: Record<string, unknown> }

    // FIX: reject unknown types early — prevents prompt injection via type field
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: `Unknown request type: ${type}` }, { status: 400 })
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Payload is required.' }, { status: 400 })
    }

    let prompt = ''
    let maxTokens = 800
    let temp = 0.3

    switch (type) {
      case 'meal_analysis': {
        const description = sanitize(String(payload.description ?? ''), MAX_DESCRIPTION_LEN)
        if (!description) return NextResponse.json({ error: 'description is required.' }, { status: 400 })
        const ctx = payload.userContext ?? {}
        prompt = `You are a precise nutrition AI for VitalIQ. ONLY answer about food and nutrition. Do NOT answer unrelated questions.
User health context: ${JSON.stringify(ctx)}
Meal to analyze: "${description}"
Return ONLY valid JSON (no extra text, no markdown):
{"calories":integer,"proteinG":float,"carbsG":float,"fatG":float,"fibreG":float,"sugarG":float,"sodiumMg":float,"mealType":"breakfast|lunch|dinner|snack|pre_workout|post_workout","ingredients":["string"],"aiInsight":"one sentence about nutritional quality relevant to their goal","quality_score":integer_1_to_10}`
        maxTokens = 500
        break
      }

      case 'workout_generation': {
        const uc = payload.userContext ?? {}
        const readinessScore = Number(payload.readinessScore ?? 70)
        const equipment = String(payload.equipment ?? 'home')
        const fitnessLevel = String(payload.fitnessLevel ?? 'intermediate')
        const intensity = readinessScore >= 75 ? 'high' : readinessScore >= 50 ? 'moderate' : 'light'
        const isBodyweight = equipment.includes('bodyweight') || equipment.includes('home') || equipment.includes('outdoor')
        const equipmentNote = isBodyweight
          ? 'STRICT: Only use bodyweight exercises. No barbells, machines, or cables. Weight field = "bodyweight".'
          : `Equipment available: ${sanitize(equipment, 200)}`
        const levelNote = {
          beginner: 'Beginner — simple movements, clear form cues, no complex compound lifts',
          intermediate: 'Intermediate — balanced compound + isolation mix',
          advanced: 'Advanced — compound movements, progressive overload, higher intensity',
        }[fitnessLevel] ?? 'Intermediate'
        prompt = `You are an expert personal trainer AI. ONLY provide workout programming. Do not stray into recipes, medical advice, or unrelated topics.
User: ${JSON.stringify(uc)}
Readiness today: ${readinessScore}/100. Target intensity: ${intensity}
${equipmentNote}
Fitness level: ${levelNote}
Return ONLY valid JSON (no markdown):
{"title":"string","sessionType":"push|pull|legs|full_body|cardio|hiit|yoga|rest","durationMins":integer,"estimatedCalories":integer,"coachNote":"string (max 30 words)","exercises":[{"name":"string","sets":integer,"repsOrDuration":"string","restSec":integer,"weight":"string","tip":"string (max 15 words)"}]}`
        maxTokens = 1500
        break
      }

      case 'coach_chat': {
        const uc = payload.userContext ?? {}
        const question = sanitize(String(payload.question ?? ''), MAX_QUESTION_LEN)
        if (!question) return NextResponse.json({ error: 'question is required.' }, { status: 400 })
        const history = (Array.isArray(payload.chatHistory) ? payload.chatHistory : [])
          .slice(-4)
          .map((m: { role: string; content: string }) => `${m.role}: ${sanitize(String(m.content), 300)}`)
          .join('\n')
        const hydrationNote = typeof (uc as { glassesToday?: number }).glassesToday === 'number'
          ? ` Hydration today: ${(uc as { glassesToday: number }).glassesToday} glasses of water.`
          : ''
        prompt = `You are VitalIQ Coach — a warm, knowledgeable, data-driven health and fitness coach.
STRICT SCOPE: Only answer questions about nutrition, fitness, sleep, recovery, mental wellbeing, hydration, and general health. If asked anything outside this scope (politics, coding, shopping, etc.) politely decline and redirect to their health goals.
User health data: ${JSON.stringify(uc)}${hydrationNote}
Recent chat history:
${history}
User question: "${question}"
Rules: max 120 words. Be conversational. Reference their actual metrics where relevant. Give one specific actionable recommendation. If data is missing, suggest they log it.`
        temp = 0.75
        maxTokens = 300  // FIX: was unlimited — cap coach responses at 300 tokens
        break
      }

      case 'bmi_recommendations': {
        const { profile } = payload as { profile: Record<string, unknown> }
        if (!profile) return NextResponse.json({ error: 'profile is required.' }, { status: 400 })
        prompt = `You are a warm, evidence-based fitness coach for VitalIQ. ONLY discuss health, nutrition, fitness, and lifestyle.
User: BMI ${profile.bmi} (${profile.bmiCategory}), age ${profile.age}, sex ${profile.sex}, activity level ${profile.activityLevel}, goal: ${profile.goal}, daily calories: ${profile.targetCalories} kcal.
Give exactly 4 short, actionable, non-judgmental recommendations covering: (1) training (2) diet (3) hydration (4) daily habit.
Return ONLY a JSON array of exactly 4 strings. No markdown, no extra keys.`
        maxTokens = 600
        break
      }

      case 'daily_insight': {
        const { userContext: uc2, readiness } = payload as { userContext: unknown; readiness: { score: number; pillars: unknown } }
        if (!readiness) return NextResponse.json({ error: 'readiness is required.' }, { status: 400 })
        prompt = `You are a VitalIQ health intelligence engine. ONLY generate insights about the user's health data.
User: ${JSON.stringify(uc2)}, Readiness: ${readiness.score}/100, Pillar scores: ${JSON.stringify(readiness.pillars)}
Return ONLY valid JSON:
{"headline":"max 12 words","body":"2-3 sentences referencing their actual data","actionable":"one specific thing to do today","pillarsUsed":["sleep","nutrition"]}`
        maxTokens = 400
        break
      }

      case 'meal_swap': {
        const meal = sanitize(String(payload.meal ?? ''), 200)
        const goal = sanitize(String(payload.goal ?? 'maintain'), 50)
        const prefs = sanitize(String(payload.preferences ?? 'none'), 200)
        if (!meal) return NextResponse.json({ error: 'meal is required.' }, { status: 400 })
        prompt = `You are a nutrition AI for VitalIQ. ONLY answer about food and nutrition.
Suggest 2 healthier alternatives to: "${meal}". User goal: ${goal}. Preferences: ${prefs}.
Return ONLY valid JSON:
{"swaps":[{"name":"string","reason":"string (max 15 words)","calories":number,"proteinG":float},{"name":"string","reason":"string (max 15 words)","calories":number,"proteinG":float}]}`
        maxTokens = 400
        break
      }
    }

    const raw = await callGemini(
      { contents: [{ parts: [{ text: prompt }] }] },
      key,
      maxTokens,
      temp,
      type === 'coach_chat' ? undefined : 'application/json'
    )

    // Coach chat — plain text response
    if (type === 'coach_chat') {
      const reply = raw.trim()
      if (!reply) {
        return NextResponse.json({ result: "I'm having trouble responding right now. Please try again in a moment." })
      }
      return NextResponse.json({ result: reply })
    }

    // JSON response with graceful parsing fallback
    try {
      return NextResponse.json({ result: parseJSON(raw) })
    } catch {
      // Gemini returned non-JSON — log it and surface a user-friendly error
      console.error('[Gemini] JSON parse failed for type:', type, '| Raw:', raw.slice(0, 200))
      return NextResponse.json(
        { error: 'The AI returned an unexpected response format. Please try again.' },
        { status: 502 }
      )
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Gemini route error]', error)

    // Surface model exhaustion specifically so the client can show a meaningful error
    if (msg.includes('No Gemini model responded') || msg.includes('GEMINI_API_KEY')) {
      return NextResponse.json(
        { error: 'AI service is temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
