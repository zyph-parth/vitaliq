const assert = require('node:assert/strict')
const path = require('node:path')
const { loadFreshModule, mockModule } = require('./helpers/module.cjs')

const registerRoutePath = path.join(process.cwd(), 'app', 'api', 'auth', 'register', 'route.ts')

async function run() {
  process.env.NODE_ENV = 'test'

  const calls = []
  const tx = {
    user: {
      create: async () => {
        calls.push('user.create')
        return {
          id: 'user-1',
          name: 'Taylor',
          email: 'taylor@example.com',
          bmi: 24.2,
          bmr: 1600,
          tdee: 2400,
        }
      },
    },
    weightLog: {
      create: async () => {
        calls.push('weightLog.create')
        return { id: 'weight-1' }
      },
    },
  }

  const restorePrisma = mockModule('@/lib/prisma', {
    prisma: {
      user: {
        findUnique: async () => null,
      },
      $transaction: async (fn) => fn(tx),
    },
  })
  const restoreBcrypt = mockModule('bcryptjs', {
    hash: async () => 'hashed-password',
  })

  try {
    const { POST } = loadFreshModule(registerRoutePath)
    const response = await POST({
      ip: '127.0.0.1',
      headers: new Headers(),
      json: async () => ({
        name: 'Taylor',
        email: 'taylor@example.com',
        password: 'correcthorsebattery',
        age: '29',
        sex: 'male',
        heightCm: '178',
        weightKg: '77',
        activityLevel: 'moderate',
        goal: 'maintain',
      }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(calls, ['user.create', 'weightLog.create'])

    const body = await response.json()
    assert.equal(body.user.email, 'taylor@example.com')
    assert.equal(body.message, 'Account created successfully')
  } finally {
    restoreBcrypt()
    restorePrisma()
  }
}

module.exports = { run }
