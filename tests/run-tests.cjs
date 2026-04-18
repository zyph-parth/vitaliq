const fs = require('node:fs')
const path = require('node:path')

require(path.join(__dirname, 'register-aliases.cjs'))
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'commonjs',
  moduleResolution: 'node',
  esModuleInterop: true,
})
require('ts-node/register/transpile-only')

function collectTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.test.cjs')) {
      files.push(fullPath)
    }
  }

  return files
}

const testsDir = path.join(process.cwd(), 'tests')
const testFiles = collectTestFiles(testsDir)

if (testFiles.length === 0) {
  console.error('No test files found under tests/.')
  process.exit(1)
}

let failures = 0

;(async () => {
  for (const file of testFiles) {
    try {
      delete require.cache[require.resolve(file)]
      const mod = require(file)
      if (typeof mod.run !== 'function') {
        throw new Error(`Test file does not export run(): ${path.relative(process.cwd(), file)}`)
      }

      await mod.run()
      console.log(`✓ ${path.relative(process.cwd(), file)}`)
    } catch (error) {
      failures += 1
      console.error(`✖ ${path.relative(process.cwd(), file)}`)
      console.error(error)
    }
  }

  process.exit(failures === 0 ? 0 : 1)
})()
