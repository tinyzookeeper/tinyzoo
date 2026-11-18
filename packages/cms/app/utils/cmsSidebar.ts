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
