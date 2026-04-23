const assert = require('node:assert/strict')
const path = require('node:path')
const { loadFreshModule, mockModule } = require('./helpers/module.cjs')

const workoutsRoutePath = path.join(process.cwd(), 'app', 'api', 'workouts', 'route.ts')

async function run() {
  const streakCalls = []
  let createdData = null

  const restoreNextAuth = mockModule('next-auth', {
    getServerSession: async () => ({ user: { id: 'user-1' } }),
  })
  const restoreAuth = mockModule('@/lib/auth', {
    authOptions: {},
  })
  const restorePrisma = mockModule('@/lib/prisma', {
    prisma: {
      workoutSession: {
        findMany: async () => [],
        create: async ({ data }) => {
          createdData = data

          return {
            id: 'session-1',
            ...data,
            exercises: data.exercises.create.map((exercise, exerciseIndex) => ({
              id: `exercise-${exerciseIndex + 1}`,
              ...exercise,
              sets: exercise.sets.create.map((set, setIndex) => ({
                id: `set-${exerciseIndex + 1}-${setIndex + 1}`,
                ...set,
              })),
            })),
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
    const { POST } = loadFreshModule(workoutsRoutePath)

    const beforeSave = Date.now()
    const response = await POST({
      nextUrl: new URL('http://localhost/api/workouts?tz=Asia/Kolkata'),
      json: async () => ({
        title: ' Evening Session ',
        sessionType: 'not_real',
        durationMins: 999,
        estimatedCalories: 9999,
        aiGenerated: false,
        startedAt: new Date(beforeSave - 52 * 60 * 1000).toISOString(),
        exercises: [
          {
            name: 'Bench Press',
            sets: 3,
            repsOrDuration: '3x10',
            weight: '70% 1RM',
            completedSets: [true, false, true],
          },
          {
            name: 'Sprint Intervals',
            sets: 2,
            repsOrDuration: '20s sprint / 40s walk',
            weight: 'bodyweight',
            completedSets: [true, true],
          },
        ],
      }),
    })
    const afterSave = Date.now()

    assert.equal(response.status, 201)
    assert.equal(createdData.title, 'Evening Session')
    assert.equal(createdData.sessionType, 'full_body')
    assert.equal(createdData.caloriesBurned, 2000)
    assert.equal(createdData.aiGenerated, false)
    assert.ok(createdData.completedAt instanceof Date)
    assert.ok(createdData.startedAt instanceof Date)
    assert.ok(createdData.completedAt.getTime() >= beforeSave)
    assert.ok(createdData.completedAt.getTime() <= afterSave)
    assert.ok(createdData.durationMins >= 51 && createdData.durationMins <= 53)

    assert.equal(createdData.exercises.create[0].sets.create[0].reps, 10)
    assert.equal(createdData.exercises.create[0].sets.create[0].weightKg, null)
    assert.equal(createdData.exercises.create[1].sets.create[0].durationSec, 60)
    assert.deepEqual(streakCalls, [{ userId: 'user-1', tz: 'Asia/Kolkata' }])

    const body = await response.json()
    assert.equal(body.session.title, 'Evening Session')
    assert.equal(body.session.exercises[0].sets[0].reps, 10)

    const rejectedResponse = await POST({
      nextUrl: new URL('http://localhost/api/workouts?tz=UTC'),
      json: async () => ({
        title: 'No Progress',
        exercises: [
          {
            name: 'Push-ups',
            sets: 2,
            repsOrDuration: '10 reps',
            completedSets: [false, false],
          },
        ],
      }),
    })

    assert.equal(rejectedResponse.status, 400)
    assert.deepEqual(streakCalls, [{ userId: 'user-1', tz: 'Asia/Kolkata' }])
  } finally {
    restoreStreak()
    restorePrisma()
    restoreAuth()
    restoreNextAuth()
  }
}

module.exports = { run }
