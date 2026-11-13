// GET /api/cms/_collab/socket — the shared-editing socket (Hocuspocus), on the app's
// own port. Admitted like the realtime socket (same origin, valid session); which
// documents it may open is decided per document (cmsCollabServer.onAuthenticate).
//
// Hocuspocus needs the real `ws` socket and Node request behind the crossws peer
// (it listens for pongs, pings, replays its own queue). They sit at
// `peer._internal`, which is crossws-private: checked here, and a miss closes the
// connection with a logged error instead of failing quietly.
export default defineWebSocketHandler({
  upgrade(request: any) {
    return admitAdminSocket(request)
  },
  async open(peer: any) {
    const user = peer.context?.cmsUser
    if (!user) return peer.close(4401, 'Unauthorized')
    const ws = peer._internal?.ws
    const req = peer._internal?.nodeReq
    if (!ws || typeof ws.on !== 'function' || !req?.headers) {
      console.error('[cms] collab: no raw socket behind the crossws peer — has crossws changed? Refusing.')
      return peer.close(1011, 'Shared editing unavailable')
    }
    // One socket carries every document the page has open.
    ws.setMaxListeners?.(Number.POSITIVE_INFINITY)
    ws.on('error', (err: unknown) => console.error('[cms] collab socket error', (err as Error)?.message ?? err))
    const server = await useCollabServer()
    server.handleConnection(ws, req, { user, sv: peer.context.cmsSessionVersion })
  },
  // Hocuspocus owns the socket from `open` on; these stay deliberately inert.
  message() {},
  close() {},
  error() {},
})
