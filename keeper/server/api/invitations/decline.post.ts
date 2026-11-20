import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

// Public: say no to an invitation. The link is the proof it was meant for you.
const input = z.object({ token: z.string().min(1).max(200) })

export default defineEventHandler(async (event) => {
  const { token } = await readInput(event, input)
  const [row] = await useDb().update(schema.workspaceInvitations).set({ status: 'declined', updatedAt: new Date() })
    .where(and(eq(schema.workspaceInvitations.tokenHash, hashInviteToken(token)), eq(schema.workspaceInvitations.status, 'pending')))
    .returning({ id: schema.workspaceInvitations.id })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'This invitation is not open any more' })
  return { ok: true }
})
