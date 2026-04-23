const assert = require('node:assert/strict')

const {
  getElapsedWorkoutSeconds,
  getWorkoutStartedAtIso,
  parseWorkoutRepsOrDuration,
  parseWorkoutWeightKg,
  recoverWorkoutTimerState,
} = require('../lib/workout-utils.ts')

async function run() {
  assert.deepEqual(parseWorkoutRepsOrDuration('3x10'), {
    reps: 10,
    durationSec: null,
    isAmrap: false,
  })

  assert.deepEqual(parseWorkoutRepsOrDuration('20s sprint / 40s walk'), {
    reps: null,
    durationSec: 60,
    isAmrap: false,
  })

  assert.deepEqual(parseWorkoutRepsOrDuration('2 min jog / 1 min walk'), {
    reps: null,
    durationSec: 180,
    isAmrap: false,
  })

  assert.equal(parseWorkoutWeightKg('70% 1RM'), null)
  assert.equal(parseWorkoutWeightKg('8-12kg'), null)
  assert.equal(parseWorkoutWeightKg('45 lbs'), 20.4)
  assert.equal(parseWorkoutWeightKg('24kg'), 24)

  assert.equal(getElapsedWorkoutSeconds(30, false, null, 10_000), 30)
  assert.equal(getElapsedWorkoutSeconds(0, true, 4_000, 65_000), 61)

  assert.deepEqual(
    recoverWorkoutTimerState(
      { timer: 90, timerRunning: true, timerStartedAtMs: 10_000 },
      100_000
    ),
    {
      timer: 90,
      timerRunning: true,
      timerStartedAtMs: 10_000,
    }
  )

  assert.deepEqual(
    recoverWorkoutTimerState(
      { timer: 120, timerRunning: true, savedAt: 100_000 },
      130_000
    ),
    {
      timer: 150,
      timerRunning: true,
      timerStartedAtMs: -20_000,
    }
  )

  assert.equal(
    getWorkoutStartedAtIso(120, 1_000_000),
    new Date(880_000).toISOString()
  )
}

module.exports = { run }
