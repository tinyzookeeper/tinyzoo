import type { ComputedRef } from 'vue'

/**
 * The editing state shared by the entry editor and the settings (singleton) form:
 * field values, field errors, the unsaved-changes guard, Ctrl/⌘+S, and turning a
 * failed save into inline field errors or a toast.
 */
export function useCmsForm(fields: ComputedRef<any[]>, isNew: ComputedRef<boolean>) {
  const { t } = useCmsI18n()
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

  function blankFor(f: any) {
    if (f.type === 'boolean') return false
    if (f.relation?.kind === 'many-to-many') return []
    if (f.type === 'richtext') return { type: 'doc', content: [] }
    if (f.type === 'blocks') return []
    return undefined
  }

  // The values as last loaded from the server, per field (JSON), to tell which
  // fields this tab changed — "save my changes on top" sends only those.
  let loaded: Record<string, string> = {}
  const json = stableJson

  /** Fill with a loaded row (and blanks for anything missing). Not a user edit. */
  function load(row: Record<string, any> | null | undefined) {
    Object.assign(state, row ?? {})
    for (const f of editable.value) if (!(f.key in state)) state[f.key] = blankFor(f)
    loaded = Object.fromEntries(editable.value.map((f: any) => [f.key, json(state[f.key])]))
  }

  /** The fields whose value differs from what was last loaded, with this tab's values. */
  function changedFields(): Record<string, any> {
    const out: Record<string, any> = {}
    for (const f of editable.value) {
      if (json(state[f.key]) !== loaded[f.key]) out[f.key] = structuredClone(toRaw(state[f.key]))
    }
    return out
  }

  /** The request body: every editable field, minus empty optional values. */
  function body(): Record<string, any> {
    const out: Record<string, any> = {}
    for (const f of editable.value) {
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
  const differs = () => editable.value.some((f: any) => json(state[f.key]) !== loaded[f.key])
  watch(state, () => {
    if (!ready) return
    revision++
    dirty.value = differs()
  }, { deep: true })
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (!dirty.value) return
    e.preventDefault()
    e.returnValue = ''
  }
  onMounted(() => {
    ready = true
    window.addEventListener('beforeunload', onBeforeUnload)
  })
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
  onBeforeRouteLeave(() => (dirty.value ? window.confirm(t('editor.unsavedConfirm')) : true))

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
    for (const f of editable.value) {
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
    const keys = new Set(editable.value.map((f: any) => f.key))
    // Their values, plus everything that is not a field (version, languages…).
    for (const [k, v] of Object.entries(row)) if (!keys.has(k) || k in theirs) state[k] = v
    await nextTick()
    loaded = Object.fromEntries(editable.value.map((f: any) => [f.key, json(row[f.key])]))
    dirty.value = editable.value.some((f: any) => json(state[f.key]) !== loaded[f.key])
    ready = true
    return true
  }

  /**
   * Apply a change that is not this tab's edit (someone else typing in shared text):
   * the form follows it without counting it as unsaved work here.
   */
  function quiet(fn: () => void) {
    const wasReady = ready
    ready = false
    fn()
    void nextTick(() => { ready = wasReady || ready })
  }

  /** Set when a save was refused because someone saved in between (409 stale). */
  const conflict = ref<{ version: string; updatedByName: string | null } | null>(null)

  const saving = ref(false)
  /**
   * Run a save. On a validation answer (422/409 with issues) the messages land on
   * their fields; anything else becomes a toast. Returns whether it succeeded.
   */
  async function submit(run: () => Promise<unknown>, successTitle = t('editor.saved')): Promise<boolean> {
    saving.value = true
    Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
    Object.keys(issues).forEach((k) => delete issues[k])
    // Let edits made just before the save (e.g. Publish setting the status) be
    // counted first: they are part of this save, not typed during it.
    await nextTick()
    const startedAt = revision
    try {
      await run()
      // Edits typed while the request ran were not in it: they stay unsaved.
      await nextTick()
      dirty.value = revision !== startedAt
      if (!dirty.value) loaded = Object.fromEntries(editable.value.map((f: any) => [f.key, json(state[f.key])]))
      conflict.value = null
      toast.add({ title: successTitle, icon: 'i-lucide-check', color: 'success' })
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
          if (!i.path?.[0]) continue
          fieldErrors[i.path[0]] ??= i.message
          issues[i.path.join('.')] = i.message
        }
        toast.add({ title: t('editor.fixFields'), icon: 'i-lucide-triangle-alert', color: 'error' })
      }
      else {
        toast.add({ title: t('editor.saveFailed'), description: e?.data?.statusMessage ?? e?.message, icon: 'i-lucide-x', color: 'error' })
      }
      return false
    }
    finally {
      saving.value = false
    }
  }

  return { state, fieldErrors, issues, editable, dirty, saving, conflict, load, replace, merge, body, submit, changedFields }
}
