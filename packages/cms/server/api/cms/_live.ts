// GET /api/cms/_live — the admin's realtime socket (see utils/cmsLive.ts).
//
// The upgrade is refused unless it comes from this site's own pages (Origin) and
// carries a valid built-in session for an active account. Realtime needs the
// built-in sign-in: with external auth the host owns identity and there is no
// request event here to read it from.

export default defineWebSocketHandler({
  upgrade(request: any) {
    return admitAdminSocket(request)
  },
  open(peer: any) {
    const user = peer.context?.cmsUser
    if (!user) return peer.close(4401, 'Unauthorized')
    // Realtime messages are tiny; refuse big frames before they are buffered whole
    // (the `ws` default is 100 MiB). crossws-private, so only when it is there.
    const ws = peer._internal?.ws
    if (ws?._receiver && typeof ws._receiver._maxPayload === 'number') ws._receiver._maxPayload = 16 * 1024
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
