import { z } from 'zod'

// Make a workspace: I own it, and it starts with the team "General".
const input = z.object({ name: z.string().trim().min(1, 'Give it a name').max(100) })

export default defineEventHandler(async (event) => {
  const me = await requireMember(event)
  const { name } = await readInput(event, input)
  const ws = await useDb().transaction((tx) => createWorkspace(tx, me.userId, name))
  setResponseStatus(event, 201)
  return ws
})
