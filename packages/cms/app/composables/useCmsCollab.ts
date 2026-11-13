import type { Ref } from 'vue'

/**
 * Shared editing for one open entry (or one translation): the rich-text fields are
 * typed in together, with everyone's cursor shown. Server side: cmsCollab.ts and
 * cmsCollabServer.ts.
 *
 * The page provides this as `cmsCollab`; the rich-text field picks it up when its
 * field is one of `fields`. Until the shared document is ready the field shows that
 * it is connecting; if it cannot be reached (`status` 'off') the fields edit on
 * their own, exactly as before.
 */
export interface CmsCollab {
  status: Ref<'connecting' | 'ready' | 'off'>
  /** Bumped when the document restarts (a newer history replaced ours): editors remount. */
  generation: Ref<number>
  readOnly: Ref<boolean>
  fields: Ref<Set<string>>
  epoch: Ref<string | null>
  /** Text typed here while offline that the restarted document could not take back. */
  lost: Ref<Record<string, any> | null>
  /** Fields whose shared editor is on the page right now (a collapsed group has none). */
  mounted: Ref<Set<string>>
  /** Current Yjs document and provider (non-reactive on purpose). */
  current: () => { doc: any; provider: any } | null
  /** Put a value into a shared field, for everyone (an explicit choice: load, copy). */
  set: (field: string, value: any) => boolean
  /** Used by the shared editors to offer `set`. */
  setters: Map<string, (value: any) => void>
  user: { name: string; color: string }
}

const COLORS = ['#e5484d', '#f76b15', '#ffc53d', '#46a758', '#12a594', '#0090ff', '#8e4ec6', '#d6409f']
const colorOf = (id: string) => COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]!

export function useCmsCollab(opts: { entity: string; id: string; locale: string | null }): CmsCollab {
  const { user } = useUserSession()
  const me = (user.value ?? {}) as { id?: string; name?: string; email?: string }
  const collab: CmsCollab = {
    status: ref(import.meta.server ? 'connecting' : 'connecting'),
    generation: ref(0),
    readOnly: ref(false),
    fields: ref(new Set<string>()),
    epoch: ref(null),
    mounted: ref(new Set<string>()),
    lost: ref(null),
    current: () => live,
    setters: new Map(),
    set: (field, value) => {
      const fn = collab.setters.get(field)
      if (!fn) return false
      fn(value)
      return true
    },
    user: { name: me.name || (me.email ?? '').split('@')[0] || '?', color: colorOf(me.id ?? 'x') },
  }
  provide('cmsCollab', collab)
  if (import.meta.server) return collab

  let live: { doc: any; provider: any; socket: any } | null = null
  let disposed = false
  let restarts = 0
  let syncTimer: ReturnType<typeof setTimeout> | null = null
  const base = (useRuntimeConfig().app.baseURL || '/').replace(/\/+$/, '')

  function teardown() {
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = null
    live?.provider.destroy()
    live?.socket.destroy()
    live?.doc.destroy()
    live = null
  }

  async function start() {
    const q = new URLSearchParams({ entity: opts.entity, id: opts.id, ...(opts.locale ? { locale: opts.locale } : {}) })
    let session: { name: string; epoch: string; fields: string[]; access: 'write' | 'read'; you?: string }
    try {
      session = await $fetch(`/api/cms/_collab/session?${q}`)
    }
    catch {
      collab.status.value = 'off' // nothing to share, not permitted, or unavailable
      return
    }
    if (disposed) return
    // The server checks the name on our cursor against the account: use its spelling.
    if (session.you) collab.user.name = session.you
    const [{ HocuspocusProvider, HocuspocusProviderWebsocket }, Y] = await Promise.all([import('@hocuspocus/provider'), import('yjs')])
    if (disposed) return
    const doc = new Y.Doc()
    const socket = new HocuspocusProviderWebsocket({
      url: (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + base + '/api/cms/_collab/socket',
      autoConnect: false,
    })
    const provider = new HocuspocusProvider({
      websocketProvider: socket,
      name: session.name,
      document: doc,
      token: session.epoch,
      onSynced: () => {
        if (syncTimer) clearTimeout(syncTimer)
        restarts = 0
        collab.status.value = 'ready'
      },
      onAuthenticationFailed: async () => {
        // Our history is no longer the document's (it restarted from a newer save
        // while we were away), or access changed: start over, a couple of times —
        // keeping a copy of anything typed here that never reached the others.
        const old = live
        if (old?.provider.hasUnsyncedChanges) {
          const { yXmlFragmentToProsemirrorJSON } = await import('@tiptap/y-tiptap')
          const keep: Record<string, any> = {}
          for (const key of collab.fields.value) keep[key] = yXmlFragmentToProsemirrorJSON(old.doc.getXmlFragment(key))
          collab.lost.value = keep
        }
        if (live !== old) return
        teardown()
        if (disposed) return
        if (++restarts > 2) {
          collab.status.value = 'off'
          return
        }
        collab.status.value = 'connecting'
        collab.generation.value++
        void start()
      },
    })
    provider.attach()
    // A refused or failed connection is handled by the timeout below (and retried by
    // the provider); it must not surface as an unhandled rejection.
    socket.connect().catch(() => {})
    live = { doc, provider, socket }
    collab.fields.value = new Set(session.fields)
    collab.readOnly.value = session.access === 'read'
    collab.epoch.value = session.epoch
    // Not reachable (a proxy without WebSockets): edit on our own after a few seconds.
    if (collab.status.value !== 'ready') {
      syncTimer = setTimeout(() => {
        if (collab.status.value === 'ready') return
        teardown()
        collab.status.value = 'off'
      }, 6_000)
    }
  }

  onMounted(() => { void start() })
  onScopeDispose(() => {
    disposed = true
    teardown()
  })
  return collab
}
