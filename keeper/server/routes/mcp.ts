// Keeper's MCP server: Streamable HTTP, stateless (a new server for every request), JSON
// answers, for both protocol eras (2026-07-28 and 2025). Only an access token gets in:
// `Authorization: Bearer kpr_…` (Settings → Access tokens). The tools are in server/utils/mcp.ts.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (event.method !== 'POST') {
    // Stateless: no stream to open (GET) and no session to end (DELETE).
    setResponseHeader(event, 'Allow', 'POST')
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed: send MCP requests with POST' })
  }
  const access = await requireAccess(event, 'read', { tokenOnly: true })
  return keeperMcpHandler().fetch(toWebRequest(event), {
    authInfo: { token: access.tokenId ?? '', clientId: access.userId, scopes: [access.scope], extra: { event, access } },
  })
})
