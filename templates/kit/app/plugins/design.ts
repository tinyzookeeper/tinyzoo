// The design the site is drawn in, loaded before anything is drawn.
//
// A template's own build has one design. In the one app it is the site's content model, which
// the server knows (server/middleware/design.ts puts it on the request); the browser gets the
// same name in the page's payload, so both draw with the same design. It never comes from the
// request itself (no query, cookie or header).
//
// The page prefixes of the site's own types (server/middleware/design.ts) come the same way.
import { designs, oneApp } from '#tz-designs'
import { rememberDesign } from '../composables/useDesign'
import type { Design } from '../utils/design'

export default defineNuxtPlugin({
  name: 'tinyzoo:design',
  enforce: 'pre',
  async setup() {
    const id = oneApp
      ? useState<string>('tz:design', () => String(useRequestEvent()?.context.siteDesign ?? '')).value
      : Object.keys(designs)[0]!
    useState<{ prefix: string; type: string }[]>('tz:custom-pages', () => {
      const pages = import.meta.server ? useRequestEvent()?.context.siteCustomPages : null
      return Array.isArray(pages) ? pages : []
    })
    // No site (an address of the process itself): nothing to draw, and useDesign() says so if asked.
    if (!id) return { provide: { design: null as Design | null } }
    const load = designs[id]
    if (!load) throw createError({ statusCode: 500, statusMessage: `[tinyzoo] this build has no design "${id}"`, fatal: true })
    const design = await load()
    rememberDesign(design)
    return { provide: { design: design as Design | null } }
  },
})
