import { buildRegistry, type CmsRegistry } from 'tinyzoo'
import { createCmsDb } from '../db/driver'
import * as cmsConfig from '#cms/config'

let _db: ReturnType<typeof createCmsDb> | undefined

/**
 * DataSource seam. The DB instance is memoized (persistent process / isolate).
 * The driver is chosen at build time via `cms.db.driver` ('node' | 'edge'); the
 * runtime code here is identical for both — a single Postgres dialect.
 */
export function useCms(): { db: ReturnType<typeof createCmsDb>; reg: CmsRegistry } {
  const reg = buildRegistry(cmsConfig as Record<string, any>)
  if (!_db) {
    // The runtime environment wins over anything set at build time (the platform
    // injects DATABASE_URL for a linked database).
    const env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {}
    const url = env.NUXT_CMS_DATABASE_URL || env.DATABASE_URL || (useRuntimeConfig().cms as any)?.databaseUrl
    if (!url) throw createError({ statusCode: 500, statusMessage: 'cms.databaseUrl not configured' })
    _db = createCmsDb(url, reg.schema)
  }
  return { db: _db, reg }
}
