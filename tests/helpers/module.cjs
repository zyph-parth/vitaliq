function mockModule(moduleId, exportsValue) {
  const resolved = require.resolve(moduleId)
  const previous = require.cache[resolved]

  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
    children: [],
    path: resolved,
    paths: [],
    parent: undefined,
    require,
  }

  return () => {
    if (previous) {
      require.cache[resolved] = previous
      return
    }

    delete require.cache[resolved]
  }
}

function loadFreshModule(moduleId) {
  const resolved = require.resolve(moduleId)
  delete require.cache[resolved]
  return require(moduleId)
}

module.exports = {
  mockModule,
  loadFreshModule,
}
