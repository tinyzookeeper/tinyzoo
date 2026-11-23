import { buildRegistry, type CmsRegistry } from 'tinyzoo'
import { createCmsDb } from '../db/driver'
import * as cmsConfig from '#cms/config'

/**
 * The current site's database (cmsSite.ts): one connection pool per site, made on first
 * use and ended when the site is unloaded. Single mode has one site, so one pool, as always.
 * Multi mode: the site's own address and user from the site directory, and no pool at all
 * for work that has no site (useSite throws).
 */
const siteDb = siteScoped<ReturnType<typeof createCmsDb>>(() => {
  const reg = buildRegistry(cmsConfig as Record<string, any>)
  if (cmsIsMultiTenant()) return createCmsDb(useSite('a database query').databaseUrl, reg.schema, { multiTenant: true })
  // Read from the runtime environment only, never from the build (the platform
  // injects DATABASE_URL for a linked database).
  const env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
  const url = env.NUXT_CMS_DATABASE_URL || env.DATABASE_URL
  if (!url) throw createError({ statusCode: 500, statusMessage: 'No database address: set DATABASE_URL (or NUXT_CMS_DATABASE_URL)' })
  return createCmsDb(url, reg.schema)
}, { dispose: (db) => (db as any).$client?.end?.() })

/**
 * DataSource seam. The DB instance is memoized per site (persistent process).
 * The driver is chosen at build time via `cms.db.driver` ('node' | 'edge'); the
 * runtime code here is identical for both — a single Postgres dialect.
 */
export function useCms(): { db: ReturnType<typeof createCmsDb>; reg: CmsRegistry } {
  const reg = buildRegistry(cmsConfig as Record<string, any>)
  return { db: siteDb(), reg }
}
