import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { CmsBuilderToPage } from '../../shared/builder'
import {
  cmsEntryFieldAt, cmsPendingBody, cmsPendingChange, cmsPendingKey, cmsPendingPut, cmsPendingRow, cmsPendingText,
  type CmsGraphField, type CmsPendingEntry,
} from '../../shared/builder-pending'

// The editor in the preview (experimental, NUXT_CMS_BUILDER=on), since 2g: the changes made in the page to
// entries of collections and to globals, kept in the page's editor until its one save.
//
// An entry is loaded the first time something of it is changed: the row as its own form loads it, with
// its version and whether this person may save it. A change is a whole top-level field (a text typed in
// an item of a list changes that list). Each change goes to the preview's draft of that entry (POST
// /api/cms/_preview, per person, entity and id, as the sheet beside the page posts it) and the page is told,
// so it shows at once; it is a step of the editor's history; and the editor's save stores every changed
// entry through the entry's own update route, with the version it was loaded at (PATCH for an entry, PUT
// for a global, `?locale=` for a translation), so the same checks, rights and conflict rule apply. A save
// that is refused keeps its change here with the reason; the others are saved.
//
// While an entry is open in the sheet beside the page, its own form holds its changes: what was pending
// here is handed into that form when the sheet opens, and what is changed in the page meanwhile goes to it.

/** What the store needs from the editor around it. */
export interface CmsPendingDeps {
  graph: Ref<any[] | null | undefined>
  /** The language the preview shows, when it is a translation. */
  locale: Ref<string | null>
  t: (key: string, params?: Record<string, unknown>) => string
  fieldLabel: (field: any) => string
  entityLabel: (meta: any) => string
  /** Tell the page (the preview panel, when it is there). */
  send: (message: CmsBuilderToPage) => void
  /** Keep a change as a step of the history. */
  record: (entity: string, id: string, field: string, before: unknown, after: unknown, group: string | null) => void
  /** Forget the steps of an entry. */
  forget: (entity: string, id: string) => void
  notify: (title: string, description?: string) => void
}

/** The sheet beside the page, while it has an entry open: its form takes that entry's changes. */
export interface CmsPendingSheet {
  entity: string
  id: string | null
  set: (at: string[], value: unknown) => void
}

export interface CmsBuilderPendingStore {
  /** The entries and globals with changes waiting, in the order they were first changed. */
  entries: ComputedRef<CmsPendingEntry[]>
  count: ComputedRef<number>
  saving: Readonly<Ref<boolean>>
  /** A plain text typed in the page (`end`: the typing ended, the preview's draft is sent at once). */
  text: (entity: string, id: string, at: string[], value: string, end: boolean) => void
  /** A value changed in its control. */
  set: (entity: string, id: string, at: string[], value: unknown) => void
  /** Put a whole field back (an undo or a redo): no step of the history. */
  put: (entity: string, id: string, field: string, value: unknown) => void
  /** The entry with its changes, loaded when it is not yet (`null`: it is not there, or may not be read). */
  open: (entity: string, id: string) => Promise<CmsPendingEntry | null>
  /** The entry as the store has it now (`null` until loaded). */
  entry: (entity: string, id: string) => CmsPendingEntry | null
  /** Its name for a list: "Oznámení · Dovolená", a global's name. */
  title: (entry: Pick<CmsPendingEntry, 'entity' | 'global' | 'base' | 'values'>) => string
  /** Store every changed entry. Those refused stay, with the reason. */
  save: () => Promise<{ saved: CmsPendingEntry[]; failed: CmsPendingEntry[] }>
  /** Drop the changes of one entry (or of all), and their steps. */
  discard: (entity?: string, id?: string) => void
  /** The sheet opens this entry: its changes leave the store (returned, for the sheet's form) with their steps. */
  handOver: (entity: string, id: string | null) => Record<string, unknown> | null
  /** The entry was saved elsewhere (the sheet): it is loaded again before its next change. */
  reload: (entity: string, id: string | null) => void
  /** The sheet that has an entry open, or `null`. */
  sheet: ShallowRef<CmsPendingSheet | null>
  /** The page loaded anew: tell it what waits. */
  tell: () => void
  /** The editor closes: the preview's drafts of these entries are dropped. */
  dispose: () => void
}

export function createCmsPending(deps: CmsPendingDeps): CmsBuilderPendingStore {
  const cache = shallowRef(new Map<string, CmsPendingEntry>())
  const order = shallowRef<string[]>([])
  /** The entries the server says this person may not save, as the page names them. */
  const locked = new Map<string, { entity: string; id: string }>()
  const sheet = shallowRef<CmsPendingSheet | null>(null)
  const saving = ref(false)
  const loading = new Map<string, Promise<CmsPendingEntry | null>>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  /** The drafts already at the server, by key (the JSON of the changed fields): the same one is not sent twice. */
  const drafted = new Map<string, string>()
  let sending: Promise<unknown> = Promise.resolve()

  const metaOf = (entity: string) => (deps.graph.value ?? []).find((e: any) => e?.name === entity)
  const fieldsOf = (entity: string): CmsGraphField[] => (metaOf(entity)?.fields ?? []).filter((f: any) => f?.key !== metaOf(entity)?.orderField)
  const changed = (e: CmsPendingEntry) => Object.keys(e.values).length > 0
  const entries = computed(() => order.value.map((key) => cache.value.get(key)).filter((e): e is CmsPendingEntry => !!e && changed(e)))
  const count = computed(() => entries.value.length)
  const plain = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
  /** A global is one row: whatever id the page has for it, it is kept under its name. */
  const keyOf = (entity: string, id: string | null) => cmsPendingKey(entity, metaOf(entity)?.singleton ? entity : id ?? '')

  function commit(key: string, entry: CmsPendingEntry | null) {
    const next = new Map(cache.value)
    if (entry) next.set(key, entry)
    else next.delete(key)
    cache.value = next
    if (entry && !order.value.includes(key)) order.value = [...order.value, key]
    if (!entry) order.value = order.value.filter((k) => k !== key)
  }

  /** The language an entry is written in here: the preview's translation when the entry has per-language fields, else the entry itself. */
  function localeFor(meta: any): string | null {
    const code = deps.locale.value
    const locales = meta?.locales as { default: string; all: string[] } | null | undefined
    if (!code || !locales || locales.default === code || !locales.all.includes(code)) return null
    return (meta.fields ?? []).some((f: any) => f.localized) ? code : null
  }

  async function fetchEntry(entity: string, id: string): Promise<CmsPendingEntry | null> {
    const meta = metaOf(entity)
    if (!meta) return null
    const global = !!meta.singleton
    const locale = localeFor(meta)
    const url = global ? `/api/cms/_singleton/${encodeURIComponent(entity)}` : `/api/cms/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`
    const res = await cmsFetch<{ row: Record<string, any> | null; can?: { update?: boolean } }>(url, locale ? { query: { locale } } : undefined).catch(() => null)
    const row = res?.row
    if (!row || typeof row.id !== 'string') return null
    // A translation not written yet shows the default language's value: a change starts from what is shown.
    const base: Record<string, unknown> = { ...row }
    if (locale && row.__defaults && typeof row.__defaults === 'object') {
      for (const f of meta.fields ?? []) if (f.localized && cmsBlank(row[f.key]) && !cmsBlank(row.__defaults[f.key])) base[f.key] = row.__defaults[f.key]
    }
    return {
      entity, id, rowId: row.id, global, locale, base, version: (locale ? row.__version : row.updatedAt) ?? null, values: {},
      can: res?.can?.update !== false && meta.can?.update !== false, error: null,
    }
  }

  function open(entity: string, id: string): Promise<CmsPendingEntry | null> {
    const key = keyOf(entity, id)
    const have = cache.value.get(key)
    if (have) return Promise.resolve(have)
    let waiting = loading.get(key)
    if (!waiting) {
      waiting = fetchEntry(entity, id).then((entry) => {
        if (entry && !cache.value.has(key)) {
          commit(key, entry)
          if (!entry.can) locked.set(key, { entity: entry.entity, id: entry.id })
        }
        return cache.value.get(key) ?? null
      }).finally(() => loading.delete(key))
      loading.set(key, waiting)
    }
    return waiting
  }

  /** What the page hears: the changed fields of each entry (by the id the page has for it) and the entries it may not change. */
  function tell() {
    deps.send({
      type: 'cms:builder:pending',
      entries: entries.value.map((e) => ({ entity: e.entity, id: e.id, values: plain(e.values) })),
      ...(locked.size ? { locked: [...locked.values()] } : {}),
      ...(sheet.value ? { sheet: { entity: sheet.value.entity, id: sheet.value.id } } : {}),
    })
  }

  /** Send an entry's changed fields to the preview's draft (or drop the draft when nothing is changed), then tell the page. */
  function publish(key: string, now: boolean) {
    clearTimeout(timers.get(key))
    const run = () => {
      timers.delete(key)
      sending = sending.then(async () => {
        const entry = cache.value.get(key)
        if (!entry) return
        const json = changed(entry) ? JSON.stringify(entry.values) : ''
        if (drafted.get(key) !== json && (json || drafted.has(key))) {
          const body = { entity: entry.entity, id: entry.rowId, locale: entry.locale, ...(json ? { data: plain(entry.values) } : { clear: true }) }
          await $fetch('/api/cms/_preview', { method: 'POST', body }).catch(() => {})
          if (json) drafted.set(key, json)
          else drafted.delete(key)
        }
        tell()
      })
    }
    if (now) run()
    else timers.set(key, setTimeout(run, 250))
  }

  async function change(entity: string, id: string, at: string[], value: unknown, o: { typed: boolean; now: boolean }) {
    const key = keyOf(entity, id)
    const loaded = await open(entity, id)
    if (!loaded) return
    if (!loaded.can) {
      // The server says this person may not save it: the page stops offering it.
      deps.notify(deps.t('builderPending.cannot'), title(loaded))
      tell()
      return
    }
    // The sheet has this entry open: its own form takes the change.
    const inSheet = sheet.value
    if (inSheet && inSheet.entity === entity && (loaded.global || inSheet.id === id || inSheet.id === loaded.rowId)) {
      inSheet.set(at, value)
      return
    }
    const entry = cache.value.get(key)
    if (!entry) return
    const field = cmsEntryFieldAt(fieldsOf(entity), cmsPendingRow(entry), at)
    if (!field || field.readOnly) return
    const next = o.typed && typeof value === 'string' ? cmsPendingText(field, value) : value
    const step = cmsPendingChange(entry, at, next)
    if (step) {
      commit(key, { ...entry, values: cmsPendingPut(entry, step.key, step.after), error: null })
      deps.record(entity, entry.id, step.key, plain(step.before), plain(step.after), at.join('/'))
    }
    publish(key, o.now)
  }

  function title(entry: Pick<CmsPendingEntry, 'entity' | 'global' | 'base' | 'values'>): string {
    const meta = metaOf(entry.entity)
    const label = deps.entityLabel(meta) || entry.entity
    if (entry.global) return label
    const v = meta?.titleField ? cmsPendingRow(entry)[meta.titleField] : null
    const text = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
    return `${label} · ${text || deps.t('common.untitled')}`
  }

  /** Why a save was refused, in a sentence: a newer version, the fields that are not valid, or the server's word. */
  function reason(err: any, entity: string): string {
    if (err?.data?.data?.code === 'stale') return deps.t('builderPending.stale')
    const issues = err?.data?.data
    if (Array.isArray(issues) && issues.some((i: any) => i?.path?.[0])) {
      const fields = fieldsOf(entity)
      const said = new Set<string>()
      for (const i of issues) {
        const field = fields.find((f) => f.key === i?.path?.[0])
        if (field) said.add(`${deps.fieldLabel(field)}: ${cmsIssueMessage(i, field, deps.t as any)}`)
      }
      if (said.size) return [...said].slice(0, 3).join(' · ')
    }
    return cmsRequestError(err, deps.t as any)
  }

  async function save() {
    const saved: CmsPendingEntry[] = []
    const failed: CmsPendingEntry[] = []
    if (!entries.value.length) return { saved, failed }
    saving.value = true
    // A draft on its way is let through first, so none of them arrives after its entry was saved.
    await sending.catch(() => {})
    try {
      for (const entry of entries.value) {
        const key = keyOf(entry.entity, entry.id)
        clearTimeout(timers.get(key))
        timers.delete(key)
        try {
          const body = plain(cmsPendingBody(entry, fieldsOf(entry.entity)))
          const headers: Record<string, string> = entry.version ? { 'x-cms-version': entry.version } : {}
          const query = entry.locale ? { locale: entry.locale } : undefined
          if (entry.global) await $fetch(`/api/cms/_singleton/${encodeURIComponent(entry.entity)}`, { method: 'PUT', body, headers, query })
          else await $fetch(`/api/cms/${encodeURIComponent(entry.entity)}/${encodeURIComponent(entry.rowId)}`, { method: 'PATCH', body, headers, query })
          saved.push(entry)
          // Saved: what the store had of it is older than the stored row now; it is loaded again before its next change.
          commit(key, null)
          if (drafted.has(key)) {
            await $fetch('/api/cms/_preview', { method: 'POST', body: { entity: entry.entity, id: entry.rowId, locale: entry.locale, clear: true } }).catch(() => {})
            drafted.delete(key)
          }
        }
        catch (err: any) {
          const refused = { ...entry, error: reason(err, entry.entity) }
          commit(key, refused)
          failed.push(refused)
        }
      }
    }
    finally {
      saving.value = false
    }
    await sending.catch(() => {})
    tell()
    return { saved, failed }
  }

  function discard(entity?: string, id?: string) {
    for (const entry of entries.value) {
      if (entity !== undefined && !(entry.entity === entity && entry.id === id)) continue
      const key = keyOf(entry.entity, entry.id)
      commit(key, { ...entry, values: {}, error: null })
      deps.forget(entry.entity, entry.id)
      publish(key, true)
    }
  }

  return {
    entries, count, saving, sheet, open, title, save, discard, tell,
    text: (entity, id, at, value, end) => { void change(entity, id, at, value, { typed: true, now: end }) },
    set: (entity, id, at, value) => { void change(entity, id, at, value, { typed: false, now: false }) },
    put(entity, id, field, value) {
      void open(entity, id).then((loaded) => {
        const key = keyOf(entity, id)
        const entry = cache.value.get(key)
        if (!loaded || !entry) return
        commit(key, { ...entry, values: cmsPendingPut(entry, field, plain(value)), error: null })
        publish(key, true)
      })
    },
    entry: (entity, id) => cache.value.get(keyOf(entity, id)) ?? null,
    handOver(entity, id) {
      const key = keyOf(entity, id)
      const entry = cache.value.get(key) ?? [...cache.value.values()].find((e) => e.entity === entity && e.rowId === id)
      if (!entry) return null
      const at = keyOf(entry.entity, entry.id)
      const values = changed(entry) ? plain(entry.values) : null
      clearTimeout(timers.get(at))
      timers.delete(at)
      // Its draft stays at the server: the sheet's form posts its own over it.
      drafted.delete(at)
      commit(at, null)
      deps.forget(entry.entity, entry.id)
      if (values) tell()
      return values
    },
    reload(entity, id) {
      const entry = cache.value.get(keyOf(entity, id)) ?? [...cache.value.values()].find((e) => e.entity === entity && e.rowId === id)
      // Changes still waiting here were made from the version it was loaded at: they stay, and their save tells.
      if (entry && !changed(entry)) commit(keyOf(entry.entity, entry.id), null)
    },
    dispose() {
      for (const timer of timers.values()) clearTimeout(timer)
      for (const key of drafted.keys()) {
        const entry = cache.value.get(key)
        if (!entry) continue
        try {
          fetch('/api/cms/_preview', {
            method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ entity: entry.entity, id: entry.rowId, locale: entry.locale, clear: true }),
          }).catch(() => {})
        }
        catch { /* leaving anyway */ }
      }
    },
  }
}
