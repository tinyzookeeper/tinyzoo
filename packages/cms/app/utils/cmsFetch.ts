/**
 * `$fetch` for the admin's own API calls with a computed address. Nuxt types each
 * call against every route of the host app; with a dynamic address in a large app
 * that comparison exceeds TypeScript's depth limit and fails the host's typecheck.
 * The admin's calls are typed by their result instead.
 */
export const cmsFetch = <T = any>(url: string, options?: Record<string, any>): Promise<T> => ($fetch as any)(url, options)
