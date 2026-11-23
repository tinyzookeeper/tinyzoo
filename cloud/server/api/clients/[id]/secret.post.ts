// A new secret for a website I connected: the old one stops working at once. Shown in this one answer.
export default defineEventHandler(async (event) => {
  const { me, client } = await requireOwnClient(event)
  if (tooManyAttempts(`client:secret:${me.id}`, 20, 60 * 60_000)) throw fail(429, 'tooMany', 'Too many attempts, try again later')
  setResponseHeader(event, 'cache-control', 'no-store')
  return { credentials: await renewClientSecret(client) }
})
