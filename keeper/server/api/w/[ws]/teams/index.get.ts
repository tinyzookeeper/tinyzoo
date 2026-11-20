import type { Team } from '#keeper/types/keeper'

// The teams of the workspace I see, with their sites and people.
export default defineEventHandler(async (event): Promise<Team[]> => {
  const { m } = await requireWorkspace(event)
  return listTeams(m)
})
