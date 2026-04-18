// VitalIQ — Core calculation engine

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type Goal = 'lose' | 'muscle' | 'maintain' | 'longevity'

export interface MacroTargets {
  protein: number
  carbs: number
  fat: number
  fibre: number
}

export interface BodyMetrics {
  bmi: number
  bmiCategory: string
  bmiColor: string
  bmr: number
  tdee: number
  targetCalories: number
  macroTargets: MacroTargets
  estimatedBodyFat: number | null
  idealWeightMin: number
  idealWeightMax: number
  bmiPercentile: number  // 0-100 for the progress bar indicator
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
}

const GOAL_CALORIE_ADJUSTMENTS: Record<Goal, number> = {
  lose: -500,      // ~0.5kg/week deficit
  muscle: 250,     // lean bulk surplus
  maintain: 0,
  longevity: -100, // slight deficit for longevity
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return Number((weightKg / (heightM * heightM)).toFixed(1))
}

export function getBMICategory(bmi: number): { category: string; color: string; message: string } {
  if (bmi < 18.5) return {
    category: 'Underweight',
    color: '#DBEAFE',
    message: "Your BMI is on the lower side. We'll build a plan focused on healthy weight gain, nutrient density, and building strength — sustainably.",
  }
  if (bmi < 25) return {
    category: 'Healthy range',
    color: '#D8F3DC',
    message: "You're in a great spot! Your BMI is well within the healthy range. We'll focus on optimising performance and body composition.",
  }
  if (bmi < 30) return {
    category: 'Overweight',
    color: '#FEF3C7',
    message: "No worries — this is exactly why VitalIQ exists. A sustainable calorie deficit with smart training will get you there comfortably.",
  }
  return {
    category: 'Obese range',
    color: '#FEE2E2',
    message: "Thank you for trusting us. We'll take a gentle, evidence-based approach — sustainable habits over quick fixes, always.",
  }
}

// Mifflin-St Jeor equation (most accurate for general population)
export function calculateBMR(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  if (sex === 'male') {
    return Math.round(88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age))
  }
  return Math.round(447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age))
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel])
}

// Navy body fat % estimation (BMI-based). Note: can go negative at very low BMI/age
// — clamped to 0 to avoid nonsensical results.
export function estimateBodyFat(bmi: number, age: number, sex: Sex): number {
  const raw = sex === 'male'
    ? 1.20 * bmi + 0.23 * age - 16.2
    : 1.20 * bmi + 0.23 * age - 5.4
  return Number(Math.max(0, raw).toFixed(1))
}

export function calculateIdealWeight(heightCm: number, sex: Sex): { min: number; max: number } {
  // Hamwi formula range
  const heightInches = heightCm / 2.54
  const base = sex === 'male' ? 48 : 45.5
  const extra = (heightInches - 60) * (sex === 'male' ? 2.7 : 2.2)
  const ideal = base + extra
  return {
    min: Number((ideal * 0.9).toFixed(1)),
    max: Number((ideal * 1.1).toFixed(1)),
  }
}

export function computeAllMetrics(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
  activityLevel: ActivityLevel,
  goal: Goal
): BodyMetrics {
  const bmi = calculateBMI(weightKg, heightCm)
  const { category: bmiCategory, color: bmiColor } = getBMICategory(bmi)
  const bmr = calculateBMR(weightKg, heightCm, age, sex)
  const tdee = calculateTDEE(bmr, activityLevel)
  const targetCalories = Math.max(1200, tdee + GOAL_CALORIE_ADJUSTMENTS[goal])
  const { min: idealWeightMin, max: idealWeightMax } = calculateIdealWeight(heightCm, sex)
  const estimatedBodyFat = estimateBodyFat(bmi, age, sex)
  const macroTargets = computeMacroTargets({
    weightKg,
    bodyFatPct: estimatedBodyFat,
    sex,
    tdee: targetCalories,
  })

  // BMI bar indicator position (14-40 scale mapped to 0-100%)
  const bmiPercentile = Math.min(100, Math.max(0, ((bmi - 14) / 26) * 100))

  return {
    bmi,
    bmiCategory,
    bmiColor,
    bmr,
    tdee,
    targetCalories,
    macroTargets,
    estimatedBodyFat,
    idealWeightMin,
    idealWeightMax,
    bmiPercentile,
  }
}

// Readiness score algorithm (0-100)
export interface ReadinessInput {
  sleepHours?: number
  sleepQuality?: number  // 1-10
  hrv?: number
  restingHR?: number
  baselineHR?: number
  moodScore?: number     // 1-10
  lastWorkoutIntensity?: number  // 1-10
  daysSinceLastWorkout?: number
}

export function computeReadinessScore(input: ReadinessInput): {
  score: number
  label: string
  recommendation: string
  pillars: Record<string, number>
} {
  const {
    sleepHours = 7,
    sleepQuality = 7,
    hrv,
    moodScore = 7,
    lastWorkoutIntensity = 5,
    daysSinceLastWorkout = 1,
  } = input

  // Sleep component (0-35 points)
  const sleepScore = Math.min(35,
    (Math.min(sleepHours / 8, 1) * 20) +
    ((sleepQuality / 10) * 15)
  )

  // HRV component (0-25 points) — higher HRV = better recovery
  // When HRV is unknown we credit 17.5 / 25 (70%) — neutral assumption, neither penalises
  // users without wearables nor inflates their score unrealistically.
  const hrvScore = hrv ? Math.min(25, (hrv / 80) * 25) : 17.5

  // Recovery component (0-25 points) — based on last workout + days rest
  const recoveryScore = Math.min(25,
    (1 - (lastWorkoutIntensity / 10) * 0.5) * 15 +
    Math.min(daysSinceLastWorkout / 2, 1) * 10
  )

  // Mental component (0-15 points)
  const mentalScore = (moodScore / 10) * 15

  const total = Math.round(sleepScore + hrvScore + recoveryScore + mentalScore)

  let label: string, recommendation: string
  if (total >= 80) {
    label = 'Peak day'
    recommendation = 'Your body is primed. Go for a high-intensity session or attempt a PR today.'
  } else if (total >= 65) {
    label = 'Good to go'
    recommendation = 'Solid readiness. Moderate to high intensity training will serve you well.'
  } else if (total >= 50) {
    label = 'Moderate'
    recommendation = 'Train at moderate intensity. Prioritise form over load today.'
  } else if (total >= 35) {
    label = 'Low — recover'
    recommendation = 'Your body needs rest. Consider a walk, yoga, or light mobility work only.'
  } else {
    label = 'Rest day'
    recommendation = 'Skip the gym today. Focus on sleep, hydration, and nourishment.'
  }

  return {
    score: total,
    label,
    recommendation,
    pillars: {
      sleep: Math.round(sleepScore),
      hrv: Math.round(hrvScore),
      recovery: Math.round(recoveryScore),
      mental: Math.round(mentalScore),
    },
  }
}

export function getStreakMessage(days: number): string {
  if (days === 0) return 'Start your streak today!'
  if (days < 3) return `${days} day${days === 1 ? '' : 's'} in — great start!`
  if (days < 7) return `${days} days strong. You're building a habit.`
  if (days < 14) return `${days} days — this is becoming a lifestyle.`
  if (days < 30) return `${days} days. Impressive consistency!`
  return `${days} days. You're in elite territory. 🏆`
}

// Shared LBM-based macro target calculation — used by dashboard and meals routes
export function computeMacroTargets(user: {
  weightKg: number
  bodyFatPct: number | null
  sex: string
  tdee: number
}): MacroTargets {
  const bodyFatFraction = user.bodyFatPct != null
    ? user.bodyFatPct / 100
    : user.sex === 'male' ? 0.18 : 0.25
  const leanMassKg = user.weightKg * (1 - bodyFatFraction)
  const protein = Math.round(leanMassKg * 1.8)
  const fat = Math.round((user.tdee * 0.28) / 9)
  const carbs = Math.max(0, Math.round((user.tdee - protein * 4 - fat * 9) / 4))
  const fibre = user.sex === 'male' ? 38 : 25
  return { protein, fat, carbs, fibre }
}
