// RFC 9728: which server issues tokens for /mcp. Served at the bare and the path-aware address,
// since clients ask for either (server/utils/oauth.ts).
export default defineEventHandler((event) => protectedResourceMetadata(event))
