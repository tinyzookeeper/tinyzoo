// /api/mcp — the MCP server (Streamable HTTP, stateless): the site's content for a program that
// speaks MCP. Only a personal access token gets in (`Authorization: Bearer tzp_…`, made on the
// account page of the admin); the tools act as its person, with the rights the token was given.
// Built-in sign-in only. Off with `cms.mcp: false` (NUXT_CMS_MCP_ENABLED=false). The tools are in
// server/utils/cmsMcp.ts.
export default defineEventHandler(async (event) => {
  if (cmsAuthMode() !== 'builtin' || !cmsMcpEnabled()) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setResponseHeader(event, 'cache-control', 'no-store')
  if (event.method !== 'POST') {
    // Stateless: no stream to open (GET) and no session to end (DELETE).
    setResponseHeader(event, 'Allow', 'POST')
    throw createError({ statusCode: 405, statusMessage: 'Send MCP requests with POST' })
  }
  const user = await requireTokenUser(event)
  // A program in a loop should not crowd out the people in the admin.
  if (!(await rateLimit(`mcp:${user.token!.id}`, 300, 60_000))) throw tooManyRequests(event, 'Too many requests for this token; slow down', 60_000)
  return cmsMcpHandler().fetch(toWebRequest(event), {
    authInfo: { token: user.token!.id, clientId: user.id, scopes: [], extra: { user } },
  })
})
