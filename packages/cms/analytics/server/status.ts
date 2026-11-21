import { eq, sql } from 'drizzle-orm'
import type { CmsStatusAnalytics } from '../../src/status'
import { LIVE_CONTENT_PATH, ROLLUPS_CONTENT_PATH } from '../format'
import { analyticsOptionsOf } from '../options'
import { analyticsDaily } from '../tables'
import { serverAllowsCollecting, settingsAllowCollecting } from './context'

/**
 * The `analytics` key of `/api/health/status` (CmsStatusAnalytics), or undefined when the site
 * does not use the plugin. `baseURL` is the app's (`/`, or `/web/` behind a path).
 */
export async function analyticsStatus(baseURL: string): Promise<CmsStatusAnalytics | undefined> {
  const { db, reg } = useCms()
  if (!analyticsOptionsOf(reg)) return undefined
  const rollupsPath = `${baseURL}api/content/${ROLLUPS_CONTENT_PATH}`
  const livePath = `${baseURL}api/content/${LIVE_CONTENT_PATH}`
  const enabled = serverAllowsCollecting()
  let collecting = false
  let since: string | null = null
  try {
    collecting = enabled && await settingsAllowCollecting()
    const [row]: any[] = await db.select({ since: sql<string | null>`min(${analyticsDaily.day})::text` })
      .from(analyticsDaily).where(eq(analyticsDaily.dimension, 'total'))
    since = row?.since ?? null
  }
  catch { /* the plugin's tables are not migrated yet */ }
  return { enabled, collecting, since, rollupsPath, livePath }
}
