const assert = require('node:assert/strict')

const { computeNextStreakState } = require('../lib/streak.ts')

async function run() {
  const today = new Date('2026-04-19T00:00:00.000Z')
  const yesterday = new Date('2026-04-18T00:00:00.000Z')

  const sameDay = computeNextStreakState(
    {
      currentDays: 5,
      bestDays: 8,
      lastLogDate: new Date('2026-04-19T09:30:00.000Z'),
    },
    today,
    yesterday
  )
  assert.deepEqual(sameDay, { shouldUpdate: false, newCurrent: 5, newBest: 8 })

  const consecutive = computeNextStreakState(
    {
      currentDays: 6,
      bestDays: 7,
      lastLogDate: new Date('2026-04-18T12:00:00.000Z'),
    },
    today,
    yesterday
  )
  assert.deepEqual(consecutive, { shouldUpdate: true, newCurrent: 7, newBest: 7 })

  const broken = computeNextStreakState(
    {
      currentDays: 12,
      bestDays: 12,
      lastLogDate: new Date('2026-04-15T12:00:00.000Z'),
    },
    today,
    yesterday
  )
  assert.deepEqual(broken, { shouldUpdate: true, newCurrent: 1, newBest: 12 })
}

module.exports = { run }
