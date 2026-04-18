const assert = require('node:assert/strict')

const { getDayBounds, getSafeTimeZone } = require('../lib/dates.ts')

async function run() {
  assert.equal(getSafeTimeZone('Mars/Phobos'), 'UTC')

  const reference = new Date('2026-04-19T20:00:00.000Z')
  const { today, tomorrow } = getDayBounds('Asia/Kolkata', reference)

  assert.equal(today.toISOString(), '2026-04-19T18:30:00.000Z')
  assert.equal(tomorrow.toISOString(), '2026-04-20T18:30:00.000Z')
}

module.exports = { run }
