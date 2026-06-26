import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { buildRegistry, type CmsRegistry } from '@my-cms/core'
// @ts-expect-error virtual alias provided by the module
import * as cmsConfig from '#cms/config'

let _db: ReturnType<typeof drizzle> | undefined

/** DataSource seam. Node path = node-postgres Pool (memoized — persistent process). */
export function useCms(): { db: ReturnType<typeof drizzle>; reg: CmsRegistry } {
  const reg = buildRegistry(cmsConfig as Record<string, any>)
  if (!_db) {
    const url = (useRuntimeConfig().cms as any)?.databaseUrl || process.env.DATABASE_URL
    if (!url) throw createError({ statusCode: 500, statusMessage: 'cms.databaseUrl not configured' })
    _db = drizzle(new Pool({ connectionString: url }), { schema: reg.schema })
  }
  return { db: _db, reg }
}
