import { and, eq, inArray, sql } from '@my-cms/core'
import { Hocuspocus } from '@hocuspocus/server'
import * as Y from 'yjs'

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
 * into the same `cms_collab` row.
 */

interface CollabContext {
  user: CmsUser
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
// Hocuspocus message types this admin never sends (y-protocols / Hocuspocus numbering).
const STATELESS = 5
const BROADCAST_STATELESS = 6

let instance: Hocuspocus | null = null
let starting: Promise<Hocuspocus> | null = null
let heartbeat: ReturnType<typeof setInterval> | null = null
let lastPurge = 0
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
  const u = await activeAccountOf({ cms: { uid: ctx.user.id, sv: ctx.sv } })
  if (!u || u.role !== ctx.user.role) return null
  const target = parseCollabName(collabName(ctx.target.entityName, ctx.target.id, ctx.target.locale))
  return target ? collabAccess({ ...ctx.user, role: u.role }, target) : null
}

/** A message's Hocuspocus type: after the document name (a length-prefixed string). */
function messageType(update: Uint8Array): number | null {
  let pos = 0
  const varUint = () => {
    let n = 0
    let mult = 1
    while (pos < update.length) {
      const b = update[pos++]!
      n += (b & 0x7F) * mult
      if (b < 0x80) return n
      mult *= 128
    }
    return -1
  }
  const nameLength = varUint()
  if (nameLength < 0) return null
  pos += nameLength
  const type = varUint()
  return type < 0 ? null : type
}

async function startCollabServer(): Promise<Hocuspocus> {
  const extensions: any[] = []
  const redisUrl = String((useRuntimeConfig().cms as any)?.redis?.url || process.env.REDIS_URL || '')
  if (redisUrl) {
    const [{ Redis: RedisExtension }, { default: IORedis }] = await Promise.all([import('@hocuspocus/extension-redis'), import('ioredis')])
    extensions.push(new RedisExtension({ createClient: () => new IORedis(redisUrl, { maxRetriesPerRequest: null }) as any, prefix: `${cmsStorePrefix()}:collab` } as any))
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
      const u = await activeAccountOf({ cms: { uid: socketUser.id, sv: context.sv } })
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
      // this connection gets the current one when it comes back.
      const loaded = loadedEpoch.get(documentName)
      if (loaded && loaded !== row.epoch) {
        const doc = server.documents.get(documentName)
        server.closeConnections(documentName)
        if (doc) await server.unloadDocument(doc)
        throw new Error('Stale document')
      }
      docs.add(documentName)
      docsBySocket.set(socketId, docs)
      if (access === 'read') connectionConfig.readOnly = true
      return { user, sv: context.sv, epoch: row.epoch, access, checkedAt: Date.now(), target: { entityName: target.entity.name, id: target.id, locale: target.locale } } satisfies CollabContext
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

    async onStoreDocument({ documentName, document }) {
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
      const stored: any[] = await db.update(c).set({ state, updatedAt: sql`now()`, activeAt: sql`now()` })
        .where(and(eq(c.name, documentName), eq(c.epoch, epoch))).returning({ name: c.name })
      if (!stored.length) {
        // Restarted (or deleted) meanwhile: what is loaded here is an old history.
        console.warn(`[cms] collab: ${documentName} was restarted elsewhere; closing its old copy here`)
        server.closeConnections(documentName)
      }
    },

    async afterUnloadDocument({ documentName }) {
      loadedEpoch.delete(documentName)
    },

    async onDisconnect({ socketId, documentName }) {
      const docs = docsBySocket.get(socketId)
      docs?.delete(documentName)
      if (docs && !docs.size) docsBySocket.delete(socketId)
    },

    async beforeHandleMessage({ context, update, connection }) {
      const ctx = context as CollabContext
      if (update.length > MAX_UPDATE_BYTES) {
        dropSocket(connection.webSocket, 1009, 'Message too large')
        throw new Error('Message too large')
      }
      const type = messageType(update)
      if (type === STATELESS || type === BROADCAST_STATELESS) {
        dropSocket(connection.webSocket, 4400, 'Unsupported message')
        throw new Error('Unsupported message')
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

  heartbeat ??= setInterval(() => { void beat() }, HEARTBEAT_MS)
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
        console.error('[cms] collab re-check failed', (err as Error)?.message ?? err)
      }
      if (!conn.readOnly) writers++
    }
    if (writers) editing.push(doc.name)
  }
  try {
    if (editing.length) await db.update(reg.cmsCollab).set({ activeAt: sql`now()` }).where(inArray(reg.cmsCollab.name, editing))
    if (Date.now() - lastPurge > 60 * 60_000) {
      lastPurge = Date.now()
      await db.delete(reg.cmsCollab).where(sql`${reg.cmsCollab.updatedAt} < now() - interval '30 days' and (${reg.cmsCollab.activeAt} is null or ${reg.cmsCollab.activeAt} < now() - interval '1 day')`)
    }
  }
  catch (err) {
    console.error('[cms] collab heartbeat failed', (err as Error)?.message ?? err)
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
    const names: string[] = locale
      ? [name]
      : (await db.select({ name: c.name }).from(c).where(sql`${c.name} = ${name} or starts_with(${c.name}, ${name + '/'})`)).map((r: any) => r.name)
    if (!names.length) return
    await db.delete(c).where(inArray(c.name, names))
    for (const n of names) instance?.closeConnections(n)
  }
  catch (err) {
    console.error('[cms] collab: could not drop documents of', name, (err as Error)?.message ?? err)
  }
}

export async function stopCollabServer(): Promise<void> {
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  const server = instance
  instance = null
  starting = null
  if (!server) return
  server.closeConnections()
  // Store what is still pending, then let extensions (Redis) close their clients.
  await Promise.allSettled([...server.documents.values()].map((d) => server.storeDocumentHooks(d, { clientsCount: 0, context: {}, document: d, documentName: d.name, instance: server, requestHeaders: {}, requestParameters: new URLSearchParams(), socketId: 'shutdown' } as any, true)))
  await Promise.resolve(server.hooks('onDestroy', { instance: server } as any)).catch(() => {})
}
