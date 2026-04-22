export type GeminiJsonSchema = Record<string, unknown>

export const MEAL_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
] as const

export type MealType = (typeof MEAL_TYPES)[number]

export const SESSION_TYPES = [
  'push',
  'pull',
  'legs',
  'full_body',
  'cardio',
  'hiit',
  'yoga',
  'rest',
] as const

export type SessionType = (typeof SESSION_TYPES)[number]

export interface MealItemEstimate {
  name: string
  portion: string
  calories: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}

export interface TextMealAnalysisResult {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  fibreG: number
  sugarG: number
  sodiumMg: number
  mealType: MealType
  ingredients: string[]
  aiInsight: string
  quality_score: number
  confidence: number
  assumptions: string[]
  items: MealItemEstimate[]
}

export interface PhotoMealAnalysisResult {
  foodName: string
  emoji: string
  totalCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  fibreG: number
  aiInsight: string
  mealType: MealType
  confidence: number
  assumptions: string[]
  items: MealItemEstimate[]
}

export interface WorkoutExerciseResult {
  name: string
  sets: number
  repsOrDuration: string
  restSec: number
  weight: string
  tip: string
}

export interface WorkoutGenerationResult {
  title: string
  sessionType: SessionType
  durationMins: number
  estimatedCalories: number
  coachNote: string
  exercises: WorkoutExerciseResult[]
}

export interface DailyInsightResult {
  headline: string
  body: string
  actionable: string
  pillarsUsed: string[]
}

export interface MealSwapResult {
  swaps: Array<{
    name: string
    reason: string
    calories: number
    proteinG: number
  }>
}

export type ValidationResult<T> =
  | { ok: true; value: T; errors: [] }
  | { ok: false; errors: string[]; value?: T }

const macroRange = { minimum: 0, maximum: 300 }
const calorieRange = { minimum: 0, maximum: 5000 }

const mealItemSchema: GeminiJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Food item name.' },
    portion: { type: 'string', description: 'Estimated portion size with units.' },
    calories: { type: 'integer', minimum: 0, maximum: 2500 },
    proteinG: { type: 'number', ...macroRange },
    carbsG: { type: 'number', ...macroRange },
    fatG: { type: 'number', ...macroRange },
  },
  required: ['name', 'portion', 'calories'],
  additionalProperties: false,
}

export const mealAnalysisSchema: GeminiJsonSchema = {
  type: 'object',
  properties: {
    calories: { type: 'integer', ...calorieRange },
    proteinG: { type: 'number', ...macroRange },
    carbsG: { type: 'number', ...macroRange },
    fatG: { type: 'number', ...macroRange },
    fibreG: { type: 'number', minimum: 0, maximum: 100 },
    sugarG: { type: 'number', minimum: 0, maximum: 250 },
    sodiumMg: { type: 'number', minimum: 0, maximum: 10000 },
    mealType: { type: 'string', enum: [...MEAL_TYPES] },
    ingredients: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 12,
    },
    aiInsight: {
      type: 'string',
      description: 'One concise nutrition insight relevant to the user goal.',
    },
    quality_score: { type: 'integer', minimum: 1, maximum: 10 },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence in the estimate where 1 is high confidence.',
    },
    assumptions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    items: {
      type: 'array',
      items: mealItemSchema,
      maxItems: 12,
    },
  },
  required: [
    'calories',
    'proteinG',
    'carbsG',
    'fatG',
    'fibreG',
    'sugarG',
    'sodiumMg',
    'mealType',
    'ingredients',
    'aiInsight',
    'quality_score',
    'confidence',
    'assumptions',
    'items',
  ],
  additionalProperties: false,
}

export const photoMealAnalysisSchema: GeminiJsonSchema = {
  type: 'object',
  properties: {
    foodName: { type: 'string', description: 'Short meal name.' },
    emoji: { type: 'string', description: 'One food-related emoji or short text fallback.' },
    totalCalories: { type: 'integer', ...calorieRange },
    proteinG: { type: 'number', ...macroRange },
    carbsG: { type: 'number', ...macroRange },
    fatG: { type: 'number', ...macroRange },
    fibreG: { type: 'number', minimum: 0, maximum: 100 },
    aiInsight: { type: 'string' },
    mealType: { type: 'string', enum: [...MEAL_TYPES] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    assumptions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    items: {
      type: 'array',
      items: mealItemSchema,
      minItems: 1,
      maxItems: 12,
    },
  },
  required: [
    'foodName',
    'emoji',
    'totalCalories',
    'proteinG',
    'carbsG',
    'fatG',
    'fibreG',
    'aiInsight',
    'mealType',
    'confidence',
    'assumptions',
    'items',
  ],
  additionalProperties: false,
}

export const workoutGenerationSchema: GeminiJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    sessionType: { type: 'string', enum: [...SESSION_TYPES] },
    durationMins: { type: 'integer', minimum: 10, maximum: 90 },
    estimatedCalories: { type: 'integer', minimum: 30, maximum: 1000 },
    coachNote: { type: 'string', description: 'Max 30 words.' },
    exercises: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          sets: { type: 'integer', minimum: 1, maximum: 6 },
          repsOrDuration: { type: 'string' },
          restSec: { type: 'integer', minimum: 0, maximum: 240 },
          weight: { type: 'string' },
          tip: { type: 'string', description: 'Max 15 words.' },
        },
        required: ['name', 'sets', 'repsOrDuration', 'restSec', 'weight', 'tip'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'sessionType', 'durationMins', 'estimatedCalories', 'coachNote', 'exercises'],
  additionalProperties: false,
}

export const bmiRecommendationsSchema: GeminiJsonSchema = {
  type: 'array',
  items: { type: 'string' },
  minItems: 4,
  maxItems: 4,
}

export const dailyInsightSchema: GeminiJsonSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'Max 12 words.' },
    body: { type: 'string', description: '2-3 sentences referencing actual data.' },
    actionable: { type: 'string', description: 'One specific thing to do today.' },
    pillarsUsed: {
      type: 'array',
      items: { type: 'string', enum: ['sleep', 'nutrition', 'training', 'mental', 'longevity', 'recovery', 'hrv'] },
      minItems: 1,
      maxItems: 4,
    },
  },
  required: ['headline', 'body', 'actionable', 'pillarsUsed'],
  additionalProperties: false,
}

export const mealSwapSchema: GeminiJsonSchema = {
  type: 'object',
  properties: {
    swaps: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          reason: { type: 'string', description: 'Max 15 words.' },
          calories: { type: 'integer', minimum: 0, maximum: 2500 },
          proteinG: { type: 'number', minimum: 0, maximum: 250 },
        },
        required: ['name', 'reason', 'calories', 'proteinG'],
        additionalProperties: false,
      },
    },
  },
  required: ['swaps'],
  additionalProperties: false,
}

export function parseModelJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const objectStart = cleaned.indexOf('{')
    const arrayStart = cleaned.indexOf('[')
    const starts = [objectStart, arrayStart].filter((index) => index >= 0)

    if (starts.length === 0) throw new Error('Response did not contain JSON.')

    const start = Math.min(...starts)
    const end = cleaned.lastIndexOf(cleaned[start] === '[' ? ']' : '}')

    if (end <= start) throw new Error('Response JSON was incomplete.')

    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

export function validateTextMealAnalysis(value: unknown): ValidationResult<TextMealAnalysisResult> {
  if (!isRecord(value)) return fail('Meal analysis must be an object.')

  const errors: string[] = []
  const calories = readNumber(value, 'calories', errors, { min: 0, max: 5000, integer: true })
  const proteinG = readNumber(value, 'proteinG', errors, { min: 0, max: 300 })
  const carbsG = readNumber(value, 'carbsG', errors, { min: 0, max: 300 })
  const fatG = readNumber(value, 'fatG', errors, { min: 0, max: 300 })
  const fibreG = readNumber(value, 'fibreG', errors, { min: 0, max: 100 })
  const sugarG = readNumber(value, 'sugarG', errors, { min: 0, max: 250, required: false })
  const sodiumMg = readNumber(value, 'sodiumMg', errors, { min: 0, max: 10000, required: false })
  const mealType = readEnum(value.mealType, MEAL_TYPES, 'snack')
  const aiInsight = readText(value.aiInsight, 240)
  const result: TextMealAnalysisResult = {
    calories,
    proteinG,
    carbsG,
    fatG,
    fibreG,
    sugarG,
    sodiumMg,
    mealType,
    ingredients: readStringArray(value.ingredients, 12, 60),
    aiInsight,
    quality_score: readNumber(value, 'quality_score', errors, {
      min: 1,
      max: 10,
      integer: true,
      required: false,
      fallback: 5,
    }),
    confidence: readNumber(value, 'confidence', errors, {
      min: 0,
      max: 1,
      required: false,
      fallback: 0.65,
    }),
    assumptions: readStringArray(value.assumptions, 4, 140),
    items: readMealItems(value.items),
  }

  if (!MEAL_TYPES.includes(String(value.mealType) as MealType)) {
    errors.push('mealType must be a supported meal type.')
  }
  if (!aiInsight) errors.push('aiInsight is required.')
  if (result.ingredients.length === 0) errors.push('ingredients must include at least one item.')
  addMacroPlausibilityErrors(errors, calories, proteinG, carbsG, fatG)

  return errors.length ? { ok: false, errors, value: result } : { ok: true, value: result, errors: [] }
}

export function validatePhotoMealAnalysis(value: unknown): ValidationResult<PhotoMealAnalysisResult> {
  if (!isRecord(value)) return fail('Photo meal analysis must be an object.')

  const errors: string[] = []
  const totalCalories = readNumber(value, 'totalCalories', errors, { min: 0, max: 5000, integer: true })
  const proteinG = readNumber(value, 'proteinG', errors, { min: 0, max: 300 })
  const carbsG = readNumber(value, 'carbsG', errors, { min: 0, max: 300 })
  const fatG = readNumber(value, 'fatG', errors, { min: 0, max: 300 })
  const fibreG = readNumber(value, 'fibreG', errors, { min: 0, max: 100 })
  const foodName = readText(value.foodName, 120)
  const aiInsight = readText(value.aiInsight, 240)
  const mealType = readEnum(value.mealType, MEAL_TYPES, 'snack')
  const result: PhotoMealAnalysisResult = {
    foodName,
    emoji: readText(value.emoji, 8) || 'ME',
    totalCalories,
    proteinG,
    carbsG,
    fatG,
    fibreG,
    aiInsight,
    mealType,
    confidence: readNumber(value, 'confidence', errors, {
      min: 0,
      max: 1,
      required: false,
      fallback: 0.5,
    }),
    assumptions: readStringArray(value.assumptions, 4, 140),
    items: readMealItems(value.items),
  }

  if (!foodName) errors.push('foodName is required.')
  if (!aiInsight) errors.push('aiInsight is required.')
  if (!MEAL_TYPES.includes(String(value.mealType) as MealType)) {
    errors.push('mealType must be a supported meal type.')
  }
  if (result.items.length === 0) errors.push('items must include at least one detected food.')
  addMacroPlausibilityErrors(errors, totalCalories, proteinG, carbsG, fatG)

  return errors.length ? { ok: false, errors, value: result } : { ok: true, value: result, errors: [] }
}

export function validateWorkoutGeneration(
  value: unknown,
  options: { bodyweightOnly?: boolean; readinessScore?: number } = {}
): ValidationResult<WorkoutGenerationResult> {
  if (!isRecord(value)) return fail('Workout must be an object.')

  const errors: string[] = []
  const sessionType = readEnum(value.sessionType, SESSION_TYPES, 'full_body')
  const durationMins = readNumber(value, 'durationMins', errors, { min: 10, max: 90, integer: true })
  const estimatedCalories = readNumber(value, 'estimatedCalories', errors, { min: 30, max: 1000, integer: true })
  const rawExercises = Array.isArray(value.exercises) ? value.exercises.slice(0, 8) : []
  const exercises = rawExercises.map((exercise, index) =>
    readWorkoutExercise(exercise, index, errors, Boolean(options.bodyweightOnly))
  )

  const result: WorkoutGenerationResult = {
    title: readText(value.title, 120) || 'Personalized Workout',
    sessionType,
    durationMins,
    estimatedCalories,
    coachNote: trimWords(readText(value.coachNote, 220) || 'Move with control and stop if pain shows up.', 30),
    exercises,
  }

  if (!Array.isArray(value.exercises)) errors.push('exercises must be an array.')
  if (!SESSION_TYPES.includes(String(value.sessionType) as SessionType)) {
    errors.push('sessionType must be a supported session type.')
  }
  if (rawExercises.length < 3) errors.push('workout must include at least 3 exercises.')
  if (options.readinessScore != null && options.readinessScore < 50) {
    if (sessionType === 'hiit') errors.push('low readiness should not generate a HIIT session.')
    if (durationMins > 45) errors.push('low readiness session should stay at or below 45 minutes.')
  }

  return errors.length ? { ok: false, errors, value: result } : { ok: true, value: result, errors: [] }
}

export function validateBmiRecommendations(value: unknown): ValidationResult<string[]> {
  if (!Array.isArray(value)) return fail('BMI recommendations must be an array.')

  const recommendations = value.map((item) => readText(item, 160)).filter(Boolean).slice(0, 4)
  const errors: string[] = []
  if (recommendations.length !== 4) errors.push('BMI recommendations must include exactly 4 strings.')

  return errors.length ? { ok: false, errors, value: recommendations } : { ok: true, value: recommendations, errors: [] }
}

export function validateDailyInsight(value: unknown): ValidationResult<DailyInsightResult> {
  if (!isRecord(value)) return fail('Daily insight must be an object.')

  const errors: string[] = []
  const result: DailyInsightResult = {
    headline: trimWords(readText(value.headline, 100), 12),
    body: readText(value.body, 500),
    actionable: readText(value.actionable, 220),
    pillarsUsed: readStringArray(value.pillarsUsed, 4, 32),
  }

  if (!result.headline) errors.push('headline is required.')
  if (!result.body) errors.push('body is required.')
  if (!result.actionable) errors.push('actionable is required.')
  if (result.pillarsUsed.length === 0) errors.push('pillarsUsed must include at least one pillar.')

  return errors.length ? { ok: false, errors, value: result } : { ok: true, value: result, errors: [] }
}

export function validateMealSwap(value: unknown): ValidationResult<MealSwapResult> {
  if (!isRecord(value)) return fail('Meal swap result must be an object.')

  const errors: string[] = []
  const swaps = Array.isArray(value.swaps)
    ? value.swaps.slice(0, 2).map((swap, index) => readMealSwap(swap, index, errors))
    : []

  const result: MealSwapResult = { swaps }
  if (!Array.isArray(value.swaps)) errors.push('swaps must be an array.')
  if (swaps.length !== 2) errors.push('swaps must include exactly 2 alternatives.')

  return errors.length ? { ok: false, errors, value: result } : { ok: true, value: result, errors: [] }
}

export function validationSummary(errors: string[]): string {
  return errors.slice(0, 6).join('; ')
}

function fail<T>(message: string): ValidationResult<T> {
  return { ok: false, errors: [message] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readNumber(
  source: Record<string, unknown>,
  key: string,
  errors: string[],
  options: { min: number; max: number; integer?: boolean; required?: boolean; fallback?: number }
): number {
  const required = options.required ?? true
  const fallback = options.fallback ?? 0
  const raw = source[key]
  const parsed = Number(raw)

  if (!Number.isFinite(parsed)) {
    if (required) errors.push(`${key} must be a finite number.`)
    return fallback
  }

  if (parsed < options.min || parsed > options.max) {
    errors.push(`${key} must be between ${options.min} and ${options.max}.`)
  }

  const clamped = Math.min(options.max, Math.max(options.min, parsed))
  return options.integer ? Math.round(clamped) : Number(clamped.toFixed(1))
}

function readText(value: unknown, maxLength: number): string {
  if (value == null) return ''
  return String(value)
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => readText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function readEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(String(value) as T[number]) ? (String(value) as T[number]) : fallback
}

function readMealItems(value: unknown): MealItemEstimate[] {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, 12)
    .map((item) => {
      if (!isRecord(item)) return null
      const name = readText(item.name, 80)
      if (!name) return null

      const calories = Number(item.calories)
      const proteinG = optionalPositiveNumber(item.proteinG, 300)
      const carbsG = optionalPositiveNumber(item.carbsG, 300)
      const fatG = optionalPositiveNumber(item.fatG, 300)

      return {
        name,
        portion: readText(item.portion, 80) || 'estimated portion',
        calories: Number.isFinite(calories) ? Math.max(0, Math.min(2500, Math.round(calories))) : 0,
        ...(proteinG != null ? { proteinG } : {}),
        ...(carbsG != null ? { carbsG } : {}),
        ...(fatG != null ? { fatG } : {}),
      }
    })
    .filter((item): item is MealItemEstimate => Boolean(item))
}

function readWorkoutExercise(
  value: unknown,
  index: number,
  errors: string[],
  bodyweightOnly: boolean
): WorkoutExerciseResult {
  if (!isRecord(value)) {
    errors.push(`exercise ${index + 1} must be an object.`)
    return {
      name: `Exercise ${index + 1}`,
      sets: 3,
      repsOrDuration: '10 reps',
      restSec: 60,
      weight: bodyweightOnly ? 'bodyweight' : 'moderate',
      tip: 'Move with control.',
    }
  }

  const name = readText(value.name, 100)
  const sets = readNumber(value, 'sets', errors, { min: 1, max: 6, integer: true, fallback: 3 })
  const restSec = readNumber(value, 'restSec', errors, {
    min: 0,
    max: 240,
    integer: true,
    required: false,
    fallback: 60,
  })
  const repsOrDuration = readText(value.repsOrDuration, 80) || '10 reps'
  const weight = bodyweightOnly ? 'bodyweight' : readText(value.weight, 80) || 'moderate'
  const tip = trimWords(readText(value.tip, 140) || 'Use controlled form.', 15)

  if (!name) errors.push(`exercise ${index + 1} name is required.`)
  if (bodyweightOnly && containsEquipmentTerm(name)) {
    errors.push(`exercise ${index + 1} uses equipment despite bodyweight-only constraints.`)
  }
  if (/best effort|max effort|1rm|pr\b/i.test(repsOrDuration)) {
    errors.push(`exercise ${index + 1} uses unsafe max-effort wording.`)
  }

  return {
    name: name || `Exercise ${index + 1}`,
    sets,
    repsOrDuration,
    restSec,
    weight,
    tip,
  }
}

function readMealSwap(value: unknown, index: number, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`swap ${index + 1} must be an object.`)
    return { name: `Alternative ${index + 1}`, reason: 'Better macro balance.', calories: 0, proteinG: 0 }
  }

  const localErrors: string[] = []
  const result = {
    name: readText(value.name, 100),
    reason: trimWords(readText(value.reason, 140), 15),
    calories: readNumber(value, 'calories', localErrors, { min: 0, max: 2500, integer: true }),
    proteinG: readNumber(value, 'proteinG', localErrors, { min: 0, max: 250 }),
  }

  if (!result.name) localErrors.push(`swap ${index + 1} name is required.`)
  if (!result.reason) localErrors.push(`swap ${index + 1} reason is required.`)
  errors.push(...localErrors)

  return result
}

function addMacroPlausibilityErrors(
  errors: string[],
  calories: number,
  proteinG: number,
  carbsG: number,
  fatG: number
) {
  const macroCalories = proteinG * 4 + carbsG * 4 + fatG * 9

  if (calories >= 100 && macroCalories > calories * 1.8 + 120) {
    errors.push('macro calories are implausibly high for total calories.')
  }
}

function optionalPositiveNumber(value: unknown, max: number): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Number(Math.max(0, Math.min(max, parsed)).toFixed(1))
}

function containsEquipmentTerm(value: string): boolean {
  return /\b(barbell|bench press|cable|machine|leg press|dumbbell|kettlebell|lat pulldown|smith machine)\b/i.test(value)
}

function trimWords(value: string, maxWords: number): string {
  return value.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ')
}
