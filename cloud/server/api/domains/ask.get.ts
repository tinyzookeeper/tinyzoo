// GET /api/domains/ask?domain=<host>: "may I issue a certificate for this name?"
//
// For the platform in front of the websites: before it gets a certificate for a name somebody
// pointed at it, it asks here. 200: the name is a verified domain of a ready website, or a
// ready website's own address at the service. 404: it is not. Nothing else is said, to
// anybody: no session, no body. Limited per address that asks.
export default defineEventHandler(async (event) => {
  await migrationsReady()
  setResponseHeader(event, 'cache-control', 'no-store')
  if (tooManyAttempts(`ask:${clientIp(event)}`, 600, 60_000)) {
    setResponseStatus(event, 429)
    return ''
  }
  setResponseStatus(event, await servesHost(getQuery(event).domain) ? 200 : 404)
  return ''
})
