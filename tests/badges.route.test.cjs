const assert = require('node:assert/strict')
const path = require('node:path')
const { loadFreshModule, mockModule } = require('./helpers/module.cjs')

const badgesRoutePath = path.join(process.cwd(), 'app', 'api', 'badges', 'route.ts')

async function run() {
  const restoreNextAuth = mockModule('next-auth', {
    getServerSession: async () => ({ user: { id: 'user-1' } }),
  })
  const restoreAuth = mockModule('@/lib/auth', {
    authOptions: {},
  })
  const restorePrisma = mockModule('@/lib/prisma', {
    prisma: {
      userBadge: {
        findMany: async () => [{ id: 'badge-1', userId: 'user-1', badgeId: 'streak_7' }],
      },
    },
  })

  try {
    const { GET, POST } = loadFreshModule(badgesRoutePath)

    const getResponse = await GET({})
    assert.equal(getResponse.status, 200)
    const getBody = await getResponse.json()
    assert.equal(getBody.badges[0].badgeId, 'streak_7')

    const postResponse = await POST()
    assert.equal(postResponse.status, 405)
    assert.equal(postResponse.headers.get('allow'), 'GET')
  } finally {
    restorePrisma()
    restoreAuth()
    restoreNextAuth()
  }
}

module.exports = { run }
