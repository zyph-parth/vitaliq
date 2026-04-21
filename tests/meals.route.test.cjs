const assert = require('node:assert/strict')
const path = require('node:path')
const { loadFreshModule, mockModule } = require('./helpers/module.cjs')

const mealsRoutePath = path.join(process.cwd(), 'app', 'api', 'meals', 'route.ts')

async function run() {
  const streakCalls = []

  const restoreNextAuth = mockModule('next-auth', {
    getServerSession: async () => ({ user: { id: 'user-1' } }),
  })
  const restoreAuth = mockModule('@/lib/auth', {
    authOptions: {},
  })
  const restorePrisma = mockModule('@/lib/prisma', {
    prisma: {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          age: 29,
          weightKg: 77,
          heightCm: 178,
          bodyFatPct: 18,
          sex: 'male',
          activityLevel: 'moderate',
          goal: 'maintain',
          bmi: 24.3,
          bmr: 1700,
          tdee: 2400,
        }),
      },
      mealLog: {
        create: async (input) => ({
          id: 'meal-1',
          ...input.data,
        }),
      },
    },
  })
  const restoreStreak = mockModule('@/lib/streak', {
    updateStreak: async (userId, tz) => {
      streakCalls.push({ userId, tz })
    },
  })

  try {
    const { POST } = loadFreshModule(mealsRoutePath)
    const response = await POST({
      nextUrl: new URL('http://localhost/api/meals?tz=Asia/Kolkata'),
      json: async () => ({
        description: 'Chicken rice bowl',
        calories: 650,
        proteinG: 42,
        carbsG: 70,
        fatG: 18,
        fibreG: 6,
        mealType: 'lunch',
      }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(streakCalls, [{ userId: 'user-1', tz: 'Asia/Kolkata' }])

    const body = await response.json()
    assert.equal(body.meal.description, 'Chicken rice bowl')
    assert.equal(body.meal.mealType, 'lunch')
  } finally {
    restoreStreak()
    restorePrisma()
    restoreAuth()
    restoreNextAuth()
  }
}

module.exports = { run }
