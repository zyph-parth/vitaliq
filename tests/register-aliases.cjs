const Module = require('node:module')
const path = require('node:path')

const projectRoot = process.cwd()
const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    request = path.join(projectRoot, request.slice(2))
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}
