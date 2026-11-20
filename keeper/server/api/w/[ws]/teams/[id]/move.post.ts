import { z } from 'zod'

// Move a team, with its sites and people, to another workspace (an owner or admin of both).
// `confirm` is the team's exact name.
const input = z.object({ workspace: z.string().min(1).max(120), confirm: z.string().max(80) })

export default defineEventHandler(async (event) => {
  const { access, m } = await requireWorkspace(event, { manager: true })
  const team = await teamOf(m, getRouterParam(event, 'id') ?? '')
  const data = await readInput(event, input)
  if (data.confirm !== team.name) throw createError({ statusCode: 422, statusMessage: `Type the team’s name, ${team.name}, to move it` })
  return moveTeam(access, m, team.id, data.workspace)
})
