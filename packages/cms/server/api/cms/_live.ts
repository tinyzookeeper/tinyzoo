// GET /api/cms/_live — the admin's realtime socket (see utils/cmsLive.ts).
//
// The upgrade is refused unless it comes from this site's own pages (Origin) and
// carries a valid built-in session for an active account. Realtime needs the
// built-in sign-in: with external auth the host owns identity and there is no
// request event here to read it from.
//
// Node only. On Workers a socket can be written to only from the request that
// accepted it, so changes saved by other requests could never reach it; the edge
// build refuses the upgrade and the admin works without realtime.
import { driverKind } from '#cms/db'

export default defineWebSocketHandler({
  async upgrade(request: any) {
    if (driverKind === 'edge') throw new Response('Realtime is not available on this deployment', { status: 501 })
    if (cmsAuthMode() !== 'builtin') throw new Response('Realtime needs the built-in sign-in', { status: 404 })
    if (!sameOrigin(request)) throw new Response('Forbidden', { status: 403 })
    const session: any = await getUserSession(request).catch(() => null)
    const u = await activeAccountOf(session)
    if (!u) throw new Response('Unauthorized', { status: 401 })
    request.context.cmsUser = { id: u.id, email: u.email, name: u.name || u.email, role: u.role, locale: u.locale }
    request.context.cmsSessionVersion = u.sessionVersion
  },
  open(peer: any) {
    const user = peer.context?.cmsUser
    if (!user) return peer.close(4401, 'Unauthorized')
    liveOpen(peer, user, peer.context.cmsSessionVersion)
  },
  message(peer: any, message: any) {
    return liveMessage(peer, message.text())
  },
  close(peer: any) {
    liveClose(peer)
  },
  error(peer: any) {
    liveClose(peer)
  },
})

/**
 * Browsers always send Origin on a WebSocket handshake, and cookies go with it even
 * from other sites, so the origin must be this host (as the browser addressed it,
 * or the configured public address).
 */
function sameOrigin(request: any): boolean {
  const origin = request.headers?.get?.('origin')
  if (!origin) return false
  let host: string
  try {
    host = new URL(origin).host
  }
  catch {
    return false
  }
  const allowed = new Set<string>()
  for (const h of [request.headers.get('host'), request.headers.get('x-forwarded-host')]) if (h) allowed.add(String(h).split(',')[0]!.trim())
  const pub = (useRuntimeConfig().cms as any)?.publicUrl
  if (pub) {
    try {
      allowed.add(new URL(pub).host)
    }
    catch { /* not a URL */ }
  }
  return allowed.has(host)
}
