import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'

// Keeper's MCP server: Streamable HTTP, stateless (a new server for every request), JSON
// answers. Only an access token gets in: `Authorization: Bearer kpr_…` (Settings → Access
// tokens). The tools are in server/utils/mcp.ts.
export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    // Stateless: no stream to open (GET) and no session to end (DELETE).
    setResponseHeader(event, 'Allow', 'POST')
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed: send MCP requests with POST' })
  }
  const access = await requireAccess(event, 'read', { tokenOnly: true })
  const server = createKeeperMcp(event, access)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    const body = await readBody(event).catch(() => undefined)
    return await transport.handleRequest(toWebRequest(event), {
      parsedBody: body,
      authInfo: { token: access.tokenId ?? '', clientId: access.userId, scopes: [access.scope] },
    })
  }
  finally {
    await server.close()
  }
})
