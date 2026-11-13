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
  // Register the layer's components as GLOBAL so the field/cell registry can
  // resolve them by name at runtime (resolveComponent only finds globals; plain
  // auto-imports are compile-time only). pathPrefix:false keeps flat names.
  components: [
    { path: join(layerDir, 'app/components'), pathPrefix: false, global: true },
  ],
  // Admin design tokens, scoped to html[data-cms-admin] so the host site's own
  // theme is untouched (see app/assets/css/cms-admin.css).
  css: [join(layerDir, 'app/assets/css/cms-admin.css')],
  // The admin's typefaces, through @nuxt/fonts (bundled with Nuxt UI): downloaded at
  // build time and served from the app itself — no requests to Google at runtime.
  // The admin's tokens reference them through CSS variables, which @nuxt/fonts
  // cannot see, so they are declared here and registered globally.
  fonts: {
    families: [
      { name: 'Geist', provider: 'google', weights: [400, 500, 600], global: true },
      { name: 'Geist Mono', provider: 'google', weights: [400, 500], global: true },
    ],
  },
})
