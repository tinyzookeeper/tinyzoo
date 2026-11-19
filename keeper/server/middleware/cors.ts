import { isPublicCorsPath } from '#keeper/oauth'

// The MCP server and the OAuth endpoints answer a program running on another origin (a
// connector in a browser). None of them reads a cookie, so: any origin, never credentials. The
// rest of Keeper sends no CORS headers at all.
export default defineEventHandler((event) => {
  if (!isPublicCorsPath(event.path || '')) return
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id',
    'Access-Control-Expose-Headers': 'WWW-Authenticate, mcp-session-id',
    'Access-Control-Max-Age': '86400',
  })
  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
})
