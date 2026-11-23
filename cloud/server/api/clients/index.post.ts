import { z } from 'zod'

// Connect a website I already run: its name and its address. The answer carries the three
// settings to put on that website; the secret is in this one answer and is never shown again.
const input = z.object({ name: z.string().trim().min(1).max(80), url: z.string().trim().min(1).max(300) })

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const data = await readInput(event, input)
  if (tooManyAttempts(`client:create:${me.id}`, 20, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  const made = await connectSite(me, data)
  setResponseStatus(event, 201)
  setResponseHeader(event, 'cache-control', 'no-store')
  return made
})
