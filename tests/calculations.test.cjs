const assert = require('node:assert/strict')

const {
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  computeAllMetrics,
  computeMacroTargets,
} = require('../lib/calculations.ts')

async function run() {
  assert.equal(calculateBMI(70, 170), 24.2)

  const bmr = calculateBMR(80, 180, 30, 'male')
  assert.equal(bmr, 1854)
  assert.equal(calculateTDEE(bmr, 'moderate'), 2874)

  const metrics = computeAllMetrics(90, 180, 35, 'male', 'moderate', 'maintain')
  const expectedMacros = computeMacroTargets({
    weightKg: 90,
    bodyFatPct: metrics.estimatedBodyFat,
    sex: 'male',
    tdee: metrics.targetCalories,
  })

  assert.deepEqual(metrics.macroTargets, expectedMacros)
}

module.exports = { run }
