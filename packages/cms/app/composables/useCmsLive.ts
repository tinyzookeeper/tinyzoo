import type { Ref } from 'vue'

/**
 * The admin's realtime connection: one WebSocket per tab (/api/cms/_live), opened
 * on first use, reconnecting with backoff, and re-sending what this tab watches
 * after a reconnect. Server side: server/utils/cmsLive.ts.
 *
 * Realtime is an extra: when the socket cannot connect (a proxy that blocks
 * WebSockets), the admin works exactly as before.
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
/** Has a socket ever opened in this tab (a reconnect means changes may have been missed). */
let everOpened = false
/** Failed attempts in a row without ever opening: the server does not offer realtime. */
let failedInARow = 0
const topics = new Map<string, TopicState>()
/** The app's base path, read once in a component's setup (reconnects run outside it). */
let baseURL = ''
const connected = ref(false)

/** A change notice made up locally after a reconnect: "check whether you missed something". */
const resync = (): LiveChange => ({ type: 'resync', entity: '', id: null, locale: null, version: null, by: null, byName: null, at: new Date().toISOString() })

function send(msg: unknown) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg))
}

function connect() {
  if (import.meta.server || socket || !topics.size) return
  const url = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + baseURL + '/api/cms/_live'
  const ws = new WebSocket(url)
  socket = ws
  let opened = false
  ws.addEventListener('open', () => {
    if (socket !== ws) return
    const reconnect = everOpened
    opened = true
    everOpened = true
    retry = 0
    failedInARow = 0
    connected.value = true
    for (const [topic, st] of topics) {
      send({ type: 'watch', topic, editing: st.editing })
      // Whatever was saved while we were away arrived nowhere: ask everyone to check.
      if (reconnect) for (const fn of st.listeners) fn(resync())
    }
  })
  ws.addEventListener('message', (ev) => {
    if (socket !== ws) return
    let msg: any
    try {
      msg = JSON.parse(String(ev.data))
    }
    catch {
      return
    }
    if (msg?.type === 'ping') return send({ type: 'pong' })
    const st = topics.get(msg?.topic)
    if (!st) return
    if (msg.type === 'presence' && Array.isArray(msg.people)) st.people.value = msg.people
    else if (msg.type === 'change' && msg.change) for (const fn of st.listeners) fn(msg.change)
  })
  ws.addEventListener('close', (ev) => {
    // A socket we already replaced or gave up says nothing about the current one.
    if (socket !== ws) return
    socket = null
    connected.value = false
    for (const st of topics.values()) st.people.value = []
    if (!topics.size) return
    if (!opened && ++failedInARow >= 5) return // realtime is not offered here; the admin works without it
    // Signed out / not allowed / too many tabs: do not hammer the server.
    if (ev.code === 1008 || ev.code === 4401 || ev.code === 4429) retry = Math.max(retry, 5)
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
  baseURL = (useRuntimeConfig().app.baseURL || '/').replace(/\/+$/, '')
  let st = topics.get(topic)
  if (!st) {
    st = { people: ref([]), editing: false, listeners: new Set(), users: 0 }
    topics.set(topic, st)
  }
  const state = st
  {
    state.users++
    if (onChange) state.listeners.add(onChange)
    if (socket?.readyState === WebSocket.OPEN && state.users === 1) send({ type: 'watch', topic, editing: state.editing })
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
 * Realtime for one open entry (or global): who else is here, and the changes that
 * matter to this tab — someone else's save in the language this tab edits, or a
 * `resync` after a reconnect. The page decides what to do with them (it compares
 * versions after fetching, so nothing typed meanwhile is lost). This tab's own
 * saves, echoed back, are skipped by version. Deletion sets `deleted`.
 */
export function useCmsEntryLive(opts: {
  entity: string
  id: string
  /** The version this tab has: the entry's, or in a translation the translation's. */
  version: Ref<string | null>
  dirty: Ref<boolean>
  /** True while this tab saves: its own change may arrive before the save's answer. */
  saving: Ref<boolean>
  /** The language this tab edits: null = the entry itself. */
  locale: Ref<string | null>
  onChange: (c: LiveChange) => Promise<void> | void
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
    if (c.type !== 'resync') {
      // Translations are separate: only the language this tab edits matters.
      const isTranslation = c.type.startsWith('translation.')
      if (isTranslation ? c.locale !== opts.locale.value : opts.locale.value !== null) return
      // Our own save, echoed back.
      if (c.version && c.version === opts.version.value) return
    }
    await opts.onChange(c)
  })

  watch(opts.dirty, (d) => setEditing(d), { immediate: true })

  const others = computed(() => people.value.filter((p) => p.id !== me.value))
  return { others, incoming, deleted }
}
