import { eq } from 'drizzle-orm'
import { z } from 'zod'

// Rename the workspace (its address stays), change who hears about its sites, or how guests see
// who looks after them (owner or admin).
const input = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  alertEmails: z.array(emailSchema).max(30).optional(),
  signature: z.string().trim().max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const { m } = await requireWorkspace(event, { manager: true })
  const data = await readInput(event, input)
  await useDb().update(schema.workspaces).set(data).where(eq(schema.workspaces.id, m.workspaceId))
  return { ok: true }
})
