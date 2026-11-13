// GET /api/cms/_collab/socket — the shared-editing socket (Hocuspocus), on the app's
// own port. Admitted like the realtime socket (same origin, valid session); which
// documents it may open is decided per document (cmsCollabServer.onAuthenticate).
//
// Hocuspocus needs the real `ws` socket and Node request behind the crossws peer
// (it listens for pongs, pings, replays its own queue). They sit at
// `peer._internal`, which is crossws-private: checked here, and a miss closes the
// connection with a logged error instead of failing quietly.
const MAX_SOCKETS_PER_USER = 10
// Shared-editing messages are small; the `ws` default (100 MiB) is not.
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024
const socketsByUser = new Map<string, Set<any>>()

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
    if (ws._receiver && typeof ws._receiver._maxPayload === 'number') ws._receiver._maxPayload = MAX_PAYLOAD_BYTES
    // Too many tabs: the oldest gives way (as on the realtime socket).
    const mine = socketsByUser.get(user.id) ?? new Set()
    if (mine.size >= MAX_SOCKETS_PER_USER) {
      const oldest = mine.values().next().value
      mine.delete(oldest)
      oldest?.close?.(4429, 'Too many open tabs')
    }
    mine.add(ws)
    socketsByUser.set(user.id, mine)
    ws.on('close', () => {
      mine.delete(ws)
      if (!mine.size) socketsByUser.delete(user.id)
    })
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
