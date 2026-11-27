import type { ComputedRef, Ref } from 'vue'
import { isCmsEmbedSet, type CmsEmbedMessage } from '../../shared/builder-sources'

// The editor in the preview (experimental, NUXT_CMS_BUILDER=on), since 2f: an entry of a collection, or a
// global, edited beside the page. The sheet beside the page (CmsBuilderEntrySheet) shows the entry's own
// editor, the same page with the same form, rules, languages and publishing, at `?embed=builder`: the admin
// around it (the menu, the way back, the preview, the history) is left out, and the editor tells the sheet
// how it is (unsaved changes, saved) and hands what is typed to the page's preview at once, through the
// draft the preview reads (POST /api/cms/_preview, per entry: the page's own draft stays as it is).
// Only with the switch on: without it `?embed=builder` is an address like any other.
//
// Since 2g the sheet hands values into the form (`cms:entry:set`): the changes made to this entry in the
// page before the sheet opened, and those made in the page while it is open. The form holds them from then
// on, as if typed in it. And the sheet stays the entry's: a link to another admin page opens in a new tab,
// a change of the address on the same page (another language) keeps `?embed=builder`.

/** Whether this editor is shown in the sheet beside the page. */
export function useCmsEmbedded(): ComputedRef<boolean> {
  const route = useRoute()
  const on = useCmsBuilderOn()
  return computed(() => on.value && route.query.embed === 'builder')
}

/**
 * The editor's side in the sheet: tells the sheet its state, posts what is typed as the preview's draft of
 * this entry (after a short pause) and asks the page to show it, says when it saved, forgets the draft when
 * it closes, and brings the field asked for (`?field=`) into view. Does nothing outside the sheet.
 */
export function useCmsEmbeddedEditor(o: {
  embedded: Ref<boolean>
  entity: Ref<string>
  /** The entry's id (a global: its row's id); `null` before a new entry is first saved. */
  id: Ref<string | null>
  locale: Ref<string | null>
  body: () => Record<string, any>
  dirty: Ref<boolean>
  saving: Ref<boolean>
  version: Ref<string | null>
  title: Ref<string>
  focus: (key: string) => void
  /** Since 2g: put a value into the form at a path (a field, or a field of an item of a list), as an edit of this form. */
  apply?: (at: string[], value: unknown) => void
}): { saved: (id: string) => void } {
  const route = useRoute()
  const router = useRouter()
  // Leaving the entry's own page inside the sheet would show the whole admin in it: another page opens in a
  // new tab, the same page with another query stays here, still as the sheet's editor.
  const stopGuard = router.beforeEach((to, from) => {
    if (!o.embedded.value || to.query.embed === 'builder') return true
    if (to.path === from.path) return { path: to.path, query: { ...to.query, embed: 'builder' }, hash: to.hash }
    if (import.meta.client) window.open(router.resolve(to).href, '_blank', 'noopener')
    return false
  })
  onBeforeUnmount(() => stopGuard())
  function onSet(e: MessageEvent) {
    if (e.origin !== location.origin || e.source !== window.parent || !isCmsEmbedSet(e.data)) return
    for (const set of e.data.sets) o.apply?.(set.at, set.value)
  }
  const inSheet = () => import.meta.client && o.embedded.value && window.parent !== window
  const post = (message: CmsEmbedMessage) => { if (inSheet()) window.parent.postMessage(message, location.origin) }
  let last = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const draftOf = (id: string, data: Record<string, any> | null) => ({ entity: o.entity.value, id, locale: o.locale.value, ...(data ? { data } : { clear: true }) })
  async function sendDraft() {
    const id = o.id.value
    if (!id) return
    const data = JSON.parse(JSON.stringify(o.body() ?? {}))
    const json = JSON.stringify(data)
    if (json === last) return
    last = json
    await $fetch('/api/cms/_preview', { method: 'POST', body: draftOf(id, data) }).catch(() => {})
    post({ type: 'cms:entry:draft', entity: o.entity.value, id })
  }
  function clearDraft() {
    const id = o.id.value
    if (!id || !last) return
    try {
      fetch('/api/cms/_preview', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draftOf(id, null)) }).catch(() => {})
    }
    catch { /* closing anyway */ }
  }
  onMounted(() => {
    if (!inSheet()) return
    last = JSON.stringify(JSON.parse(JSON.stringify(o.body() ?? {})))
    watch([o.dirty, o.saving, o.title, o.id], () => post({ type: 'cms:entry:state', entity: o.entity.value, id: o.id.value, dirty: o.dirty.value, saving: o.saving.value, title: o.title.value }), { immediate: true })
    watch(o.version, (now, before) => { if (now && before && now !== before && o.id.value) post({ type: 'cms:entry:saved', entity: o.entity.value, id: o.id.value }) })
    watch(() => o.body(), () => {
      clearTimeout(timer)
      timer = setTimeout(() => { void sendDraft() }, 250)
    }, { deep: true })
    window.addEventListener('pagehide', clearDraft)
    window.addEventListener('message', onSet)
    const field = typeof route.query.field === 'string' ? route.query.field : null
    if (field) setTimeout(() => o.focus(field), 150)
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    if (!inSheet()) return
    window.removeEventListener('pagehide', clearDraft)
    window.removeEventListener('message', onSet)
    clearDraft()
  })
  return { saved: (id) => post({ type: 'cms:entry:saved', entity: o.entity.value, id }) }
}
