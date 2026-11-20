import type { MailStatus } from '#keeper/types/keeper'

// How Keeper sends e-mail (owner or admin): Settings shows it.
export default defineEventHandler(async (event): Promise<MailStatus> => {
  const me = await requireMember(event)
  if (!me.memberships.some(isManager)) throw createError({ statusCode: 403, statusMessage: 'Only an owner or admin can see this' })
  return mailStatus()
})
