import { buildRegistry, type CmsRegistry } from '@my-cms/core'
// #cms/db is aliased by the module to the node or edge driver at BUILD time, so
// only the selected driver (and its deps: pg vs @neondatabase/serverless) is bundled.
// @ts-expect-error virtual alias provided by the module
import { createCmsDb } from '#cms/db'
// @ts-expect-error virtual alias provided by the module
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
    const url = (useRuntimeConfig().cms as any)?.databaseUrl || process.env.DATABASE_URL
    if (!url) throw createError({ statusCode: 500, statusMessage: 'cms.databaseUrl not configured' })
    _db = createCmsDb(url, reg.schema)
  }
  return { db: _db, reg }
}
