import { eq, inArray, type CmsChange } from 'tinyzoo'

/**
 * Realtime for the admin: who else is looking at (or editing) the same content, and
 * what changed while you were looking. One WebSocket per admin tab
 * (/api/cms/_live, see api/cms/_live.ts) watches a few topics:
 *
 *   list:<entity>             a collection's list
 *   entry:<entity>:<id>       one entry (or a global's row)
 *
 * Identity comes from the signed session checked at connect time, never from what a
 * browser says about itself, and is re-checked every heartbeat (a disabled account or
 * a password change drops the socket). Watching a topic needs read access to it.
 *
 * Several replicas: presence is shared over the store's `live` channel. Each
 * instance announces its own people when they change and again every heartbeat;
 * others forget an announcement that was not repeated in time (a crashed replica's
 * people disappear on their own). Content changes arrive through onCmsChange, which
 * already covers changes saved on other replicas.
 *
 * Multi-tenant mode: a hub per site (its sockets, topics, presence and names), so people
 * on `list:post` of one site never hear about another site's, whatever ids the two share.
 * A hub runs while someone is connected to its site here: its heartbeat runs inside the
 * site, and a presence message on the shared channel names its site.
 *
 * Server → browser messages:
 *   { type: 'presence', topic, people: [{ id, name, editing }] }   (including you)
 *   { type: 'change', topic, change: { type, entity, id, locale, by, byName, at } }
 *   { type: 'error', topic?, message }
 * Browser → server:
 *   { type: 'watch' | 'unwatch', topic }
 *   { type: 'editing', topic, editing: boolean }
 */

/** The bits of a crossws peer this hub uses (crossws is not a direct dependency). */
export interface LiveSocket {
  id: string
  send: (data: string) => unknown
  close: (code?: number, reason?: string) => void
}

interface Person { id: string; name: string; editing: boolean }
/**
 * `rowFiltered`: the person may read only some rows of this collection — list
 * changes reach them without ids, and an entry watch is re-checked every heartbeat.
 */
interface Watch { editing: boolean; rowFiltered: boolean }
interface LocalPeer {
  socket: LiveSocket
  user: CmsUser
  sv: number
  /** When the session this socket was admitted with was signed in (it ends with that session). */
  iat: number
  topics: Map<string, Watch>
  /** Messages are handled one at a time, in order. */
  queue: Promise<void>
  openedAt: number
  /** Last sign of life (any message, including the answer to our ping). */
  seenAt: number
  /** Messages in the current rate window. */
  burst: { at: number; n: number }
}

const LIVE_CHANNEL = 'live'
/** The test build shortens it (CMS_TEST_LIVE_HEARTBEAT_MS); the other limits below stay, so a quiet test tab is not dropped. */
const HEARTBEAT_MS = 20_000
const REMOTE_TTL_MS = 50_000
/** A socket that has not answered for this long is gone (sleeping laptop, dead network). */
const SILENT_MS = 65_000
/** Sockets are re-opened (and re-authorised) at least this often. */
const MAX_SOCKET_AGE_MS = 12 * 60 * 60_000
const MAX_TOPICS = 20
const MAX_MESSAGE = 1024
const MAX_SOCKETS_PER_USER = 10
const RATE_WINDOW_MS = 10_000
const RATE_MAX = 60

/** One site's hub (single mode: the one there is). */
interface Hub {
  /** The site's id: the heartbeat and a message from another replica find the site by it. */
  site: string
  local: Map<string, LocalPeer>
  /** topic → `${instance}:${peer}` → what another replica said about one of its peers. */
  remote: Map<string, Map<string, { person: Person; at: number }>>
  /** People's names for change notices, kept a minute. */
  names: Map<string, { name: string; at: number }>
  timer: ReturnType<typeof setInterval> | null
  stopChanges: (() => void) | null
}

/** A site that is unloaded (it left the directory, or its row changed) lets its sockets go: a live browser reconnects and is admitted afresh. */
const hub = cmsSiteScoped<Hub>(() => ({ site: useCmsSite().id, local: new Map(), remote: new Map(), names: new Map(), timer: null, stopChanges: null }), {
  dispose: (h) => stopHub(h, 4000, 'Reconnect'),
})
/** The hubs that run, by site id. */
const running = cmsProcessWide(new Map<string, Hub>(), 'the hubs that run: the one subscription below finds the hub a message is for, and a stopping server stops them all')
const listening = cmsProcessWide({ started: null as Promise<void> | null }, 'one subscription to the live channel serves every site')

/**
 * Start listening to other replicas and to content changes (once, on the first
 * connection). Runs in the background: a slow or absent Redis never holds up a
 * socket — presence then stays on this instance until it is back.
 */
function start(): void {
  const h = hub()
  if (h.timer) return
  // A timer carries no site of its own: the heartbeat is run inside the hub's, looked up as the directory has it now.
  h.timer = setInterval(() => {
    const site = cmsSiteById(h.site)
    if (site) void runInCmsSite(site, heartbeat)
  }, cmsTimerMs('CMS_TEST_LIVE_HEARTBEAT_MS', HEARTBEAT_MS))
  ;(h.timer as any).unref?.()
  h.stopChanges = onCmsChange((change) => { void deliverChange(change).catch((err) => console.error('[cms] realtime delivery failed', scrubError(err))) })
  running.set(h.site, h)
  // One subscription for the process, made by the first hub but not inside its site.
  listening.started ??= outsideCmsSite(() => (async () => {
    const store = await useCmsStore()
    await store.subscribe(LIVE_CHANNEL, (raw) => {
      try {
        const msg = JSON.parse(raw)
        // The message names its site (multi-tenant mode) and is for that site's hub. No
        // hub here, because nobody is connected to that site: nothing to tell, nothing kept.
        const to = running.get(channelSiteId(msg) ?? '')
        const site = to ? cmsSiteById(to.site) : null
        if (site) runInCmsSite(site, () => onRemote(msg))
      }
      catch { /* not ours */ }
    })
  })().catch((err) => console.error('[cms] realtime cannot hear other instances', scrubError(err))))
}

/** Stop one hub: its timer, its listener, its sockets. Needs no current site (a site being unloaded has none). */
function stopHub(h: Hub, code: number, reason: string): void {
  if (h.timer) clearInterval(h.timer)
  h.timer = null
  h.stopChanges?.()
  h.stopChanges = null
  if (running.get(h.site) === h) running.delete(h.site)
  for (const p of h.local.values()) p.socket.close(code, reason)
  h.local.clear()
  h.remote.clear()
}

/** Stop timers and listeners (server shutdown, dev reload): every site's hub. */
export function stopLive(): void {
  for (const h of [...running.values()]) stopHub(h, 1001, 'Server shutting down')
  listening.started = null
}

// ── connections ──

export function liveOpen(socket: LiveSocket, user: CmsUser, sv: number, iat: number): void {
  const { local } = hub()
  const mine = [...local.values()].filter((p) => p.user.id === user.id)
  if (mine.length >= MAX_SOCKETS_PER_USER) {
    // Too many tabs: the oldest one gives way.
    const oldest = mine.sort((x, y) => x.openedAt - y.openedAt)[0]!
    oldest.socket.close(4429, 'Too many open tabs')
    liveClose(oldest.socket)
  }
  const now = Date.now()
  local.set(socket.id, { socket, user, sv, iat, topics: new Map(), queue: Promise.resolve(), openedAt: now, seenAt: now, burst: { at: now, n: 0 } })
  start()
}

export function liveClose(socket: LiveSocket): void {
  const { local } = hub()
  const p = local.get(socket.id)
  if (!p) return
  local.delete(socket.id)
  for (const topic of p.topics.keys()) {
    void announce(topic, socket.id, null)
    broadcastPresence(topic)
  }
}

export function liveMessage(socket: LiveSocket, text: string): Promise<void> {
  const { local } = hub()
  const p = local.get(socket.id)
  if (!p) return Promise.resolve()
  const now = Date.now()
  p.seenAt = now
  if (now - p.burst.at > RATE_WINDOW_MS) p.burst = { at: now, n: 0 }
  if (++p.burst.n > RATE_MAX) {
    socket.close(4408, 'Too many messages')
    liveClose(socket)
    return Promise.resolve()
  }
  p.queue = p.queue.then(() => handle(p, text)).catch((err) => console.error('[cms] realtime message failed', scrubError(err)))
  return p.queue
}

async function handle(p: LocalPeer, text: string): Promise<void> {
  const { local } = hub()
  if (!local.has(p.socket.id)) return // closed meanwhile
  if (text.length > MAX_MESSAGE) return send(p, { type: 'error', message: 'Message too large' })
  let msg: any
  try {
    msg = JSON.parse(text)
  }
  catch {
    return
  }
  if (msg?.type === 'pong') return
  const topic = typeof msg?.topic === 'string' ? msg.topic : ''
  if (msg?.type === 'watch') {
    if (p.topics.has(topic)) return broadcastPresence(topic)
    if (p.topics.size >= MAX_TOPICS) return send(p, { type: 'error', topic, message: 'Watching too many things at once' })
    const access = await mayWatch(p.user, topic)
    if (!access) return send(p, { type: 'error', topic, message: 'Not found or not permitted' })
    if (!local.has(p.socket.id) || p.topics.size >= MAX_TOPICS) return
    // `editing` may come with the watch (a tab with unsaved changes reconnecting).
    p.topics.set(topic, { editing: msg.editing === true, rowFiltered: access.rowFiltered })
    void announce(topic, p.socket.id, personOf(p, topic))
    broadcastPresence(topic)
  }
  else if (msg?.type === 'unwatch') {
    if (!p.topics.delete(topic)) return
    void announce(topic, p.socket.id, null)
    broadcastPresence(topic)
  }
  else if (msg?.type === 'editing') {
    const w = p.topics.get(topic)
    if (!w || w.editing === !!msg.editing) return
    w.editing = !!msg.editing
    void announce(topic, p.socket.id, personOf(p, topic))
    broadcastPresence(topic)
  }
}

// ── topics and access ──

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseTopic(topic: string): { kind: 'list' | 'entry'; entity: string; id?: string } | null {
  const m = /^(list|entry):([a-zA-Z][\w-]{0,63})(?::([0-9a-fA-F-]{36}))?$/.exec(topic)
  if (!m) return null
  if (m[1] === 'list' && m[3]) return null
  if (m[1] === 'entry' && !(m[3] && UUID.test(m[3]))) return null
  return { kind: m[1] as 'list' | 'entry', entity: m[2]!, id: m[3]?.toLowerCase() }
}

/** May this person watch the topic: read access to the collection, and to the row for an entry. */
async function mayWatch(user: CmsUser, topic: string): Promise<{ rowFiltered: boolean } | null> {
  const t = parseTopic(topic)
  if (!t || topic !== (t.kind === 'list' ? `list:${t.entity}` : `entry:${t.entity}:${t.id}`)) return null
  try {
    const { db, reg } = useCms()
    const e = reg.byName.get(t.entity)
    if (!e) return null
    const rowFilter = authorize(e, 'read', user)
    if (t.kind === 'list') return { rowFiltered: rowFilter !== undefined }
    const [row] = await db.select({ id: e.table.id }).from(e.table).where(both(eq(e.table.id, t.id!), rowFilter))
    return row ? { rowFiltered: rowFilter !== undefined } : null
  }
  catch {
    return null
  }
}

// ── presence ──

/** How colleagues see someone: their name, never their full email address. */
export function displayName(name?: string | null, email?: string | null): string {
  return name?.trim() || (email ? email.split('@')[0]! : '')
}

const personOf = (p: LocalPeer, topic: string): Person => ({ id: p.user.id, name: displayName(p.user.name, p.user.email), editing: !!p.topics.get(topic)?.editing })

/** Everyone on a topic, one entry per person (several tabs: editing if any tab is). */
export function presenceOf(topic: string): Person[] {
  const { local, remote } = hub()
  const byId = new Map<string, Person>()
  const add = (person: Person) => {
    const seen = byId.get(person.id)
    if (seen) seen.editing ||= person.editing
    else byId.set(person.id, { ...person })
  }
  for (const p of local.values()) if (p.topics.has(topic)) add(personOf(p, topic))
  const now = Date.now()
  for (const { person, at } of remote.get(topic)?.values() ?? []) if (now - at < REMOTE_TTL_MS) add(person)
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function broadcastPresence(topic: string): void {
  const people = presenceOf(topic)
  for (const p of hub().local.values()) if (p.topics.has(topic)) send(p, { type: 'presence', topic, people })
}

const announceError = cmsProcessWide({ at: 0 }, 'a log throttle: one line a minute while Redis is down, whatever the site')

async function announce(topic: string, peerId: string, person: Person | null): Promise<void> {
  try {
    const store = await useCmsStore()
    await store.publish(LIVE_CHANNEL, channelMessage({ origin: instanceId(), topic, peer: peerId, person }))
  }
  catch (err) {
    // One line a minute is enough while Redis is down.
    if (Date.now() - announceError.at > 60_000) {
      announceError.at = Date.now()
      console.error('[cms] realtime announce failed', safeErrorMessage(err))
    }
  }
}

/** What another replica said about one of its peers of this site (called inside the site). */
function onRemote(msg: any): void {
  const { remote } = hub()
  if (!msg || msg.origin === instanceId() || typeof msg.topic !== 'string' || typeof msg.peer !== 'string') return
  if (!parseTopic(msg.topic)) return
  const key = `${msg.origin}:${msg.peer}`
  let map = remote.get(msg.topic)
  const person = msg.person
  if (person && typeof person.id === 'string' && typeof person.name === 'string') {
    if (!map) remote.set(msg.topic, map = new Map())
    const before = map.get(key)?.person
    map.set(key, { person: { id: person.id, name: person.name, editing: !!person.editing }, at: Date.now() })
    // A repeat of the same announcement (heartbeat) changes nothing anyone sees.
    if (before && before.id === person.id && before.editing === !!person.editing) return
  }
  else {
    if (!map?.delete(key)) return
    if (!map.size) remote.delete(msg.topic)
  }
  broadcastPresence(msg.topic)
}

/**
 * Every heartbeat: repeat our people to the other replicas, forget theirs that went
 * quiet, and drop sockets whose account may no longer be used.
 */
async function heartbeat(): Promise<void> {
  const h = hub()
  const { local, remote } = h
  // Multi-tenant mode: a site nobody is connected to here keeps no timer and no list of
  // other replicas' people; its next socket starts the hub again. (The one hub of single
  // mode runs on, as always.) Not at once when the last socket leaves: a tab that
  // reloads is back before the next beat.
  if (cmsIsMultiTenant() && !local.size) return stopHub(h, 4000, 'Reconnect')
  const now0 = Date.now()
  for (const p of [...local.values()]) {
    // Gone quiet (no answer to the last pings) or open too long: drop it — a live
    // browser reconnects at once, and is authorised afresh.
    if (now0 - p.seenAt > SILENT_MS || now0 - p.openedAt > MAX_SOCKET_AGE_MS) {
      p.socket.close(4000, 'Reconnect')
      liveClose(p.socket)
      continue
    }
    // Keeps proxies from closing an idle socket, and asks for a sign of life.
    send(p, { type: 'ping' })
  }
  for (const [id, p] of local) for (const topic of p.topics.keys()) void announce(topic, id, personOf(p, topic))
  const now = Date.now()
  for (const [topic, map] of remote) {
    let changed = false
    for (const [key, v] of map) if (now - v.at >= REMOTE_TTL_MS) { map.delete(key); changed = true }
    if (!map.size) remote.delete(topic)
    if (changed) broadcastPresence(topic)
  }
  await recheckAccounts().catch((err) => console.error('[cms] realtime account check failed', scrubError(err)))
  await recheckRowWatches().catch((err) => console.error('[cms] realtime access check failed', scrubError(err)))
}

/** Entry watches under a row rule (authors' own entries): still allowed? */
async function recheckRowWatches(): Promise<void> {
  const { local } = hub()
  for (const p of [...local.values()]) {
    for (const [topic, w] of [...p.topics]) {
      if (!w.rowFiltered || !topic.startsWith('entry:')) continue
      if (await mayWatch(p.user, topic)) continue
      if (!p.topics.delete(topic)) continue
      send(p, { type: 'error', topic, message: 'Not found or not permitted' })
      void announce(topic, p.socket.id, null)
      broadcastPresence(topic)
    }
  }
}

async function recheckAccounts(): Promise<void> {
  const { local } = hub()
  const ids = [...new Set([...local.values()].map((p) => p.user.id))]
  if (!ids.length) return
  const { db, reg } = useCms()
  const rows: any[] = await db.select({ id: reg.cmsUsers.id, status: reg.cmsUsers.status, sv: reg.cmsUsers.sessionVersion, role: reg.cmsUsers.role })
    .from(reg.cmsUsers).where(inArray(reg.cmsUsers.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const p of [...local.values()]) {
    const u = byId.get(p.user.id)
    // A changed role reconnects too, so watches are re-authorised under the new one; a
    // session past its 14 days (from its sign-in) ends here as it does over HTTP.
    if (!u || u.status !== 'active' || u.sv !== p.sv || u.role !== p.user.role || !signedInRecently({ cms: { iat: p.iat } })) {
      p.socket.close(4401, 'Session no longer valid')
      liveClose(p.socket)
    }
  }
}

// ── content changes ──

async function nameOf(userId: string | null): Promise<string | null> {
  if (!userId) return null
  const { names } = hub()
  const hit = names.get(userId)
  if (hit && Date.now() - hit.at < 60_000) return hit.name
  try {
    const { db, reg } = useCms()
    const [u] = await db.select({ name: reg.cmsUsers.name, email: reg.cmsUsers.email }).from(reg.cmsUsers).where(eq(reg.cmsUsers.id, userId))
    const name = u ? displayName(u.name, u.email) || null : null
    if (name) names.set(userId, { name, at: Date.now() })
    if (names.size > 500) names.clear()
    return name
  }
  catch {
    return null
  }
}

async function deliverChange(change: CmsChange): Promise<void> {
  const { local } = hub()
  const topics = [`list:${change.entity}`, `entry:${change.entity}:${change.id}`]
  const recipients = [...local.values()].filter((p) => topics.some((t) => p.topics.has(t)))
  if (!recipients.length) return
  // Only what a watcher needs to react — not the public flag or website addresses.
  const body = { type: change.type, entity: change.entity, id: change.id, locale: change.locale, version: change.version, by: change.by, byName: await nameOf(change.by), at: change.at }
  for (const p of recipients) {
    // Looked up again: the person may have stopped watching while we fetched the name.
    if (p.topics.has(topics[1]!)) {
      send(p, { type: 'change', topic: topics[1], change: body })
      continue
    }
    const list = p.topics.get(topics[0]!)
    if (!list) continue
    // Someone who may read only some rows learns that the list changed, not which row.
    send(p, { type: 'change', topic: topics[0], change: list.rowFiltered ? { ...body, id: null, version: null, by: null, byName: null } : body })
  }
}

function send(p: LocalPeer, msg: unknown): void {
  try {
    p.socket.send(JSON.stringify(msg))
  }
  catch { /* closing */ }
}

/** For tests and diagnostics. */
export function liveStats() {
  const { local, remote, timer } = hub()
  return { sockets: local.size, remoteTopics: remote.size, running: !!timer }
}
