import { and, eq, inArray, sql } from 'tinyzoo'
import { Hocuspocus } from '@hocuspocus/server'
import * as Y from 'yjs'
import { REDIS_PROTOCOL } from '../store/redis'

/**
 * The shared-editing engine (Hocuspocus), on the app's own port: it opens no server
 * of its own — api/cms/_collab/socket.ts hands it sockets Nitro already accepted.
 * See cmsCollab.ts for what a document is.
 *
 * Who may join is decided per document in onAuthenticate, from the account behind
 * the socket — read fresh from the database every time, never trusted from the
 * upgrade alone — and the epoch the browser presents as its token. People who may
 * only read join read-only. Every 30 seconds each open connection is checked again
 * (also ones that only listen); a failed check closes the whole socket, so the
 * browser reconnects and is authorised afresh — or not.
 *
 * Several replicas share documents through Redis (when configured) and all store
 * into the same `cms_collab` row. Who has a document open is then known per replica
 * only, so each replica also lists its open documents in Redis (see `Presence`), and
 * "the last one left" means: no connection here and none listed by another replica.
 */

interface CollabContext {
  user: CmsUser
  /** The name other people see on this person's cursor (from the account, not the browser). */
  displayName: string
  /** The one Yjs client this connection may speak for in cursor (awareness) updates. */
  clientId?: number
  sv: number
  epoch: string
  access: 'write' | 'read'
  checkedAt: number
  checking?: Promise<void>
  target: { entityName: string; id: string; locale: string | null }
}

const RECHECK_MS = 30_000
const HEARTBEAT_MS = 30_000
/** Limits: per message, per stored document, per socket. */
const MAX_UPDATE_BYTES = 1024 * 1024
const MAX_STATE_BYTES = 8 * 1024 * 1024
const MAX_DOCS_PER_SOCKET = 10
// Hocuspocus message types (y-protocols / Hocuspocus numbering).
const AWARENESS = 1
// …and ones this admin never sends.
const STATELESS = 5
const BROADCAST_STATELESS = 6

/** Who is in a document, across replicas: this replica's entries in a Redis sorted set per document. */
const PRESENCE_TTL_MS = 90_000
/** This replica, as the presence lists name it. */
const REPLICA_ID = crypto.randomUUID()

interface Presence {
  /** This replica has a connection in the document (refreshed every heartbeat; expires if the replica dies). */
  here(documentName: string): Promise<void>
  /** This replica has no connection left in the document. */
  left(documentName: string): Promise<void>
  /** Does another replica list a connection in the document? Throws when Redis cannot say. */
  othersHere(documentName: string): Promise<boolean>
  close(): Promise<void>
}

async function createPresence(redisUrl: string, prefix: string): Promise<Presence> {
  const { default: IORedis } = await import('ioredis')
  // Like the shared store: never wait on a Redis that is down (callers fall back to the 90 s window).
  const redis = new IORedis(redisUrl, { protocol: REDIS_PROTOCOL, maxRetriesPerRequest: 1, enableOfflineQueue: false, commandTimeout: 500, connectTimeout: 2_000 })
  redis.on('error', (err) => console.error('[cms] collab presence', err.message))
  const key = (name: string) => `${prefix}:presence:${name}`
  return {
    async here(name) {
      await redis.multi().zadd(key(name), Date.now() + PRESENCE_TTL_MS, REPLICA_ID).pexpire(key(name), PRESENCE_TTL_MS * 2).exec()
    },
    async left(name) {
      await redis.zrem(key(name), REPLICA_ID)
    },
    async othersHere(name) {
      const res = await redis.multi().zremrangebyscore(key(name), '-inf', Date.now()).zrange(key(name), 0, '-1').exec()
      const [err, members] = res?.[1] ?? [new Error('empty transaction result'), null]
      if (err || !Array.isArray(members)) throw err ?? new Error('presence list missing')
      return members.some((m) => m !== REPLICA_ID)
    },
    async close() {
      await redis.quit().catch(() => redis.disconnect())
    },
  }
}

let presence: Presence | null = null

let instance: Hocuspocus | null = null
let starting: Promise<Hocuspocus> | null = null
let heartbeat: ReturnType<typeof setInterval> | null = null
let lastPurge = 0
/** The heartbeat while it runs: a document's last tab waits for it before marking the document idle. */
let beating: Promise<void> | null = null
/** The epoch each loaded document belongs to (what it may store into). */
const loadedEpoch = new Map<string, string>()
/** Documents opened on each socket. */
const docsBySocket = new Map<string, Set<string>>()

export function useCollabServer(): Promise<Hocuspocus> {
  starting ??= startCollabServer().catch((err) => {
    starting = null
    throw err
  })
  return starting
}

/** Close a whole socket: the browser reconnects and is authorised afresh. */
function dropSocket(ws: any, code = 4401, reason = 'Not permitted') {
  try {
    ws?.close?.(code, reason)
  }
  catch { /* already closing */ }
}

/** Is this account still allowed this document, and with which access? */
async function recheck(ctx: CollabContext): Promise<'write' | 'read' | null> {
  const u = await activeAccount(ctx.user.id, ctx.sv)
  if (!u || u.role !== ctx.user.role) return null
  const target = parseCollabName(collabName(ctx.target.entityName, ctx.target.id, ctx.target.locale))
  return target ? collabAccess({ ...ctx.user, role: u.role }, target) : null
}

/** Reads the lib0 encoding Hocuspocus messages use (varUint, length-prefixed strings). */
function reader(bytes: Uint8Array) {
  let pos = 0
  const varUint = () => {
    let n = 0
    let mult = 1
    while (pos < bytes.length) {
      const b = bytes[pos++]!
      n += (b & 0x7F) * mult
      if (b < 0x80) return n
      mult *= 128
    }
    throw new Error('truncated')
  }
  const bytesOf = () => {
    const len = varUint()
    if (pos + len > bytes.length) throw new Error('truncated')
    const out = bytes.subarray(pos, pos + len)
    pos += len
    return out
  }
  return { varUint, bytesOf, string: () => new TextDecoder().decode(bytesOf()) }
}

/** A message's type and the rest of it: after the document name. */
function parseMessage(update: Uint8Array): { type: number; body: ReturnType<typeof reader> } | null {
  try {
    const r = reader(update)
    r.bytesOf() // document name
    return { type: r.varUint(), body: r }
  }
  catch {
    return null
  }
}

/**
 * A cursor (awareness) update is accepted when its own entry — this connection's
 * Yjs client, the first one it announced — carries the account's own name, and any
 * other entries are echoes (a browser answering "who is here?" repeats everyone it
 * knows): not newer than what the server already has, and not removing anyone. So
 * nobody can pass as someone else, or move or remove other people's cursors.
 */
function awarenessAllowed(ctx: CollabContext, body: ReturnType<typeof reader>, awareness: any): boolean {
  try {
    const r = reader(body.bytesOf())
    const count = r.varUint()
    if (count > 200) return false
    const entries: { clientId: number; clock: number; state: any }[] = []
    for (let i = 0; i < count; i++) entries.push({ clientId: r.varUint(), clock: r.varUint(), state: JSON.parse(r.string()) })
    if (ctx.clientId === undefined && entries.length === 1) ctx.clientId = entries[0]!.clientId
    for (const e of entries) {
      if (e.clientId === ctx.clientId) {
        // No `user` yet (the first, empty state) is fine; a name must be the account's.
        if (e.state?.user !== undefined && e.state.user?.name !== ctx.displayName) return false
        continue
      }
      const known = awareness?.meta?.get(e.clientId)
      if (!known) return false
      if (e.clock > known.clock) return false
      if (e.clock === known.clock && e.state === null) return false
    }
    return true
  }
  catch {
    return false
  }
}

async function startCollabServer(): Promise<Hocuspocus> {
  const extensions: any[] = []
  const redisUrl = String((useRuntimeConfig().cms as any)?.redis?.url || process.env.REDIS_URL || '')
  if (redisUrl) {
    const [{ Redis: RedisExtension }, { default: IORedis }] = await Promise.all([import('@hocuspocus/extension-redis'), import('ioredis')])
    extensions.push(new RedisExtension({ createClient: () => new IORedis(redisUrl, { protocol: REDIS_PROTOCOL, maxRetriesPerRequest: null }) as any, prefix: `${cmsStorePrefix()}:collab` } as any))
  }

  // "Nobody has it open" is known the moment the last tab leaves: with one instance
  // from its own connections, with several (Redis) from the replicas' presence lists.
  // If Redis cannot say, only the 90 s activity window does.
  presence = redisUrl ? await createPresence(redisUrl, `${cmsStorePrefix()}:collab`).catch((err) => {
    console.error('[cms] collab presence unavailable', safeErrorMessage(err))
    return null
  }) : null
  const redisPresence = presence
  /** Does anyone have the document open (here, or on another replica)? A guess of yes when unsure. */
  const occupied = async (document: { name: string; getConnectionsCount(): number }): Promise<boolean> => {
    if (document.getConnectionsCount() > 0) return true
    if (redisUrl && !redisPresence) return true
    if (!redisPresence) return false
    try {
      return await redisPresence.othersHere(document.name)
    }
    catch {
      return true
    }
  }
  const server: Hocuspocus = new Hocuspocus({
    name: 'cms',
    extensions,
    // Store a few seconds after typing stops, and at least every 15 s while it goes on.
    debounce: 3_000,
    maxDebounce: 15_000,
    quiet: true,

    async onAuthenticate({ documentName, token, context, connectionConfig, socketId }) {
      const socketUser = context?.user as CmsUser | undefined
      if (!socketUser) throw new Error('Not signed in')
      const target = parseCollabName(documentName)
      // Only the canonical spelling of a name.
      if (!target || target.name !== documentName) throw new Error('Unknown document')
      // The account as it is now (disabled, demoted, signed out everywhere?).
      const u = await activeAccount(socketUser.id, context.sv)
      if (!u) throw new Error('Session no longer valid')
      const user: CmsUser = { ...socketUser, role: u.role, name: u.name || socketUser.name }
      const access = await collabAccess(user, target)
      if (!access) throw new Error('Not permitted')
      const docs = docsBySocket.get(socketId) ?? new Set<string>()
      if (!docs.has(documentName) && docs.size >= MAX_DOCS_PER_SOCKET) throw new Error('Too many documents on one socket')
      const { db, reg } = useCms()
      const [row] = await db.select({ epoch: reg.cmsCollab.epoch }).from(reg.cmsCollab).where(eq(reg.cmsCollab.name, target.name))
      // An older history (or none): the browser starts over with a fresh session.
      if (!row || row.epoch !== token) throw new Error('Stale document')
      // Loaded here from an older history (restarted meanwhile): unload it first, so
      // this connection gets the current one.
      const loaded = loadedEpoch.get(documentName)
      if (loaded && loaded !== row.epoch) {
        const doc = server.documents.get(documentName)
        // Nobody is in it: it only waits to be unloaded (with Redis, a second after the last
        // tab left). Unload it now and let this connection load the current history.
        if (doc && doc.getConnectionsCount() === 0) await server.unloadDocument(doc)
        if (loadedEpoch.get(documentName) === loaded) {
          // Still in use by others: they are sent away, and this connection comes back for the current one.
          server.closeConnections(documentName)
          if (doc) await server.unloadDocument(doc)
          throw new Error('Stale document')
        }
      }
      docs.add(documentName)
      docsBySocket.set(socketId, docs)
      if (access === 'read') connectionConfig.readOnly = true
      return { user, displayName: displayName(u.name, u.email), sv: context.sv, epoch: row.epoch, access, checkedAt: Date.now(), target: { entityName: target.entity.name, id: target.id, locale: target.locale } } satisfies CollabContext
    },

    async onLoadDocument({ documentName, document, context }) {
      const { db, reg } = useCms()
      const [row] = await db.select().from(reg.cmsCollab).where(eq(reg.cmsCollab.name, documentName))
      if (!row) throw new Error('No such document')
      // Restarted between the check and the load: refuse, the browser starts over.
      if (context?.epoch && row.epoch !== context.epoch) throw new Error('Stale document')
      loadedEpoch.set(documentName, row.epoch)
      Y.applyUpdate(document, decodeState(row.state))
      await db.update(reg.cmsCollab).set({ activeAt: sql`now()` }).where(eq(reg.cmsCollab.name, documentName))
      return document
    },

    async onStoreDocument({ documentName, document, lastContext }) {
      const epoch = loadedEpoch.get(documentName)
      if (!epoch) return
      const state = encodeState(document)
      if (state.length > MAX_STATE_BYTES) {
        console.error(`[cms] collab: ${documentName} grew past ${MAX_STATE_BYTES} bytes; not stored, connections closed`)
        server.closeConnections(documentName)
        return
      }
      const { db, reg } = useCms()
      const c = reg.cmsCollab
      // Only into the history it came from: a document restarted meanwhile is not overwritten.
      // An error is thrown on: Hocuspocus keeps the document loaded and tries again.
      // Active while someone has it open; the last save after everyone left does not make it so.
      const active = await occupied(document)
      const stored: any[] = await db.update(c).set({ state, updatedAt: sql`now()`, activeAt: active ? sql`now()` : null })
        .where(and(eq(c.name, documentName), eq(c.epoch, epoch))).returning({ name: c.name })
      // Who typed last: shown with text that is left behind unsaved. (The context of the
      // connection behind the last change; empty for one that came from another replica.)
      const typist = (lastContext as CollabContext | undefined)?.displayName
      if (stored.length && typist) await noteCollabEditor(documentName, typist).catch(() => {})
      if (!stored.length) {
        // Restarted (or deleted) meanwhile: what is loaded here is an old history.
        console.warn(`[cms] collab: ${documentName} was restarted elsewhere; closing its old copy here`)
        server.closeConnections(documentName)
      }
    },

    async connected({ documentName }) {
      await redisPresence?.here(documentName).catch(() => {})
    },

    async afterUnloadDocument({ documentName }) {
      loadedEpoch.delete(documentName)
    },

    async onDisconnect({ socketId, documentName, clientsCount }) {
      const docs = docsBySocket.get(socketId)
      docs?.delete(documentName)
      if (docs && !docs.size) docsBySocket.delete(socketId)
      // The last one left: nobody has it open now (not for another minute and a half).
      if (clientsCount === 0) {
        // A heartbeat that counted this tab as a writer may still be writing "being edited":
        // let it finish first, or it would land after "idle" and stay there.
        await beating?.catch(() => {})
        if (redisPresence) {
          // Leave the list first: of two replicas losing their last tab at once, the later one sees it empty.
          await redisPresence.left(documentName).catch(() => {})
          if (await redisPresence.othersHere(documentName).catch(() => true)) return
        }
        else if (redisUrl) return
        const { db, reg } = useCms()
        await db.update(reg.cmsCollab).set({ activeAt: null }).where(eq(reg.cmsCollab.name, documentName)).catch(() => {})
      }
    },

    async beforeHandleMessage({ context, update, connection, document }) {
      const ctx = context as CollabContext
      if (update.length > MAX_UPDATE_BYTES) {
        dropSocket(connection.webSocket, 1009, 'Message too large')
        throw new Error('Message too large')
      }
      const message = parseMessage(update)
      if (!message || message.type === STATELESS || message.type === BROADCAST_STATELESS) {
        dropSocket(connection.webSocket, 4400, 'Unsupported message')
        throw new Error('Unsupported message')
      }
      if (message.type === AWARENESS && !awarenessAllowed(ctx, message.body, document.awareness)) {
        dropSocket(connection.webSocket, 4403, 'Not your cursor')
        throw new Error('Cursor update for someone else')
      }
      // Messages wait for a check in progress, so none slips past a revocation.
      if (ctx.checking) await ctx.checking
      if (Date.now() - ctx.checkedAt < RECHECK_MS) return
      ctx.checking = (async () => {
        const access = await recheck(ctx)
        ctx.checkedAt = Date.now()
        if (!access || (ctx.access === 'write' && access !== 'write')) {
          dropSocket(connection.webSocket)
          throw new Error('Not permitted any more')
        }
      })().finally(() => { ctx.checking = undefined })
      await ctx.checking
    },
  })
  instance = server

  heartbeat ??= setInterval(() => {
    if (beating) return
    beating = beat().finally(() => { beating = null })
  }, cmsTimerMs('CMS_TEST_COLLAB_HEARTBEAT_MS', HEARTBEAT_MS))
  ;(heartbeat as any).unref?.()
  return server
}

/**
 * Every 30 s: re-check every open connection (also ones that only listen), mark
 * documents someone is editing as active (they are never restarted under them), and
 * now and then forget documents nobody touched for a month.
 */
async function beat() {
  const server = instance
  if (!server) return
  const { db, reg } = useCms()
  const editing: string[] = []
  for (const doc of server.documents.values()) {
    let writers = 0
    for (const conn of doc.getConnections()) {
      const ctx = conn.context as CollabContext | undefined
      if (!ctx?.user) continue
      try {
        const access = await recheck(ctx)
        ctx.checkedAt = Date.now()
        if (!access || (ctx.access === 'write' && access !== 'write')) {
          dropSocket(conn.webSocket)
          continue
        }
      }
      catch (err) {
        console.error('[cms] collab re-check failed', safeErrorMessage(err))
      }
      if (!conn.readOnly) writers++
    }
    if (writers) editing.push(doc.name)
    // Keep this replica's place in the document's presence list from expiring.
    if (presence && doc.getConnectionsCount() > 0) await presence.here(doc.name).catch(() => {})
  }
  try {
    // Only documents that still have a writer now: the re-checks above wait on the database,
    // and a last tab that left meanwhile has marked its document idle.
    const stillEditing = editing.filter((name) => [...(server.documents.get(name)?.getConnections() ?? [])].some((c: any) => !c.readOnly))
    if (stillEditing.length) await db.update(reg.cmsCollab).set({ activeAt: sql`now()` }).where(inArray(reg.cmsCollab.name, stillEditing))
    if (Date.now() - lastPurge > 60 * 60_000) {
      lastPurge = Date.now()
      await db.delete(reg.cmsCollab).where(sql`${reg.cmsCollab.updatedAt} < now() - interval '30 days' and (${reg.cmsCollab.activeAt} is null or ${reg.cmsCollab.activeAt} < now() - interval '1 day')`)
    }
  }
  catch (err) {
    console.error('[cms] collab heartbeat failed', safeErrorMessage(err))
  }
}

/**
 * Forget the shared documents of a deleted entry (or one deleted translation): their
 * text must not outlive it, and nobody may keep typing into it.
 */
export async function dropCollabDocuments(entity: string, id: string, locale?: string | null): Promise<void> {
  const name = collabName(entity, id, locale ?? null)
  try {
    const { db, reg } = useCms()
    const c = reg.cmsCollab
    // The document, its side rows (left-over text, last typist), and a translation's own.
    const names: string[] = locale
      ? [name, `${name}~unsaved`, `${name}~by`]
      : (await db.select({ name: c.name }).from(c).where(sql`${c.name} = ${name} or starts_with(${c.name}, ${name + '/'}) or starts_with(${c.name}, ${name + '~'})`)).map((r: any) => r.name)
    if (!names.length) return
    await db.delete(c).where(inArray(c.name, names))
    for (const n of names) instance?.closeConnections(n)
  }
  catch (err) {
    console.error('[cms] collab: could not drop documents of', name, safeErrorMessage(err))
  }
}

export async function stopCollabServer(): Promise<void> {
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  const server = instance
  instance = null
  starting = null
  const p = presence
  presence = null
  if (!server) {
    await p?.close()
    return
  }
  server.closeConnections()
  // Store what is still pending, then let extensions (Redis) close their clients.
  await Promise.allSettled([...server.documents.values()].map((d) => server.storeDocumentHooks(d, { clientsCount: 0, lastContext: {}, lastTransactionOrigin: null, document: d, documentName: d.name, instance: server }, true)))
  await Promise.resolve(server.hooks('onDestroy', { instance: server } as any)).catch(() => {})
  await p?.close()
}
