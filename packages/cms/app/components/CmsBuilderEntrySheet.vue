<script setup lang="ts">
// The editor in the preview (experimental, NUXT_CMS_BUILDER=on), since 2f: an entry of a collection (or a
// global's values) edited beside the page, without leaving it. A sheet slides over the form column from the
// left (on a phone-sized admin it fills the screen) and shows the entry's own editor: the same page as at
// its own address, with its form, checks, languages, Save and publishing (`?embed=builder`, see
// useCmsEmbedded). What is typed there shows in the page's preview at once (the entry's own draft, beside
// the page's); a save shows the page anew, and when the saved entry is not among what the selected block
// shows, a quiet line says so. Closing with unsaved changes asks first. The page's editor stays mounted
// underneath, with its selection and its own unsaved changes: the entry is saved on its own, apart from
// the page's undo and redo.
//
// Since 2g an entry may have changes made in the page that wait in the page's editor. One entry has one
// place where its changes are: when the sheet opens it, those changes are handed into the sheet's form
// (they show there as unsaved, and leave the page's own list of what it saves and its undo), and while the
// sheet is open, what is changed of that entry in the page goes into the sheet's form too. The sheet's
// Save stores them; closing without saving asks, as for anything typed in it.
import { cmsBuilderEntryAddress, isCmsEmbedMessage, type CmsEmbedSet } from '../../shared/builder-sources'

const { t, entityLabel } = useCmsI18n()
const builder = useCmsBuilder()
const confirm = useCmsConfirm()
const { data: graph } = useNuxtData<any[]>('cms-graph')

/** The entry open in the sheet: what it is, the address it was opened at, and the block selected then. */
const current = shallowRef<{ entity: string; id: string | null; global: boolean; src: string; block: string } | null>(null)
/** What the editor in the sheet says about itself. */
const state = ref<{ id: string | null; dirty: boolean; saving: boolean; title: string } | null>(null)
const loading = ref(false)
/** Saved, and not among what the selected block shows now. */
const hidden = ref(false)
const frame = ref<HTMLIFrameElement | null>(null)
/** Values for the sheet's form: those waiting until its editor has loaded, then sent as they come. */
let queue: CmsEmbedSet['sets'] = []
let ready = false
function hand(sets: CmsEmbedSet['sets']) {
  if (!sets.length) return
  if (!ready) {
    queue.push(...sets)
    return
  }
  frame.value?.contentWindow?.postMessage({ type: 'cms:entry:set', sets: JSON.parse(JSON.stringify(sets)) } satisfies CmsEmbedSet, location.origin)
}
/** The page's editor knows which entry the sheet has: that entry's changes from the page go into the sheet's form. */
function attach(c: { entity: string; id: string | null } | null) {
  const pending = builder.value?.pending
  if (!pending) return
  pending.sheet.value = c ? { entity: c.entity, id: c.id, set: (at, value) => hand([{ at, value }]) } : null
}

const open = computed({
  get: () => !!current.value,
  set: (value: boolean) => { if (!value) void close() },
})
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === current.value?.entity))
const label = computed(() => (current.value ? builder.value?.entities.value[current.value.entity]?.label ?? entityLabel(meta.value) : ''))
/** The title the page knows for an entry it shows, until the editor says its own. */
function knownTitle(entity: string, id: string | null): string {
  if (!id) return ''
  for (const list of Object.values(builder.value?.sources.value ?? {})) {
    for (const src of list) if (src.entity === entity) for (const e of src.entries) if (e.id === id) return e.title
  }
  return ''
}
const heading = computed(() => {
  const c = current.value
  if (!c) return ''
  if (c.global) return label.value
  const title = state.value?.title || knownTitle(c.entity, c.id) || (c.id === null ? t('builderSources.newEntry') : '')
  return title ? `${label.value} · ${title}` : label.value
})

/** Forget the entry's draft (what was typed and not saved) and show the page as it is saved. */
async function dropDraft(c: { entity: string; id: string | null } | null) {
  const id = state.value?.id ?? c?.id
  if (c && id) await $fetch('/api/cms/_preview', { method: 'POST', body: { entity: c.entity, id, locale: null, clear: true } }).catch(() => {})
  builder.value?.refresh()
}

async function leaveAllowed(): Promise<boolean> {
  if (!state.value?.dirty) return true
  return confirm({
    title: t('editor.leaveTitle'), description: t('editor.unsavedConfirm'), icon: 'i-lucide-undo-2',
    confirmLabel: t('editor.leave'), cancelLabel: t('editor.keepEditing'), color: 'warning',
  })
}

async function close() {
  if (!current.value || !await leaveAllowed()) return
  const was = current.value
  current.value = null
  state.value = null
  hidden.value = false
  attach(null)
  await dropDraft(was)
  builder.value?.entryDone()
}

// The page (a card's "Edit", a double click) or the panel (a row, "Add entry") asks for an entry.
watch(() => builder.value?.entryRequest.value ?? null, async (request) => {
  if (!request) return
  const c = current.value
  const global = !!(graph.value ?? []).find((e: any) => e.name === request.entity)?.singleton
  // The same entry again: it stays as it is (with what is typed in it).
  if (c && c.entity === request.entity && (global || (request.id !== null && (c.id === request.id || state.value?.id === request.id)))) return
  if (c) {
    if (!await leaveAllowed()) return
    await dropDraft(c)
  }
  state.value = null
  hidden.value = false
  loading.value = true
  // What was changed of this entry in the page goes into the sheet's form, once its editor is there.
  ready = false
  const waiting = request.id === null ? null : builder.value?.pending.handOver(request.entity, request.id) ?? null
  queue = Object.entries(waiting ?? {}).map(([key, value]) => ({ at: [key], value }))
  attach({ entity: request.entity, id: request.id })
  current.value = {
    entity: request.entity, id: request.id, global,
    src: cmsBuilderEntryAddress(request.entity, request.id, global, { field: request.field }),
    block: builder.value?.selectedPath.value?.join('/') ?? '',
  }
})

/** After a save: is the entry among what the selected block shows, once the page has shown it anew? */
let checking = 0
async function checkShown(entity: string, id: string) {
  const c = current.value
  hidden.value = false
  if (!c || c.global || !c.block) return
  const my = ++checking
  const shows = () => (builder.value?.sources.value[c.block] ?? []).some((s) => s.entity === entity && s.entries.some((e) => e.id === id))
  for (let waited = 0; waited < 3000; waited += 250) {
    await new Promise((r) => setTimeout(r, 250))
    if (my !== checking || current.value !== c) return
    if (shows()) return
  }
  if (my === checking && current.value === c) hidden.value = true
}

function onMessage(e: MessageEvent) {
  if (e.origin !== location.origin || !frame.value || e.source !== frame.value.contentWindow || !isCmsEmbedMessage(e.data)) return
  const m = e.data
  if (m.type === 'cms:entry:state') {
    state.value = { id: m.id, dirty: m.dirty, saving: m.saving, title: m.title }
    loading.value = false
    if (m.dirty) hidden.value = false
    // The editor in the sheet is there: it takes what waited for it.
    if (!ready) {
      ready = true
      const sets = queue
      queue = []
      hand(sets)
    }
  }
  else if (m.type === 'cms:entry:draft') {
    builder.value?.refresh()
    // A text of this entry typed in the page waits for its draft: it is at the server now.
    builder.value?.pending.tell()
  }
  else {
    if (state.value) state.value = { ...state.value, id: m.id }
    // Saved by its own editor: the page's editor loads it again before it changes it next.
    builder.value?.pending.reload(m.entity, m.id)
    builder.value?.refresh()
    builder.value?.entryDone()
    void checkShown(m.entity, m.id)
  }
}
/**
 * The sheet closes by its own button and by Escape. A press or the keyboard going elsewhere in the admin
 * (the box over a value in the preview, the bar above the page) is no wish to close it: since 2g the page
 * beside it is worked in while it is open.
 */
let escapeAt = 0
const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') escapeAt = performance.now() }
function closeAsked() {
  if (performance.now() - escapeAt < 150) void close()
}
onMounted(() => {
  window.addEventListener('message', onMessage)
  window.addEventListener('keydown', onEscape, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('keydown', onEscape, true)
  attach(null)
  if (current.value) void dropDraft(current.value)
})
</script>

<template>
  <USlideover
    v-model:open="open" side="left" :overlay="false" :modal="false" :dismissible="false" :title="heading" :description="t('builderSources.sheetHint')"
    :ui="{ content: 'max-w-none w-screen sm:w-[34rem] sm:max-w-[calc(100vw-2rem)] divide-y-0' }" :content="{ onOpenAutoFocus: (e: Event) => e.preventDefault() }"
    @close:prevent="closeAsked"
  >
    <template #content>
      <div class="cms-sheet" data-cms-entry-sheet>
        <header class="cms-sheet__head">
          <span class="cms-sheet__icon"><UIcon :name="meta?.icon ?? 'i-lucide-folder'" class="size-4" aria-hidden="true" /></span>
          <h2 class="cms-sheet__title" :title="heading">{{ heading }}</h2>
          <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-x" :aria-label="t('common.close')" @click="close" />
        </header>
        <p v-if="hidden" class="cms-sheet__note" role="status">
          <UIcon name="i-lucide-eye-off" class="size-4 shrink-0" aria-hidden="true" />{{ t('builderSources.savedHidden') }}
        </p>
        <div class="cms-sheet__body">
          <iframe v-if="current" :key="current.src" ref="frame" :src="current.src" :title="heading" class="cms-sheet__frame" @load="frame?.focus()" />
          <div v-if="loading" class="cms-sheet__loading" aria-hidden="true">
            <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-dimmed" />
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.cms-sheet { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--cms-page-bg, var(--ui-bg)); }
.cms-sheet__head { display: flex; align-items: center; gap: 0.625rem; min-height: 3.25rem; padding: 0.5rem 0.75rem 0.5rem 1rem; border-bottom: 1px solid var(--ui-border); background: var(--cms-moment-bg); }
.cms-sheet__icon { display: grid; place-items: center; flex: none; width: 1.75rem; height: 1.75rem; border-radius: 0.5rem; background: var(--cms-moment-strong); color: var(--cms-moment-text); }
.cms-sheet__title { flex: 1; min-width: 0; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--cms-font-display); font-size: 0.9375rem; font-weight: 700; color: var(--ui-text-highlighted); }
.cms-sheet__note { display: flex; align-items: center; gap: 0.5rem; margin: 0; padding: 0.625rem 1rem; border-bottom: 1px solid var(--ui-border); font-size: 0.8125rem; color: var(--ui-text-muted); }
.cms-sheet__body { position: relative; flex: 1; min-height: 0; }
.cms-sheet__frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: var(--cms-page-bg, var(--ui-bg)); }
.cms-sheet__loading { position: absolute; inset: 0; display: grid; place-items: center; background: var(--cms-page-bg, var(--ui-bg)); }
</style>
