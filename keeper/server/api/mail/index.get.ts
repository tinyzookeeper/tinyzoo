import type { MailStatus } from '#keeper/types/keeper'

// How Keeper sends e-mail (owner or admin): Settings shows it.
export default defineEventHandler(async (event): Promise<MailStatus> => {
  await requireManager(event)
  return mailStatus()
})
