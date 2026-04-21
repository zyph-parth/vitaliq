const assert = require('node:assert/strict')
const path = require('node:path')
const { loadFreshModule, mockModule } = require('./helpers/module.cjs')

const authModulePath = path.join(process.cwd(), 'lib', 'auth.ts')

async function run() {
  process.env.NEXTAUTH_SECRET = 'test-secret'
  process.env.GOOGLE_CLIENT_ID = 'google-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

  const restorePrisma = mockModule('@/lib/prisma', {
    prisma: {
      user: {
        findUnique: async ({ where }) => ({
          id: 'user-1',
          email: where.id ? 'fresh@example.com' : 'user@example.com',
          name: 'Test User',
          image: null,
          passwordHash: 'stored-hash',
          profileComplete: true,
        }),
        findFirst: async () => null,
        create: async ({ data }) => ({
          id: 'google-user-1',
          email: data.email,
          name: data.name,
          image: data.image,
          googleId: data.googleId,
          profileComplete: data.profileComplete,
        }),
        update: async ({ data }) => ({
          id: 'existing-google-user',
          email: 'linked@example.com',
          name: 'Linked User',
          image: data.image ?? null,
          googleId: data.googleId,
          profileComplete: true,
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
      profileComplete: true,
    })

    const invalidUser = await provider.options.authorize({
      email: 'user@example.com',
      password: 'wrong-password',
    })
    assert.equal(invalidUser, null)

    const googleAllowed = await authOptions.callbacks.signIn({
      account: { provider: 'google' },
      profile: { email: 'new@example.com', email_verified: true },
    })
    assert.equal(googleAllowed, true)

    const googleRejected = await authOptions.callbacks.signIn({
      account: { provider: 'google' },
      profile: { email: 'new@example.com', email_verified: false },
    })
    assert.equal(googleRejected, false)

    const googleToken = await authOptions.callbacks.jwt({
      token: {},
      user: { id: 'google-provider-id' },
      account: { provider: 'google' },
      profile: {
        sub: 'google-sub-1',
        email: 'New@Example.com',
        email_verified: true,
        name: 'New Google User',
        picture: 'https://example.com/avatar.png',
      },
    })

    assert.equal(googleToken.id, 'google-user-1')
    assert.equal(googleToken.email, 'new@example.com')
    assert.equal(googleToken.profileComplete, false)

    const session = await authOptions.callbacks.session({
      session: { user: {}, expires: new Date().toISOString() },
      token: googleToken,
    })
    assert.equal(session.user.id, 'google-user-1')
    assert.equal(session.user.profileComplete, false)
  } finally {
    restoreBcrypt()
    restorePrisma()
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
  }
}

module.exports = { run }
