import { oneApp } from '#tz-designs'
import type { Design } from '../utils/design'

// The templates' composables ask for the site's words after an `await` (`await useSite()`, then
// `useSiteWords()`), where Nuxt no longer knows which app is running. A browser runs one app, and
// a template's own build has one design: there the design is kept here. A server of the one app
// draws pages of several designs at once; it has Nuxt keep the app across `await`
// (`experimental.asyncContext` in templates/app/nuxt.config.ts).
let only: Design | null = null

/** Keep the design for what runs outside Nuxt's context (app/plugins/design.ts). */
export function rememberDesign(design: Design | null): void {
  if (import.meta.client || !oneApp) only = design
}

/** The design of the site being drawn: its words, looks, blocks and look parts (app/plugins/design.ts). */
export function useDesign(): Design {
  const app = tryUseNuxtApp()
  const design = app ? (app.$design as Design | null | undefined) : only
  if (!design) throw createError({ statusCode: 500, statusMessage: '[tinyzoo] no design is known for this site', fatal: true })
  return design
}
