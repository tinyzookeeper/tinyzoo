import type { Member } from '#keeper/types/keeper'

export default defineEventHandler(async (event): Promise<Member[]> => listTeam(await requireMember(event)))
