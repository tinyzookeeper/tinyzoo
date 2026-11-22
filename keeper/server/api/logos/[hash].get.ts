import { eq } from 'drizzle-orm'

// GET /api/logos/<hash>: a stored logo (logos.ts). For anyone signed in, or with an access token:
// the address is the picture's own SHA-256, so it names nothing but that picture, and the answer is
// kept for good. An SVG is sent with a policy that runs nothing in it, even when opened by itself.
export default defineEventHandler(async (event) => {
  await requireAccess(event)
  const hash = getRouterParam(event, 'hash') ?? ''
  if (!/^[0-9a-f]{64}$/.test(hash)) throw createError({ statusCode: 404, statusMessage: 'No such logo' })
  const [logo] = await useDb().select({ type: schema.logos.type, bytes: schema.logos.bytes }).from(schema.logos).where(eq(schema.logos.hash, hash))
  if (!logo) throw createError({ statusCode: 404, statusMessage: 'No such logo' })
  setResponseHeaders(event, {
    'Content-Type': logo.type,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  })
  return logo.bytes
})
