import { eq } from 'drizzle-orm'
import { z } from 'zod'

const input = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  alertEmails: z.array(emailSchema).max(20).optional(),
})

export default defineEventHandler(async (event) => {
  const me = await requireManager(event)
  const data = await readInput(event, input)
  await useDb().update(schema.workspaces).set(data).where(eq(schema.workspaces.id, me.workspaceId))
  // The name is in the session too.
  if (data.name) await startSession(event, me.userId)
  return { ok: true }
})
