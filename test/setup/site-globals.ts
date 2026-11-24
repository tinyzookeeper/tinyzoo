// The site helpers of the server (packages/cms/server/utils/cmsSite.ts: cmsSiteScoped,
// cmsProcessWide, cmsIsMultiTenant, useCmsSite, runInCmsSite …) are Nitro auto-imports: a
// server file calls them as globals, many at module level (`const cache = cmsSiteScoped(…)`).
// A unit spec loads such a file directly, with no Nitro to provide them, so they are put on
// `globalThis` here, before every unit spec: the real functions, in single mode (the one
// site there always is) unless a spec sets NUXT_CMS_TENANCY_MODE and loads the file afresh.
// A spec that stubs one of them itself (vi.stubGlobal) keeps its stub.
import * as site from '../../packages/cms/server/utils/cmsSite'

for (const [name, value] of Object.entries(site)) {
  if (!(name in globalThis)) (globalThis as Record<string, unknown>)[name] = value
}
