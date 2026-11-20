import type { MeResponse } from '#keeper/types/keeper'

// Who I am and every workspace I am in, with the teams I see and their health (the switchers).
export default defineEventHandler(async (event): Promise<MeResponse> => {
  const user = await requireUser(event)
  const access = await requireMember(event)
  return meResponse(user, access)
})
