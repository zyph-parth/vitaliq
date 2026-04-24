const assert = require('node:assert/strict')
const path = require('node:path')
const { loadFreshModule, mockModule } = require('./helpers/module.cjs')

const userRoutePath = path.join(process.cwd(), 'app', 'api', 'user', 'route.ts')
const exportRoutePath = path.join(process.cwd(), 'app', 'api', 'user', 'export', 'route.ts')

async function run() {
  const deletedIds = []

  const restoreNextAuth = mockModule('next-auth', {
    getServerSession: async () => ({ user: { id: 'user-1' } }),
  })
  const restoreAuth = mockModule('@/lib/auth', {
    authOptions: {},
  })
  const restorePrisma = mockModule('@/lib/prisma', {
    prisma: {
      user: {
        findUnique: async ({ where, select }) => {
          if (!where?.id) return null

          if (select?.weightLogs) {
            return {
              id: 'user-1',
              email: 'user@example.com',
              name: 'Test User',
              image: null,
              profileComplete: true,
              createdAt: new Date('2026-04-24T00:00:00.000Z'),
              updatedAt: new Date('2026-04-24T00:00:00.000Z'),
              age: 30,
              sex: 'male',
              heightCm: 178,
              weightKg: 77,
              activityLevel: 'moderate',
              goal: 'maintain',
              bmi: 24.3,
              bmr: 1700,
              tdee: 2400,
              bodyFatPct: 18,
              weightLogs: [{ id: 'weight-1', userId: 'user-1', weightKg: 77 }],
              mealLogs: [],
              workoutSessions: [],
              sleepLogs: [],
              moodLogs: [],
              hydrationLogs: [],
              biomarkers: [],
              insights: [],
              badges: [],
              streak: { id: 'streak-1', userId: 'user-1', currentDays: 3, bestDays: 5 },
            }
          }

          return { id: where.id }
        },
        delete: async ({ where }) => {
          deletedIds.push(where.id)
          return { id: where.id }
        },
      },
    },
  })

  try {
    const { GET } = loadFreshModule(exportRoutePath)
    const exportResponse = await GET()
    assert.equal(exportResponse.status, 200)

    const exportBody = await exportResponse.json()
    assert.equal(exportBody.product, 'VitalIQ')
    assert.equal(exportBody.account.email, 'user@example.com')
    assert.equal(exportBody.account.passwordHash, undefined)
    assert.equal(exportBody.account.googleId, undefined)
    assert.equal(exportBody.data.weightLogs[0].weightKg, 77)

    const { DELETE } = loadFreshModule(userRoutePath)
    const deleteResponse = await DELETE()
    assert.equal(deleteResponse.status, 200)
    assert.deepEqual(deletedIds, ['user-1'])
  } finally {
    restorePrisma()
    restoreAuth()
    restoreNextAuth()
  }
}

module.exports = { run }
