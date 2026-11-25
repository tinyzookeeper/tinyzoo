// The design a site is drawn in is its content model: a Photographer site is drawn with
// Photographer's components. Put on the request for the app, which reads it while it draws the
// page on the server (app/plugins/design.ts), and for the handlers a design brings, which answer
// only on that design's sites (the kit's module wraps them). A template's own build has one
// design and needs nothing; only the one app runs in multi-tenant mode.
//
// Beside it, the page prefixes of the site's own types (`/kurzy/<slug>` → `x_course`), so the
// app knows without another request that such an address is an entry of one of them
// (useSitePage). Only for a page: a visible type with pages that the site's model holds; none
// with the feature off.
export default defineEventHandler(async (event) => {
  if (!cmsIsMultiTenant() || !event.context.cmsSite) return
  event.context.siteDesign = cmsSiteModel().name
  const path = event.path || ''
  if (path.startsWith('/api/') || path.startsWith('/_')) return
  event.context.siteCustomPages = await customPagesOfSite()
})

async function customPagesOfSite(): Promise<{ prefix: string; type: string }[]> {
  if (!cmsCustomTypes().on) return []
  try {
    // The site's own types are read once per instance; an API request waits for them at its gate, a page here.
    await cmsSiteReady()
  }
  catch {
    // (the page's own requests answer 503 then; the address is not taken for an entry)
    return []
  }
  const part = cmsLoadedCustomPart()
  const reg = part?.model?.reg
  const built = (type: string, field: string | null) => {
    const e = reg?.byName.get(type)
    return !!e && (field === null || Object.hasOwn(e.fields, field))
  }
  return publicCustomTypes(part?.doc ?? null, built).flatMap((t) => (t.prefix ? [{ prefix: t.prefix, type: t.name }] : []))
}
