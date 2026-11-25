/**
 * Whether the `cms_sidebar_folded` cookie says the person folded the sidebar. The admin
 * writes `'1'` or `'0'`, but `useCookie` reads a value that looks like JSON as JSON, so the
 * same cookie comes back as the number `1` or the string `'1'` depending on how it was
 * written (by the browser, by the server, by hand). Both mean folded.
 */
export function cmsSidebarFolded(value: unknown): boolean {
  return value === true || String(value) === '1'
}

/**
 * Nuxt UI's own cookie for the sidebar: `<UDashboardGroup storage-key="cms-admin">` +
 * `-sidebar-` + the sidebar's `id` ("main"). It holds the width and the fold as drawn.
 */
export const CMS_SIDEBAR_LAYOUT_COOKIE = 'cms-admin-sidebar-main'

/**
 * Whether the admin's menu (`GET /api/cms/_menu`) holds a row, wherever it is placed. Every row
 * the person may open is somewhere in it, so `'@model'` tells that the person manages the site
 * and the site has its own content types (server/utils/cmsMenu.ts).
 */
export function cmsMenuHasRow(layout: { home?: string[]; groups?: { items?: string[] }[]; settings?: string[] } | null | undefined, key: string): boolean {
  if (!layout) return false
  return [...(layout.home ?? []), ...(layout.settings ?? []), ...(layout.groups ?? []).flatMap((g) => g.items ?? [])].includes(key)
}
