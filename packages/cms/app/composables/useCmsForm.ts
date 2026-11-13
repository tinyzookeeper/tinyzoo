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
  // Field components (e.g. slug auto-fill) read sibling values and create-mode.
  provide('cmsForm', { state, isNew })

  const editable = computed(() => fields.value.filter((f: any) => f.relation?.kind !== 'one-to-many'))

  function blankFor(f: any) {
    if (f.type === 'boolean') return false
    if (f.relation?.kind === 'many-to-many') return []
    if (f.type === 'richtext') return { type: 'doc', content: [] }
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

  const saving = ref(false)
  /**
   * Run a save. On a validation answer (422/409 with issues) the messages land on
   * their fields; anything else becomes a toast. Returns whether it succeeded.
   */
  async function submit(run: () => Promise<unknown>, successTitle = t('editor.saved')): Promise<boolean> {
    saving.value = true
    Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k])
    try {
      await run()
      dirty.value = false
      toast.add({ title: successTitle, icon: 'i-lucide-check', color: 'success' })
      return true
    }
    catch (e: any) {
      const issues = e?.data?.data
      if (Array.isArray(issues) && issues.some((i: any) => i?.path?.[0])) {
        for (const i of issues) if (i.path?.[0]) fieldErrors[i.path[0]] = i.message
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

  return { state, fieldErrors, editable, dirty, saving, load, body, submit }
}
