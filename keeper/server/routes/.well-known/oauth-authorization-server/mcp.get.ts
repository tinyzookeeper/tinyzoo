// RFC 8414: where to register, sign in and get tokens. Served at the bare and the path-aware
// address, since clients ask for either (server/utils/oauth.ts).
export default defineEventHandler((event) => authorizationServerMetadata(event))
