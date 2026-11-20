import type { ComputedRef } from 'vue'

/**
 * The editing state shared by the entry editor and the settings (singleton) form:
 * field values, field errors, the unsaved-changes guard, Ctrl/⌘+S, and turning a
 * failed save into inline field errors or a toast.
 */
export function useCmsForm(fields: ComputedRef<any[]>, isNew: ComputedRef<boolean>) {
  const { t, tl } = useCmsI18n()
  const toast = useToast()

  const state = reactive<Record<string, any>>({})
  const fieldErrors = reactive<Record<string, string>>({})
  // Every issue by its full path ("sections.2.heading"), for fields that hold
  // nested values (blocks) and want to show an error inside a collapsed part.
  const issues = reactive<Record<string, string>>({})
  // Field components (e.g. slug auto-fill, blocks) read sibling values, create-mode
  // and nested issues.
  provide('cmsForm', { state, isNew, issues, quiet: (fn: () => void) => quiet(fn) })

  const editable = computed(() => fields.value.filter((f: any) => f.relation?.kind !== 'one-to-many'))
  // The fields this person may change: one their role may read but not edit (`readOnly` in the graph)
  // is shown but never sent, never counts as an edit and is never merged — the server refuses a write that names it.
  const writable = computed(() => editable.value.filter((f: any) => !f.readOnly))

  function blankFor(f: any) {
    // A new entry starts with the field's default (e.g. a select's first choice).
    if (isNew.value && f.default != null) return structuredClone(f.default)
    if (f.type === 'boolean') return false
    if (f.relation?.kind === 'many-to-many') return []
    if (f.type === 'richtext') return { type: 'doc', content: [] }
    if (f.type === 'blocks') return []
    // A group: an object of its fields (an optional one stays empty until something is typed).
    if (f.type === 'group') return f.optional ? null : {}
    return undefined
  }

  // The values as last loaded from the server, per field (JSON), to tell which
  // fields this tab changed — "save my changes on top" sends only those.
  let loaded: Record<string, string> = {}
  const json = cmsFormJson

  /** Fill with a loaded row (and blanks for anything missing). Not a user edit. */
  function load(row: Record<string, any> | null | undefined) {
    Object.assign(state, row ?? {})
    for (const f of editable.value) if (!(f.key in state)) state[f.key] = blankFor(f)
    loaded = Object.fromEntries(editable.value.map((f: any) => [f.key, json(state[f.key])]))
  }

  /** The fields whose value differs from what was last loaded, with this tab's values. */
  function changedFields(): Record<string, any> {
    const out: Record<string, any> = {}
    for (const f of writable.value) {
      if (json(state[f.key]) !== loaded[f.key]) out[f.key] = structuredClone(toRaw(state[f.key]))
    }
    return out
  }

  /**
   * A switch with `confirmOff` that was on and is now off: asks first (one question per
   * switch). False when someone said no: the save does not happen.
   */
  async function confirmSwitchOffs(): Promise<boolean> {
    for (const f of writable.value) {
      const text = f.type === 'boolean' ? f.meta?.confirmOff : null
      if (!text || loaded[f.key] !== 'true' || state[f.key] !== false) continue
      const ok = await confirm({
        title: t('editor.confirmOffTitle', { name: tl(f.label, f.key) }),
        description: tl(text, ''),
        confirmLabel: t('editor.confirmOffLabel'),
        icon: 'i-lucide-circle-pause',
        color: 'warning',
      })
      if (!ok) return false
    }
    return true
  }

  /** The request body: every editable field, minus empty optional values. */
  function body(): Record<string, any> {
    const out: Record<string, any> = {}
    for (const f of writable.value) {
      const v = state[f.key]
      if ((v === '' || v === undefined) && (f.optional || f.relation?.kind === 'many-to-many')) continue
      out[f.key] = v
    }
    return out
  }

  // Unsaved changes: edits made after the initial load mark the form dirty.
  const dirty = ref(false)
  let ready = false
  // Counts edits, so a save can tell whether anything was typed while it ran.
  let revision = 0
  // Unsaved = differs from what was last loaded or saved (editing a field back to its
  // saved value, or discarding, makes the form clean again).
  const differs = () => writable.value.some((f: any) => json(state[f.key]) !== loaded[f.key])
  // A field's error goes away as soon as its value changes (the save checks again).
  const erroredAt: Record<string, string> = {}
  function clearFixedErrors() {
    for (const k of Object.keys(fieldErrors)) {
      if (json(state[k]) === erroredAt[k]) continue
      delete fieldErrors[k]
      for (const p of Object.keys(issues)) if (p === k || p.startsWith(`${k}.`)) delete issues[p]
    }
  }
  watch(state, () => {
    if (Object.keys(fieldErrors).length) clearFixedErrors()
    if (!ready) return
    revision++
    dirty.value = differs()
  }, { deep: true })
  // Shared text (rich text typed together, see useCmsCollab) is not kept in this tab
  // but in the shared document, which outlives the visit: the page tells us about it.
  let shared: CmsSharedText | null = null
  /** Whether leaving now would lose unsaved work — not when the only changes are
   *  shared text someone else is still editing (it stays with them). */
  function leaveLoses(): boolean {
    if (!dirty.value) return false
    if (!shared?.othersHere()) return true
    const fields = shared.fields()
    return Object.keys(changedFields()).some((k) => !fields.has(k))
  }
  /** Leaving without saving: put the saved text back into the shared document, so it
   *  is not waiting there next time (unless others are still typing in it). */
  function leaveWithoutSaving() {
    if (!shared || shared.othersHere()) return
    for (const key of shared.fields()) {
      if (json(state[key]) !== loaded[key]) shared.reset(key, JSON.parse(loaded[key] ?? 'null'))
    }
  }
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (!leaveLoses()) return
    e.preventDefault()
    e.returnValue = ''
  }
  onMounted(() => {
    ready = true
    dirty.value = differs()
    window.addEventListener('beforeunload', onBeforeUnload)
  })
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
  const confirm = useCmsConfirm()
  async function askToLeave() {
    if (!leaveLoses()) return true
    const leave = await confirm({
      title: t('editor.leaveTitle'), description: t('editor.unsavedConfirm'), icon: 'i-lucide-file-pen-line',
      cancelLabel: t('editor.stay'), confirmLabel: t('editor.leave'), color: 'warning',
    })
    if (leave) leaveWithoutSaving()
    return leave
  }
  onBeforeRouteLeave(askToLeave)
  // Another language (?locale=…) is another form on the same page: same question.
  onBeforeRouteUpdate((to, from) => (to.path !== from.path || to.query.locale !== from.query.locale ? askToLeave() : true))

  /**
   * Load a newer version over the form (someone else saved): not a user edit, so the
   * form is clean afterwards. Fields the row no longer has are cleared.
   */
  async function replace(row: Record<string, any> | null | undefined) {
    ready = false
    for (const k of Object.keys(state)) if (!(k in (row ?? {}))) delete state[k]
    load(row)
    await nextTick()
    // Usually clean; not when shared text here is ahead of the saved version.
    dirty.value = differs()
    conflict.value = null
    ready = true
  }

  /**
   * Bring in a newer saved version without losing edits made here — field by field,
   * against what was last loaded: a field only they changed takes their value, a
   * field only we changed keeps ours, the same change on both sides is fine. Returns
   * false (and changes nothing) when both sides changed a field differently.
   * `skip`: fields that merge by themselves (shared text).
   */
  async function merge(row: Record<string, any>, skip: Set<string> = new Set()): Promise<boolean> {
    const theirs: Record<string, any> = {}
    for (const f of writable.value) {
      const k = f.key
      if (skip.has(k) || !(k in row)) continue
      const base = loaded[k]
      const mine = json(state[k])
      const next = json(row[k])
      if (next === base || next === mine) continue
      if (mine !== base) return false
      theirs[k] = row[k]
    }
    ready = false
    const keys = new Set(writable.value.map((f: any) => f.key))
    // Their values, plus everything that is not a field this person edits (version, languages, a read-only field…).
    for (const [k, v] of Object.entries(row)) if (!keys.has(k) || k in theirs) state[k] = v
    await nextTick()
    loaded = Object.fromEntries(editable.value.map((f: any) => [f.key, json(row[f.key])]))
    dirty.value = writable.value.some((f: any) => json(state[f.key]) !== loaded[f.key])
    ready = true
    return true
  }

  /**
   * Apply a change that is not this tab's edit (someone else typing in shared text,
   * or text left in the shared document since the last save): it is no edit of this
   * tab (a save still sends only what this tab changed), but the status stays
   * honest — text that differs from the saved version is unsaved, whoever typed it.
   */
  function quiet(fn: () => void) {
    const wasReady = ready
    ready = false
    fn()
    void nextTick(() => {
      ready = wasReady || ready
      if (ready) dirty.value = differs()
    })
  }

  /** Set when a save was refused because someone saved in between (409 stale). */
  const conflict = ref<{ version: string; updatedByName: string | null } | null>(null)

  const saving = ref(false)
  /**
   * Run a save. On a validation answer (422/409 with issues) the messages land on
   * their fields; anything else becomes a toast. Returns whether it succeeded.
   */
  /**
   * Runs a save. `successTitle: null` skips the toast (the page shows its own moment).
   * `run` may return `{ successTitle }` to say more than "Saved" (what the save also did).
   */
  async function submit(run: () => Promise<unknown>, successTitle: string | null = t('editor.saved')): Promise<boolean> {
    saving.value = true
    Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
    Object.keys(issues).forEach((k) => delete issues[k])
    // Let edits made just before the save (e.g. Publish setting the status) be
    // counted first: they are part of this save, not typed during it.
    await nextTick()
    const startedAt = revision
    try {
      const outcome = await run()
      const said = (outcome as { successTitle?: unknown } | null | undefined)?.successTitle
      if (successTitle && typeof said === 'string') successTitle = said
      // Edits typed while the request ran were not in it: they stay unsaved.
      await nextTick()
      dirty.value = revision !== startedAt
      if (!dirty.value) loaded = Object.fromEntries(editable.value.map((f: any) => [f.key, json(state[f.key])]))
      conflict.value = null
      if (successTitle) toast.add({ title: successTitle, icon: 'i-lucide-check', color: 'success' })
      return true
    }
    catch (e: any) {
      if (e?.data?.data?.code === 'stale') {
        conflict.value = e.data.data
        // The notice sits at the top of the page; say it where the eye is too.
        toast.add({ title: t('live.notSaved'), icon: 'i-lucide-git-compare-arrows', color: 'warning' })
        return false
      }
      const issueList = e?.data?.data
      if (Array.isArray(issueList) && issueList.some((i: any) => i?.path?.[0])) {
        for (const i of issueList) {
          const key = i.path?.[0]
          if (!key) continue
          const message = cmsIssueMessage(i, editable.value.find((f: any) => f.key === key), t as any)
          fieldErrors[key] ??= message
          erroredAt[key] = json(state[key])
          issues[i.path.join('.')] = message
        }
        toast.add({ title: t('editor.fixFields'), icon: 'i-lucide-triangle-alert', color: 'error' })
        // The cursor goes to the first field that is wrong, not back to <body>.
        void cmsFocusInvalid(document.querySelector('.cms-editor'), `cms-field-${Object.keys(fieldErrors)[0]}`)
      }
      else {
        toast.add({ title: t('editor.saveFailed'), description: cmsRequestError(e, t as any), icon: 'i-lucide-x', color: 'error' })
      }
      return false
    }
    finally {
      saving.value = false
    }
  }

  /** Tell the unsaved-changes guard which fields are shared text (see `shared` above). */
  function setSharedText(s: CmsSharedText) {
    shared = s
  }

  return { state, fieldErrors, issues, editable, writable, dirty, saving, conflict, load, replace, merge, body, submit, changedFields, setSharedText, quiet, confirmSwitchOffs }
}

export interface CmsSharedText {
  /** The fields typed together on this page right now. */
  fields: () => Set<string>
  /** Whether someone else has this entry open (and so the shared text). */
  othersHere: () => boolean
  /** Put a value into a shared field, for everyone. */
  reset: (key: string, value: any) => void
}
