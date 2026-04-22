const assert = require('node:assert/strict')

const {
  parseModelJson,
  validateTextMealAnalysis,
  validateWorkoutGeneration,
  validateMealSwap,
} = require('../lib/llm-validation.ts')

async function run() {
  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true })

  const meal = validateTextMealAnalysis({
    calories: 520,
    proteinG: 38,
    carbsG: 48,
    fatG: 18,
    fibreG: 8,
    sugarG: 7,
    sodiumMg: 650,
    mealType: 'lunch',
    ingredients: ['chicken', 'rice', 'vegetables'],
    aiInsight: 'Strong protein with a reasonable carb base.',
    quality_score: 8,
    confidence: 0.78,
    assumptions: ['standard bowl serving'],
    items: [{ name: 'chicken rice bowl', portion: '1 bowl', calories: 520 }],
  })
  assert.equal(meal.ok, true)
  assert.equal(meal.ok && meal.value.mealType, 'lunch')

  const implausibleMeal = validateTextMealAnalysis({
    calories: 100,
    proteinG: 80,
    carbsG: 80,
    fatG: 40,
    fibreG: 2,
    sugarG: 1,
    sodiumMg: 10,
    mealType: 'snack',
    ingredients: ['unknown'],
    aiInsight: 'Bad estimate.',
    quality_score: 3,
    confidence: 0.3,
    assumptions: [],
    items: [{ name: 'unknown', portion: '1 plate', calories: 100 }],
  })
  assert.equal(implausibleMeal.ok, false)
  assert.match(implausibleMeal.errors.join(' '), /macro calories/)

  const bodyweightWorkout = validateWorkoutGeneration(
    {
      title: 'Home Session',
      sessionType: 'full_body',
      durationMins: 35,
      estimatedCalories: 250,
      coachNote: 'Move steadily.',
      exercises: [
        { name: 'Push-ups', sets: 3, repsOrDuration: '10 reps', restSec: 60, weight: 'bodyweight', tip: 'Brace.' },
        { name: 'Bench Press', sets: 3, repsOrDuration: '8 reps', restSec: 90, weight: 'bodyweight', tip: 'Control.' },
        { name: 'Squats', sets: 3, repsOrDuration: '12 reps', restSec: 60, weight: 'bodyweight', tip: 'Stand tall.' },
      ],
    },
    { bodyweightOnly: true, readinessScore: 70 }
  )
  assert.equal(bodyweightWorkout.ok, false)
  assert.match(bodyweightWorkout.errors.join(' '), /equipment/)

  const swaps = validateMealSwap({
    swaps: [
      { name: 'Greek yogurt bowl', reason: 'Higher protein.', calories: 280, proteinG: 25 },
      { name: 'Paneer salad', reason: 'More filling.', calories: 360, proteinG: 28 },
    ],
  })
  assert.equal(swaps.ok, true)
}

module.exports = { run }
