import { eq } from '@my-cms/core'
import { z } from 'zod'

// PATCH /api/cms/_auth/me — change your own name and interface language.
const body = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  locale: z.string().max(10).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  assertBuiltinAuth()
  const me = requireCmsUser(event)
  const data = parseOr422(body, await readBody(event))
  const { db, reg } = useCms()
  const [u] = await db.update(reg.cmsUsers).set({ ...data, updatedAt: new Date() }).where(eq(reg.cmsUsers.id, me.id)).returning()
  await startCmsSession(event, u)
  await audit(event, 'account.update', { meta: { fields: Object.keys(data) } })
  return { user: sessionUser(u) }
})
