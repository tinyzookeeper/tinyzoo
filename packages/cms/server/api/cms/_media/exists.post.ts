import { inArray } from 'tinyzoo'
import { z } from 'zod'

// POST /api/cms/_media/exists { ids } — which of these files still exist. Restoring
// an older version uses it to leave out files deleted since.
const body = z.object({ ids: z.array(z.string().uuid()).max(500) })

export default defineEventHandler(async (event) => {
  requireCmsUser(event)
  const { ids } = parseOr422(body, await readBody(event))
  if (!ids.length) return { ids: [] }
  const { db, reg } = useCms()
  const rows: any[] = await db.select({ id: reg.cmsMedia.id }).from(reg.cmsMedia).where(inArray(reg.cmsMedia.id, ids))
  return { ids: rows.map((r) => r.id) }
})
