// The one app of the hosted templates: one build, every template's frontend in it. A site is
// drawn in the design its content model names (cms.config.ts lists the models, designs.ts the
// designs; the two lists are the same). The design folders stay where they are
// (templates/<id>): this app reads them, the template kit's module (templates/kit/module.ts)
// keeps each one's components, helpers and stylesheets its own.
//
// It runs in multi-tenant mode only: the app has no content model of its own. To work on one
// template: `pnpm dev photographer` (scripts/dev.mjs).
import { mergeFonts } from 'tinyzoo-template-kit/fonts'
import { DESIGNS } from './designs'

// TZ_DESIGNS=photographer,wedding: a build or a development server with only these designs.
const only = process.env.TZ_DESIGNS?.split(',').map((id) => id.trim()).filter(Boolean)
const ids = Object.keys(DESIGNS).filter((id) => !only || only.includes(id))
if (only?.some((id) => !(id in DESIGNS))) throw new Error(`TZ_DESIGNS names a design this app does not have: ${only.filter((id) => !(id in DESIGNS)).join(', ')} (it has: ${Object.keys(DESIGNS).join(', ')})`)

export default defineNuxtConfig({
  // (the kit first: what it sets, such as the admin's name, stands over tinyzoo's own defaults)
  extends: ['tinyzoo-template-kit/layer', 'tinyzoo/layer'],
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  templateKit: { designs: ids },
  build: { transpile: ['@tinyzoo/client', 'tinyzoo-template-kit'] },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  // A folder of its own for each design's type check (scripts/typecheck.mjs), so checks can run side by side.
  ...(process.env.TZ_BUILD_DIR ? { buildDir: process.env.TZ_BUILD_DIR } : {}),
  // A server built into a folder of its own (TZ_OUTPUT_DIR), so a check never builds over the `.output` a running server uses.
  ...(process.env.TZ_OUTPUT_DIR ? { nitro: { output: { dir: process.env.TZ_OUTPUT_DIR } } } : {}),
  // A server draws pages of several designs at once: Nuxt keeps each page's app across `await`, so
  // the templates' composables find the site's design there too (kit/app/composables/useDesign.ts).
  experimental: { asyncContext: true },
  // Every design's typefaces, downloaded from Google at build time and served by the site
  // itself. None is global: each family's @font-face rules go into the stylesheet of the look
  // that names it, so a visitor loads only the faces of the look the site shows.
  fonts: mergeFonts(ids.map((id) => DESIGNS[id as keyof typeof DESIGNS])),
  compatibilityDate: '2025-06-01',
})
