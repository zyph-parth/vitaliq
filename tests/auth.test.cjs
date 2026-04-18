const assert = require('node:assert/strict')
const path = require('node:path')
const { loadFreshModule, mockModule } = require('./helpers/module.cjs')

const authModulePath = path.join(process.cwd(), 'lib', 'auth.ts')

async function run() {
  process.env.NEXTAUTH_SECRET = 'test-secret'

  const restorePrisma = mockModule('@/lib/prisma', {
    prisma: {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          passwordHash: 'stored-hash',
        }),
      },
    },
  })
  const restoreBcrypt = mockModule('bcryptjs', {
    compare: async (password) => password === 'correct-password',
  })

  try {
    const { authOptions } = loadFreshModule(authModulePath)
    const provider = authOptions.providers[0]

    const validUser = await provider.options.authorize({
      email: 'user@example.com',
      password: 'correct-password',
    })
    assert.deepEqual(validUser, {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    })

    const invalidUser = await provider.options.authorize({
      email: 'user@example.com',
      password: 'wrong-password',
    })
    assert.equal(invalidUser, null)
  } finally {
    restoreBcrypt()
    restorePrisma()
  }
}

module.exports = { run }
