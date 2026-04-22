// app/api/gemini/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import {
  bmiRecommendationsSchema,
  dailyInsightSchema,
  mealAnalysisSchema,
  mealSwapSchema,
  parseModelJson,
  photoMealAnalysisSchema,
  validateBmiRecommendations,
  validateDailyInsight,
  validateMealSwap,
  validatePhotoMealAnalysis,
  validateTextMealAnalysis,
  validateWorkoutGeneration,
  validationSummary,
  workoutGenerationSchema,
  type GeminiJsonSchema,
  type ValidationResult,
} from '@/lib/llm-validation'

// ── Model candidates with sane defaults ─────────────────────────────────────
const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
const RETIRED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
])

// ── Upstash Redis sliding-window rate limiter (20 req/min per user) ─────────
// Durable across serverless cold starts; no GC needed.
const COACH_HISTORY_LIMIT = 6

function ensureUpstashRedisEnv(): boolean {
  const hasUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL)
  const hasToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

  if (hasUrl && hasToken) return true

  const message = '[VitalIQ] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set for Gemini rate limiting.'
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message)
  }

  console.warn(`${message} Rate limiting is disabled in development.`)
  return false
}

const ratelimit = ensureUpstashRedisEnv()
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'vitaliq:gemini',
    })
  : null

async function checkRateLimit(userId: string): Promise<boolean> {
  if (!ratelimit) return true
  const { success } = await ratelimit.limit(userId)
  return success
}

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
    new Set(
      [primary, ...fallbacks, ...DEFAULT_GEMINI_MODELS]
        .filter((m): m is string => Boolean(m))
        .filter((model) => !RETIRED_GEMINI_MODELS.has(model))
    )
  )
}

// ── Core Gemini caller with multi-model fallback ─────────────────────────────
async function callGemini(
  body: { contents: object[] },
  key: string,
  options: {
    maxTokens?: number
    temp?: number
    responseMimeType?: 'application/json'
    responseJsonSchema?: GeminiJsonSchema
    thinkingBudget?: number
  } = {}
): Promise<string> {
  let lastError: Error | null = null
  const candidateModels = getCandidateModels()
  const {
    maxTokens = 800,
    temp = 0.3,
    responseMimeType,
    responseJsonSchema,
    thinkingBudget = 0,
  } = options

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    const generationConfig: Record<string, unknown> = {
      temperature: temp,
      maxOutputTokens: maxTokens,
    }

    // gemini-2.5 requires explicit thinkingBudget: 0 for non-thinking mode
    if (model.startsWith('gemini-2.5')) {
      generationConfig.thinkingConfig = { thinkingBudget }
    }

    // Only request JSON mime type for models that support it
    if (responseMimeType && !model.startsWith('gemini-1.0')) {
      generationConfig.responseMimeType = responseMimeType
    }

    if (responseJsonSchema && !model.startsWith('gemini-1.0')) {
      generationConfig.responseJsonSchema = responseJsonSchema
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: body.contents, generationConfig }),
        signal: AbortSignal.timeout(12_000),
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
          normalizedError.includes('response_json_schema') ||
          normalizedError.includes('response json schema') ||
          normalizedError.includes('not supported')
        ))

      if (shouldFallthrough) {
        lastError = new Error(`${model}: ${response.status} — ${errorText.slice(0, 200)}`)
        continue
      }

      // Non-retriable error (bad request, auth failure) — surface immediately
      throw new Error(`Gemini error from ${model}: ${errorText.slice(0, 400)}`)
    } catch (err) {
      if (isTransientFetchError(err)) {
        const reason = err instanceof Error ? err.message : 'transient fetch failure'
        lastError = new Error(`${model}: ${reason}`)
        continue
      }
      throw err  // re-throw non-timeout errors
    }
  }

  throw new Error(
    `No Gemini model responded. Tried: ${candidateModels.join(', ')}. Last error: ${lastError?.message ?? 'unknown'}`
  )
}

// ── Safe JSON parser — strips code-fence wrappers Gemini sometimes adds ──────
function isTransientFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const message = err.message.toLowerCase()
  return (
    err.name === 'TimeoutError' ||
    err.name === 'AbortError' ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('socket') ||
    message.includes('econnreset')
  )
}

// ── Input sanitisation helpers ───────────────────────────────────────────────
const MAX_DESCRIPTION_LEN = 500
const MAX_QUESTION_LEN = 800

function sanitize(text: string, maxLen: number): string {
  return String(text).replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, maxLen)
}

// ── ALLOWED request types — rejects anything outside this set ────────────────
function safeJson(value: unknown, maxLen = 2500): string {
  try {
    return JSON.stringify(value ?? {}).slice(0, maxLen)
  } catch {
    return '{}'
  }
}

function getThinkingBudget(type: string): number {
  const envKey = `GEMINI_THINKING_BUDGET_${type.toUpperCase()}`
  const raw = process.env[envKey] ?? process.env.GEMINI_THINKING_BUDGET
  const parsed = Number(raw)

  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.min(1024, Math.floor(parsed))
}

function parseAndValidate<T>(
  raw: string,
  validator: (value: unknown) => ValidationResult<T>
): ValidationResult<T> {
  try {
    return validator(parseModelJson(raw))
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : 'Invalid JSON response.'],
    }
  }
}

function buildRepairText(label: string, raw: string, errors: string[]): string {
  return [
    `The previous ${label} response failed validation.`,
    `Validation errors: ${validationSummary(errors)}`,
    'Regenerate the answer. Return ONLY valid JSON matching the configured schema.',
    `Previous response excerpt: ${sanitize(raw, 1200)}`,
  ].join('\n')
}

async function generateValidatedJSON<T>(args: {
  label: string
  key: string
  contents: object[]
  schema: GeminiJsonSchema
  validator: (value: unknown) => ValidationResult<T>
  maxTokens: number
  temp: number
  thinkingBudget?: number
  retryContents?: (raw: string, errors: string[]) => object[]
}): Promise<T> {
  const raw = await callGemini({ contents: args.contents }, args.key, {
    maxTokens: args.maxTokens,
    temp: args.temp,
    responseMimeType: 'application/json',
    responseJsonSchema: args.schema,
    thinkingBudget: args.thinkingBudget,
  })
  const parsed = parseAndValidate(raw, args.validator)

  if (parsed.ok) return parsed.value

  console.warn(`[Gemini] ${args.label} validation failed; retrying once:`, validationSummary(parsed.errors))

  const retryContents = args.retryContents?.(raw, parsed.errors) ?? args.contents
  const retryRaw = await callGemini({ contents: retryContents }, args.key, {
    maxTokens: args.maxTokens,
    temp: Math.min(args.temp, 0.2),
    responseMimeType: 'application/json',
    responseJsonSchema: args.schema,
    thinkingBudget: args.thinkingBudget,
  })
  const retryParsed = parseAndValidate(retryRaw, args.validator)

  if (retryParsed.ok) return retryParsed.value

  console.error(
    `[Gemini] ${args.label} validation failed after retry:`,
    validationSummary(retryParsed.errors),
    '| Raw:',
    retryRaw.slice(0, 300)
  )
  throw new Error('The AI returned an unexpected response format. Please try again.')
}

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
    if (!(await checkRateLimit(session.user.id))) {
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
        const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
        if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
          return NextResponse.json(
            { error: 'Unsupported image type. Use JPEG, PNG, or WebP.' },
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

      const raw = await callGemini({ contents }, key, {
        maxTokens: 700,
        temp: 0.15,
        responseMimeType: 'application/json',
        responseJsonSchema: photoMealAnalysisSchema,
        thinkingBudget: getThinkingBudget('meal_analysis'),
      })
      let parsedPhoto = parseAndValidate(raw, validatePhotoMealAnalysis)

      if (!parsedPhoto.ok) {
        const retryContents = [
          {
            parts: [
              ...((contents[0] as { parts: object[] }).parts),
              { text: buildRepairText(imageFile ? 'photo meal analysis' : 'meal analysis', raw, parsedPhoto.errors) },
            ],
          },
        ]
        const retryRaw = await callGemini({ contents: retryContents }, key, {
          maxTokens: 700,
          temp: 0.15,
          responseMimeType: 'application/json',
          responseJsonSchema: photoMealAnalysisSchema,
          thinkingBudget: getThinkingBudget('meal_analysis'),
        })
        parsedPhoto = parseAndValidate(retryRaw, validatePhotoMealAnalysis)
      }

      if (!parsedPhoto.ok) {
        console.error('[Gemini] photo meal validation failed:', validationSummary(parsedPhoto.errors))
        return NextResponse.json(
          { error: 'The AI returned an unexpected response format. Please try again.' },
          { status: 502 }
        )
      }

      const result = parsedPhoto.value

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
    let schema: GeminiJsonSchema | null = null
    let validator: ((value: unknown) => ValidationResult<unknown>) | null = null

    switch (type) {
      case 'meal_analysis': {
        const description = sanitize(String(payload.description ?? ''), MAX_DESCRIPTION_LEN)
        if (!description) return NextResponse.json({ error: 'description is required.' }, { status: 400 })
        const ctx = payload.userContext ?? {}
        prompt = `You are a precise nutrition AI for VitalIQ. ONLY answer about food and nutrition. Do NOT answer unrelated questions.
User health context: ${safeJson(ctx)}
Meal to analyze: "${description}"
Return conservative estimates when portion size is unclear. Include item-level assumptions and confidence.
Return ONLY valid JSON matching the configured schema.`
        maxTokens = 700
        temp = 0.2
        schema = mealAnalysisSchema
        validator = validateTextMealAnalysis
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
User: ${safeJson(uc)}
Readiness today: ${readinessScore}/100. Target intensity: ${intensity}
${equipmentNote}
Fitness level: ${levelNote}
Rules: 3-8 exercises. Avoid max-effort/PR language. If readiness is under 50, avoid HIIT and keep the session light.
Return ONLY valid JSON matching the configured schema.`
        maxTokens = 1500
        temp = 0.25
        schema = workoutGenerationSchema
        validator = (value: unknown) => validateWorkoutGeneration(value, { bodyweightOnly: isBodyweight, readinessScore })
        break
      }

      case 'coach_chat': {
        const uc = payload.userContext ?? {}
        const question = sanitize(String(payload.question ?? ''), MAX_QUESTION_LEN)
        if (!question) return NextResponse.json({ error: 'question is required.' }, { status: 400 })
        const history = (Array.isArray(payload.chatHistory) ? payload.chatHistory : [])
          .slice(-COACH_HISTORY_LIMIT)
          .map((m: { role?: string; content?: string }) => {
            const role = m.role === 'ai' ? 'assistant' : 'user'
            return `${role}: ${sanitize(String(m.content ?? ''), 300)}`
          })
          .join('\n')
        const hydrationNote = typeof (uc as { glassesToday?: number }).glassesToday === 'number'
          ? ` Hydration today: ${(uc as { glassesToday: number }).glassesToday} glasses of water.`
          : ''
        prompt = `You are VitalIQ Coach — a warm, knowledgeable, data-driven health and fitness coach.
STRICT SCOPE: Only answer questions about nutrition, fitness, sleep, recovery, mental wellbeing, hydration, and general health. If asked anything outside this scope (politics, coding, shopping, etc.) politely decline and redirect to their health goals.
Safety: Do not diagnose disease, prescribe medication, or replace a clinician. For chest pain, severe shortness of breath, fainting, suicidal thoughts, eating-disorder behavior, severe injury, or other urgent symptoms, advise immediate professional or emergency help.
User health data: ${safeJson(uc)}${hydrationNote}
Recent chat history:
${history}
User question: "${question}"
Rules: max 120 words. Be conversational. Use plain text only. Do not use markdown, bold markers, asterisks, or code formatting. If you give steps, put each step on its own new line. Reference only metrics present in the user data. Give one specific actionable recommendation. If data is missing, suggest they log it.`
        temp = 0.55
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
        temp = 0.25
        schema = bmiRecommendationsSchema
        validator = validateBmiRecommendations
        break
      }

      case 'daily_insight': {
        const { userContext: uc2, readiness } = payload as { userContext: unknown; readiness: { score: number; pillars: unknown } }
        if (!readiness) return NextResponse.json({ error: 'readiness is required.' }, { status: 400 })
        prompt = `You are a VitalIQ health intelligence engine. ONLY generate insights about the user's health data.
User: ${safeJson(uc2)}, Readiness: ${readiness.score}/100, Pillar scores: ${safeJson(readiness.pillars)}
Use only data present in the input. Return ONLY valid JSON matching the configured schema.`
        maxTokens = 400
        temp = 0.25
        schema = dailyInsightSchema
        validator = validateDailyInsight
        break
      }

      case 'meal_swap': {
        const meal = sanitize(String(payload.meal ?? ''), 200)
        const goal = sanitize(String(payload.goal ?? 'maintain'), 50)
        const prefs = sanitize(String(payload.preferences ?? 'none'), 200)
        if (!meal) return NextResponse.json({ error: 'meal is required.' }, { status: 400 })
        prompt = `You are a nutrition AI for VitalIQ. ONLY answer about food and nutrition.
Suggest 2 healthier alternatives to: "${meal}". User goal: ${goal}. Preferences: ${prefs}.
Return ONLY valid JSON matching the configured schema.`
        maxTokens = 400
        temp = 0.25
        schema = mealSwapSchema
        validator = validateMealSwap
        break
      }
    }

    const raw = type === 'coach_chat'
      ? await callGemini(
          { contents: [{ parts: [{ text: prompt }] }] },
          key,
          { maxTokens, temp, thinkingBudget: getThinkingBudget(type) }
        )
      : ''

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
      if (!schema || !validator) {
        return NextResponse.json({ error: `No schema configured for request type: ${type}` }, { status: 500 })
      }

      const result = await generateValidatedJSON({
        label: type,
        key,
        contents: [{ parts: [{ text: prompt }] }],
        schema,
        validator,
        maxTokens,
        temp,
        thinkingBudget: getThinkingBudget(type),
        retryContents: (failedRaw, errors) => [
          {
            parts: [{ text: `${prompt}\n\n${buildRepairText(type, failedRaw, errors)}` }],
          },
        ],
      })

      return NextResponse.json({ result })
    } catch (error) {
      if (error instanceof Error && (error.message.includes('No Gemini model responded') || error.message.includes('GEMINI_API_KEY'))) {
        throw error
      }
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
