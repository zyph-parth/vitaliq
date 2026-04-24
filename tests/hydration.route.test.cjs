const assert = require('node:assert/strict')
const path = require('node:path')
const { loadFreshModule, mockModule } = require('./helpers/module.cjs')

const hydrationRoutePath = path.join(process.cwd(), 'app', 'api', 'hydration', 'route.ts')

async function run() {
  const streakCalls = []
  let upsertInput = null

  const restoreNextAuth = mockModule('next-auth', {
    getServerSession: async () => ({ user: { id: 'user-1' } }),
  })
  const restoreAuth = mockModule('@/lib/auth', {
    authOptions: {},
  })
  const restorePrisma = mockModule('@/lib/prisma', {
    prisma: {
      hydrationLog: {
        findUnique: async () => ({ id: 'hydration-1', localDate: '2026-04-24', glasses: 4 }),
        upsert: async (input) => {
          upsertInput = input
          return {
            id: 'hydration-1',
            userId: input.create.userId,
            localDate: input.create.localDate,
            glasses: input.update.glasses,
          }
        },
      },
    },
  })
  const restoreStreak = mockModule('@/lib/streak', {
    updateStreak: async (userId, tz) => {
      streakCalls.push({ userId, tz })
    },
  })

  try {
    const { GET, PUT } = loadFreshModule(hydrationRoutePath)

    const getResponse = await GET({
      nextUrl: new URL('http://localhost/api/hydration?localDate=2026-04-24&tz=Asia/Kolkata'),
    })
    assert.equal(getResponse.status, 200)
    const getBody = await getResponse.json()
    assert.equal(getBody.glasses, 4)

    const putResponse = await PUT({
      nextUrl: new URL('http://localhost/api/hydration?tz=Asia/Kolkata'),
      json: async () => ({ localDate: '2026-04-24', glasses: 8 }),
    })
    assert.equal(putResponse.status, 200)
    assert.equal(upsertInput.where.userId_localDate.userId, 'user-1')
    assert.equal(upsertInput.where.userId_localDate.localDate, '2026-04-24')
    assert.equal(upsertInput.update.glasses, 8)
    assert.deepEqual(streakCalls, [{ userId: 'user-1', tz: 'Asia/Kolkata' }])
  } finally {
    restoreStreak()
    restorePrisma()
    restoreAuth()
    restoreNextAuth()
  }
}

module.exports = { run }
