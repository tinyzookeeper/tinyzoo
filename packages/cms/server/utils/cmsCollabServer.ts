import { and, eq, inArray } from '@my-cms/core'
import { Hocuspocus } from '@hocuspocus/server'
import * as Y from 'yjs'

/**
 * The shared-editing engine (Hocuspocus), on the app's own port: it opens no server
 * of its own — api/cms/_collab/socket.ts hands it sockets Nitro already accepted.
 * See cmsCollab.ts for what a document is.
 *
 * Who may join is decided per document in onAuthenticate, from the account the
 * socket was opened with (its signed session, checked at the upgrade) and the epoch
 * the browser presents as its token. People who may only read join read-only. The
 * account and access are re-checked every 30 seconds while messages flow.
 *
 * Several replicas share documents through Redis (when configured) and all store
 * into the same `cms_collab` row.
 */

interface CollabContext { user: CmsUser; sv: number; access: 'write' | 'read'; checkedAt: number; target: { entityName: string; id: string; locale: string | null } }

const RECHECK_MS = 30_000
const HEARTBEAT_MS = 30_000

let instance: Hocuspocus | null = null
let starting: Promise<Hocuspocus> | null = null
let heartbeat: ReturnType<typeof setInterval> | null = null
/** The epoch each loaded document belongs to (what it may store into). */
const loadedEpoch = new Map<string, string>()

export function useCollabServer(): Promise<Hocuspocus> {
  starting ??= startCollabServer().catch((err) => {
    starting = null
    throw err
  })
  return starting
}

async function startCollabServer(): Promise<Hocuspocus> {
  const extensions: any[] = []
  const redisUrl = String((useRuntimeConfig().cms as any)?.redis?.url || process.env.REDIS_URL || '')
  if (redisUrl) {
    const [{ Redis: RedisExtension }, { default: IORedis }] = await Promise.all([import('@hocuspocus/extension-redis'), import('ioredis')])
    extensions.push(new RedisExtension({ createClient: () => new IORedis(redisUrl, { maxRetriesPerRequest: null }) as any, prefix: `${cmsStorePrefix()}:collab` } as any))
  }

  instance = new Hocuspocus({
    name: 'cms',
    extensions,
    // Store a few seconds after typing stops, and at least every 15 s while it goes on.
    debounce: 3_000,
    maxDebounce: 15_000,
    quiet: true,

    async onAuthenticate({ documentName, token, context, connectionConfig }) {
      const user = context?.user as CmsUser | undefined
      if (!user) throw new Error('Not signed in')
      const target = parseCollabName(documentName)
      if (!target) throw new Error('Unknown document')
      const access = await collabAccess(user, target)
      if (!access) throw new Error('Not permitted')
      const { db, reg } = useCms()
      const [row] = await db.select({ epoch: reg.cmsCollab.epoch }).from(reg.cmsCollab).where(eq(reg.cmsCollab.name, target.name))
      // An older history (or none): the browser starts over with a fresh session.
      if (!row || row.epoch !== token) throw new Error('Stale document')
      if (access === 'read') connectionConfig.readOnly = true
      return { ...context, access, checkedAt: Date.now(), target: { entityName: target.entity.name, id: target.id, locale: target.locale } } satisfies CollabContext
    },

    async onLoadDocument({ documentName, document }) {
      const { db, reg } = useCms()
      const [row] = await db.select().from(reg.cmsCollab).where(eq(reg.cmsCollab.name, documentName))
      if (!row) throw new Error('No such document')
      loadedEpoch.set(documentName, row.epoch)
      Y.applyUpdate(document, decodeState(row.state))
      await db.update(reg.cmsCollab).set({ activeAt: new Date() }).where(eq(reg.cmsCollab.name, documentName))
      return document
    },

    async onStoreDocument({ documentName, document }) {
      const epoch = loadedEpoch.get(documentName)
      if (!epoch) return
      const { db, reg } = useCms()
      const c = reg.cmsCollab
      try {
        // Only into the history it came from: a document restarted meanwhile is not overwritten.
        await db.update(c).set({ state: encodeState(document), updatedAt: new Date(), activeAt: new Date() })
          .where(and(eq(c.name, documentName), eq(c.epoch, epoch)))
      }
      catch (err) {
        // The next change tries again; nothing is lost while the document stays loaded.
        console.error(`[cms] collab: could not store ${documentName}`, (err as Error)?.message ?? err)
      }
    },

    async afterUnloadDocument({ documentName }) {
      loadedEpoch.delete(documentName)
    },

    async beforeHandleMessage({ context }) {
      const ctx = context as CollabContext
      if (Date.now() - ctx.checkedAt < RECHECK_MS) return
      ctx.checkedAt = Date.now()
      // The account may have been disabled, demoted or signed out everywhere.
      const u = await activeAccountOf({ cms: { uid: ctx.user.id, sv: ctx.sv } })
      if (!u || u.role !== ctx.user.role) throw new Error('Session no longer valid')
      const target = parseCollabName(collabName(ctx.target.entityName, ctx.target.id, ctx.target.locale))
      const access = target ? await collabAccess(ctx.user, target) : null
      // Lost access, or may no longer write while still sending edits: drop it.
      if (!access || (ctx.access === 'write' && access !== 'write')) throw new Error('Not permitted any more')
    },
  })

  // While anyone has a document open, say so: it is never restarted under them.
  heartbeat ??= setInterval(() => {
    const open = [...(instance?.documents.values() ?? [])].filter((d) => d.getConnectionsCount() > 0).map((d) => d.name)
    if (!open.length) return
    const { db, reg } = useCms()
    db.update(reg.cmsCollab).set({ activeAt: new Date() }).where(inArray(reg.cmsCollab.name, open))
      .catch((err: unknown) => console.error('[cms] collab heartbeat failed', (err as Error)?.message ?? err))
  }, HEARTBEAT_MS)
  ;(heartbeat as any).unref?.()
  return instance
}

export async function stopCollabServer(): Promise<void> {
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  if (instance) {
    instance.closeConnections()
    // Store what is still pending before the process goes.
    await Promise.allSettled([...instance.documents.values()].map((d) => instance!.storeDocumentHooks(d, { clientsCount: 0, context: {}, document: d, documentName: d.name, instance: instance!, requestHeaders: {}, requestParameters: new URLSearchParams(), socketId: 'shutdown' } as any, true)))
  }
  instance = null
  starting = null
}
