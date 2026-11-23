// Nitro's auto-imports that server utilities loaded directly by a unit test call
// (the spec stubs them with vi.stubGlobal); the root type-check has no Nitro to know them.
declare function createError(input: { statusCode?: number; statusMessage?: string; message?: string; cause?: unknown; data?: unknown }): Error & { statusCode?: number }
declare function useRuntimeConfig(): any
declare function getQuery(event: any): Record<string, any>

// The site helpers of the server (packages/cms/server/utils/cmsSite.ts), which Nitro also
// auto-imports. For the unit specs the real ones are put on globalThis by test/setup/site-globals.ts.
type CmsSiteHelpers = typeof import('../../packages/cms/server/utils/cmsSite')
declare const CmsNoSiteError: CmsSiteHelpers['CmsNoSiteError']
declare const cmsTenancyMode: CmsSiteHelpers['cmsTenancyMode']
declare const cmsIsMultiTenant: CmsSiteHelpers['cmsIsMultiTenant']
declare const useCmsSite: CmsSiteHelpers['useCmsSite']
declare const currentCmsSite: CmsSiteHelpers['currentCmsSite']
declare const runInCmsSite: CmsSiteHelpers['runInCmsSite']
declare const outsideCmsSite: CmsSiteHelpers['outsideCmsSite']
declare const bindToCmsSite: CmsSiteHelpers['bindToCmsSite']
declare const cmsSiteScoped: CmsSiteHelpers['cmsSiteScoped']
declare const cmsProcessWide: CmsSiteHelpers['cmsProcessWide']
declare const unloadAllCmsSites: CmsSiteHelpers['unloadAllCmsSites']
declare const cmsSettings: CmsSiteHelpers['cmsSettings']
declare const cmsNormalHost: CmsSiteHelpers['cmsNormalHost']
declare const cmsRequestHost: CmsSiteHelpers['cmsRequestHost']
declare const cmsSiteForHost: CmsSiteHelpers['cmsSiteForHost']
declare const cmsSiteById: CmsSiteHelpers['cmsSiteById']
declare const cmsAllSites: CmsSiteHelpers['cmsAllSites']
declare const forEachCmsSite: CmsSiteHelpers['forEachCmsSite']
declare const onCmsSiteStart: CmsSiteHelpers['onCmsSiteStart']
declare const ensureCmsSiteStarted: CmsSiteHelpers['ensureCmsSiteStarted']
declare const cmsSiteHasLeft: CmsSiteHelpers['cmsSiteHasLeft']
declare const cmsSiteLeftCheck: CmsSiteHelpers['cmsSiteLeftCheck']
declare const cmsSiteQuietCheck: CmsSiteHelpers['cmsSiteQuietCheck']
declare const cmsHoldSiteUntil: CmsSiteHelpers['cmsHoldSiteUntil']
