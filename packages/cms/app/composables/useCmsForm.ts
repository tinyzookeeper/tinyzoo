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
  provide('cmsForm', { state, isNew, issues })

  const editable = computed(() => fields.value.filter((f: any) => f.relation?.kind !== 'one-to-many'))

  function blankFor(f: any) {
    if (f.type === 'boolean') return false
    if (f.relation?.kind === 'many-to-many') return []
    if (f.type === 'richtext') return { type: 'doc', content: [] }
    if (f.type === 'blocks') return []
    return undefined
  }

  /** Fill with a loaded row (and blanks for anything missing). Not a user edit. */
  function load(row: Record<string, any> | null | undefined) {
    Object.assign(state, row ?? {})
    for (const f of editable.value) if (!(f.key in state)) state[f.key] = blankFor(f)
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
  watch(state, () => { if (ready) dirty.value = true }, { deep: true })
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
    dirty.value = false
    conflict.value = null
    ready = true
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
    try {
      await run()
      dirty.value = false
      conflict.value = null
      toast.add({ title: successTitle, icon: 'i-lucide-check', color: 'success' })
      return true
    }
    catch (e: any) {
      if (e?.data?.data?.code === 'stale') {
        conflict.value = e.data.data
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

  return { state, fieldErrors, issues, editable, dirty, saving, conflict, load, replace, body, submit }
}
