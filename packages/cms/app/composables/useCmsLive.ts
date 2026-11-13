import type { Ref } from 'vue'

/**
 * The admin's realtime connection: one WebSocket per tab (/api/cms/_live), opened
 * on first use, reconnecting with backoff, and re-sending what this tab watches
 * after a reconnect. Server side: server/utils/cmsLive.ts.
 *
 * Realtime is an extra: when the socket cannot connect (an edge deployment without
 * WebSockets, a proxy that blocks them), the admin works exactly as before.
 */
export interface LivePerson { id: string; name: string; editing: boolean }
export interface LiveChange {
  type: string
  entity: string
  id: string | null
  locale: string | null
  version: string | null
  by: string | null
  byName: string | null
  at: string
}

interface TopicState {
  people: Ref<LivePerson[]>
  editing: boolean
  listeners: Set<(c: LiveChange) => void>
  users: number
}

let socket: WebSocket | null = null
let retry = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
const topics = new Map<string, TopicState>()
const connected = ref(false)

function send(msg: unknown) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg))
}

function connect() {
  if (import.meta.server || socket || !topics.size) return
  const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/cms/_live`
  const ws = new WebSocket(url)
  socket = ws
  ws.addEventListener('open', () => {
    retry = 0
    connected.value = true
    for (const [topic, st] of topics) {
      send({ type: 'watch', topic })
      if (st.editing) send({ type: 'editing', topic, editing: true })
    }
  })
  ws.addEventListener('message', (ev) => {
    let msg: any
    try {
      msg = JSON.parse(String(ev.data))
    }
    catch {
      return
    }
    const st = topics.get(msg?.topic)
    if (!st) return
    if (msg.type === 'presence' && Array.isArray(msg.people)) st.people.value = msg.people
    else if (msg.type === 'change' && msg.change) for (const fn of st.listeners) fn(msg.change)
  })
  ws.addEventListener('close', (ev) => {
    if (socket === ws) socket = null
    connected.value = false
    for (const st of topics.values()) st.people.value = []
    if (!topics.size) return
    // Signed out / not allowed: do not hammer the server.
    if (ev.code === 1008 || ev.code === 4401) retry = Math.max(retry, 5)
    const delay = Math.min(30_000, 1000 * 2 ** retry++) * (0.75 + Math.random() / 2)
    retryTimer = setTimeout(() => {
      retryTimer = null
      connect()
    }, delay)
  })
}

function disconnectIfIdle() {
  if (topics.size) return
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  socket?.close()
  socket = null
}

/**
 * Watch a topic ('list:post', 'entry:post:<id>') for as long as the calling
 * component lives. `people` includes the current user (filter them out for display).
 */
export function useCmsLiveTopic(topic: string, onChange?: (c: LiveChange) => void) {
  // On the server this module's state would be shared by every request: render
  // without realtime and let the browser connect.
  if (import.meta.server) return { people: ref<LivePerson[]>([]), connected: ref(false), setEditing(_: boolean) {} }
  let st = topics.get(topic)
  if (!st) {
    st = { people: ref([]), editing: false, listeners: new Set(), users: 0 }
    topics.set(topic, st)
  }
  const state = st
  {
    state.users++
    if (onChange) state.listeners.add(onChange)
    if (socket?.readyState === WebSocket.OPEN && state.users === 1) send({ type: 'watch', topic })
    connect()
    onScopeDispose(() => {
      if (onChange) state.listeners.delete(onChange)
      if (--state.users > 0) return
      topics.delete(topic)
      send({ type: 'unwatch', topic })
      disconnectIfIdle()
    })
  }
  return {
    people: state.people,
    connected,
    setEditing(editing: boolean) {
      if (state.editing === editing) return
      state.editing = editing
      send({ type: 'editing', topic, editing })
    },
  }
}

/**
 * Realtime for one open entry (or global): who else is here, and what to do when
 * someone else saves it. A change in this tab's language that is not this tab's own
 * save either reloads quietly (nothing unsaved here) or becomes `incoming` for the
 * page to offer a reload. Deletion sets `deleted`.
 */
export function useCmsEntryLive(opts: {
  entity: string
  id: string
  /** The version (updatedAt) this tab has. */
  version: Ref<string | null>
  dirty: Ref<boolean>
  /** True while this tab saves: its own change may arrive before the save's answer. */
  saving: Ref<boolean>
  /** The language this tab edits: null = the entry itself. */
  locale: Ref<string | null>
  /** Load the newest version quietly (nothing unsaved here); `c` is what changed. */
  reload: (c: LiveChange) => Promise<void>
}) {
  const { user } = useUserSession()
  const me = computed(() => (user.value as any)?.id as string | undefined)
  const incoming = ref<LiveChange | null>(null)
  const deleted = ref<LiveChange | null>(null)

  const { people, setEditing } = useCmsLiveTopic(`entry:${opts.entity}:${opts.id}`, async (c) => {
    if (c.type === 'entry.deleted') {
      deleted.value = c
      return
    }
    if (opts.saving.value) await new Promise<void>((resolve) => {
      const stop = watch(opts.saving, (s) => {
        if (s) return
        stop()
        resolve()
      })
    })
    // Translations are separate: only the language this tab edits matters.
    const isTranslation = c.type.startsWith('translation.')
    if (isTranslation ? c.locale !== opts.locale.value : opts.locale.value !== null) return
    // Our own save, echoed back.
    if (!isTranslation && c.version && c.version === opts.version.value) return
    if (opts.dirty.value) incoming.value = c
    else await opts.reload(c)
  })

  watch(opts.dirty, (d) => setEditing(d), { immediate: true })

  const others = computed(() => people.value.filter((p) => p.id !== me.value))
  return { others, incoming, deleted }
}
