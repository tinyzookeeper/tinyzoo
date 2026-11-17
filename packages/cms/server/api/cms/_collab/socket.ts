// GET /api/cms/_collab/socket — the shared-editing socket (Hocuspocus), on the app's
// own port. Admitted like the realtime socket (same origin, valid session); which
// documents it may open is decided per document (cmsCollabServer.onAuthenticate).
//
// Hocuspocus 4 takes any WebSocket-like object and a web Request, and is fed the
// messages and the close by whoever owns the socket — here the crossws hooks below,
// the way Hocuspocus' own server does it. Frames that arrive while `open` is still
// waiting for the server are kept and handed over in order.
//
// Two things still need the real `ws` socket behind the crossws peer, which sits at
// `peer._internal.ws` (crossws-private): the message size limit, and the pings.
// Hocuspocus 4 closes a connection that has been silent for a minute and no longer
// pings by itself (Hocuspocus 3 did): this handler pings every heartbeat and counts the
// pong as activity, so a tab that is open but quiet (in the background) stays
// connected and a dead one is noticed. Checked here; a miss closes the connection
// with a logged error instead of running without them.
const MAX_SOCKETS_PER_USER = 10
// Shared-editing messages are small; the `ws` default (100 MiB) is not.
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024
/** Frames a socket may send before the server has taken it (it sends a handful). */
const MAX_EARLY_FRAMES = 100
const PING_MS = 30_000
const socketsByUser = new Map<string, Set<any>>()

interface CollabPeerState {
  userId: string
  /** Hocuspocus' side of the socket, once `open` has handed it over. */
  connection?: { handleMessage(data: Uint8Array): void; handleClose(event?: { code: number; reason: string }): void }
  /** Frames received before that. */
  early: Uint8Array[]
  closed?: { code: number; reason: string }
  ping?: ReturnType<typeof setInterval>
}
const peers = new WeakMap<object, CollabPeerState>()

function forget(peer: any, state: CollabPeerState) {
  const mine = socketsByUser.get(state.userId)
  mine?.delete(peer)
  if (mine && !mine.size) socketsByUser.delete(state.userId)
}

export default defineWebSocketHandler({
  upgrade(request: any) {
    return admitAdminSocket(request)
  },
  async open(peer: any) {
    const user = peer.context?.cmsUser
    if (!user) return peer.close(4401, 'Unauthorized')
    const ws = peer._internal?.ws
    if (!ws?._receiver || typeof ws._receiver._maxPayload !== 'number' || typeof ws.ping !== 'function' || typeof ws.on !== 'function') {
      console.error('[cms] collab: no raw socket behind the crossws peer — has crossws changed? Refusing.')
      return peer.close(1011, 'Shared editing unavailable')
    }
    ws._receiver._maxPayload = MAX_PAYLOAD_BYTES
    const state: CollabPeerState = { userId: user.id, early: [] }
    peers.set(peer, state)
    // Too many tabs: the oldest gives way (as on the realtime socket).
    const mine = socketsByUser.get(user.id) ?? new Set()
    if (mine.size >= MAX_SOCKETS_PER_USER) {
      const oldest = mine.values().next().value
      mine.delete(oldest)
      oldest?.close?.(4429, 'Too many open tabs')
    }
    mine.add(peer)
    socketsByUser.set(user.id, mine)
    const server = await useCollabServer()
    if (state.closed) return // gone while the server started
    const connection = server.handleConnection(peer.websocket, peer.request, { user, sv: peer.context.cmsSessionVersion })
    state.connection = connection
    ws.on('pong', () => connection.touch())
    state.ping = setInterval(() => {
      try { ws.ping() }
      catch { /* closing */ }
    }, cmsTimerMs('CMS_TEST_COLLAB_HEARTBEAT_MS', PING_MS))
    ;(state.ping as any).unref?.()
    for (const frame of state.early.splice(0)) connection.handleMessage(frame)
  },
  message(peer: any, message: any) {
    const state = peers.get(peer)
    if (!state) return
    const data: Uint8Array = message.uint8Array()
    if (state.connection) return state.connection.handleMessage(data)
    if (state.early.length >= MAX_EARLY_FRAMES) return peer.close(1008, 'Too many messages')
    state.early.push(data)
  },
  close(peer: any, event: any) {
    const state = peers.get(peer)
    if (!state) return
    state.closed = { code: Number(event?.code) || 1005, reason: String(event?.reason ?? '') }
    state.early.length = 0
    if (state.ping) clearInterval(state.ping)
    forget(peer, state)
    state.connection?.handleClose(state.closed)
    peers.delete(peer)
  },
  error(_peer: any, err: any) {
    console.error('[cms] collab socket error', err?.message ?? err)
  },
})
