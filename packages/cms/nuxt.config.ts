import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// @my-cms/core — Nuxt Layer. Ships /admin pages, Cms* components, and the CMS
// server API. Its module (build-time brain) is registered below, so a host gets
// everything from a single `extends`.
// NB: resolve the module path from the LAYER dir, never a bare './module'
// (relative module paths in a layer resolve against the HOST root — the footgun).
const layerDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  modules: [join(layerDir, 'module')],
})
