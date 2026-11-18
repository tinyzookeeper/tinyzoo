<script setup lang="ts">
// Entry editor. The title is the page heading; content fields fill the main column;
// properties (status, URL, dates, relations…) sit in a side panel; grouped fields
// (e.g. "Search & sharing") collapse at the bottom of the panel. Status is shown once
// and changed through the header's single primary action.
//
// Remount per record so state/dirty/guard fully reset when switching records
// (and after a create→redirect), rather than reusing a stale component instance.
import type { LiveChange } from '../../../composables/useCmsLive'

definePageMeta({ layout: 'admin', key: (route) => route.fullPath })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t, tl, languageName, entityLabel, entitySingular, fieldLabel, formatDate, fieldHelp, locale: adminLocale } = useCmsI18n()
const entity = computed(() => route.params.entity as string)
const id = computed(() => route.params.id as string)
const isNew = computed(() => id.value === 'new')

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
// The manual-order position is set by arranging the list, never by this form (a stale
// position saved from here would undo someone's reordering).
const form = useCmsForm(computed(() => (meta.value?.fields ?? []).filter((f: any) => f.key !== meta.value?.orderField)), isNew)
const { state, fieldErrors, editable, dirty, saving, conflict } = form

// ── content languages ──
// The default language is the entry itself; others are translations of the
// `.localized()` fields (?locale=en). The page remounts when the language changes.
const locales = computed(() => meta.value?.locales as { default: string; all: string[]; labels: Record<string, any> } | null)
const currentLocale = computed(() => {
  const q = route.query.locale
  return typeof q === 'string' && locales.value?.all.includes(q) ? q : (locales.value?.default ?? null)
})
const isTranslation = computed(() => !!locales.value && !isNew.value && currentLocale.value !== locales.value.default)
// "The other fields are shared" only when there are other fields.
const hasSharedFields = computed(() => (meta.value?.fields ?? []).some((f: any) => !f.localized && f.relation?.kind !== 'one-to-many' && f.key !== meta.value?.orderField))
const localeLabel = (code?: string | null) => (code ? tl(locales.value?.labels?.[code], code.toUpperCase()) : '')
// In a sentence a language is named in the admin's own language ("angličtina"), not spelled its own way.
const localeName = (code?: string | null) => languageName(code, code ? locales.value?.labels?.[code] : null)
const defaultLabel = computed(() => localeName(locales.value?.default))
const available = ref<string[]>([])
const defaults = ref<Record<string, any>>({})
const translated = ref(false)
// Publishing per language (publish.perLocale): the state of every language, and whether the one being
// edited has a state of its own (false: it follows the default language).
const states = ref<Record<string, { state: 'published' | 'scheduled' | 'draft'; own: boolean; date: string | null; waitingFor?: string; translating?: true }>>({})
const stateOwn = ref(false)

// May this person save here? Told by the server with the entry (the same rules a save
// applies); when not, the form opens read-only with the reason, not a save that fails.
const can = ref<{ update: boolean; why?: 'role' | 'owner' | 'published' }>({ update: true })
const cannotCreate = computed(() => isNew.value && meta.value?.can?.create === false)
const readOnly = computed(() => cannotCreate.value || (!isNew.value && can.value.update === false))
provide('cmsReadOnly', readOnly)

const savedAt = ref<string | null>(null)
const createdAt = ref<string | null>(null)
// The version this tab edits (the entry's updatedAt): sent with every save, so saving
// over someone else's newer version is refused unless the editor chooses to.
const version = ref<string | null>(null)
const rowUrl = (): string => `/api/cms/${entity.value}/${id.value}${isTranslation.value ? `?locale=${currentLocale.value}` : ''}`
function adopt(row: Record<string, any> | null | undefined) {
  // A translation is saved apart from the entry: its own time, not the original's (nothing yet for one never saved).
  savedAt.value = cmsSavedAt(row, isTranslation.value)
  createdAt.value = row?.createdAt ?? null
  // A translation has its own version.
  version.value = (isTranslation.value ? row?.__version : row?.updatedAt) ?? null
  available.value = row?.__locales ?? []
  defaults.value = row?.__defaults ?? {}
  translated.value = !!row?.__translated
  states.value = row?.__states ?? {}
  stateOwn.value = !!row?.__stateOwn
}
// An address of an entry that does not exist (deleted, mistyped): say so, never a blank editor.
const missing = ref(false)
if (!isNew.value) {
  const { data, error: rowError } = await useFetch<{ row: Record<string, any>; can?: typeof can.value }>(rowUrl)
  missing.value = rowError.value?.statusCode === 404 || rowError.value?.statusCode === 400
  if (data.value?.can) can.value = data.value.can
  form.load(data.value?.row)
  adopt(data.value?.row)
}
else {
  // "Add a subpage" opens a new page with its parent chosen.
  const parent = meta.value?.tree && typeof route.query.parent === 'string' ? route.query.parent : null
  form.load(parent ? { [meta.value.tree.parent]: parent } : {})
}

const fetchRow = async () => {
  const res = await cmsFetch<{ row: Record<string, any>; can?: typeof can.value }>(rowUrl())
  if (res.can) can.value = res.can
  return res.row
}

/** Replace the form with the newest saved version (discarding unsaved edits here). */
async function loadNewest() {
  const row = await fetchRow()
  await form.replace(row)
  adopt(row)
  // Shared text follows only when someone asks for the saved version: for everyone.
  for (const key of sharedFields.value) collab?.set(key, row[key])
  if (live) live.incoming.value = null
}

/**
 * Someone else saved, or the connection came back (we may have missed something).
 * Fetch first, then decide: nothing new → nothing; unsaved edits here (also ones
 * typed while fetching) → offer the newer version; otherwise show it.
 */
// This tab has just removed the translation itself: its own change coming back is no news.
let removedHere = false
async function onRemoteChange(c: LiveChange) {
  if (removedHere && c.type === 'translation.deleted') return
  const row = await fetchRow().catch(() => null)
  if (!row) return
  const newest = (isTranslation.value ? row.__version : row.updatedAt) ?? null
  if (newest === version.value) return
  // Their changes come in field by field; only the same field changed differently on
  // both sides needs a decision. Shared text merges by itself.
  if (!saving.value && await form.merge(row, sharedFields.value)) {
    adopt(row)
    toast.add({ title: c.byName ? t('live.reloaded', { name: c.byName }) : t('live.reloadedSomeone'), icon: 'i-lucide-refresh-cw', color: 'info' })
    return
  }
  if (live) live.incoming.value = c
}

/**
 * "Save my changes on top": the newest version, with only the fields changed in
 * this tab put back on it — everything else (a publish, other people's edits) stays
 * as they saved it.
 */
async function saveOnTop() {
  const mine = form.changedFields()
  const row = await fetchRow()
  await form.replace(row)
  adopt(row)
  Object.assign(state, mine)
  await save()
}

// ── realtime: who else is here, and what they saved ──
const live = isNew.value
  ? null
  : useCmsEntryLive({
      entity: entity.value,
      id: id.value,
      version,
      dirty,
      saving,
      locale: computed(() => (isTranslation.value ? currentLocale.value : null)),
      onChange: onRemoteChange,
    })
const others = computed(() => live?.others.value ?? [])

// ── shared editing of the rich-text fields (this entry, in this language) ──
// Only when there is text to write together (a rich-text field).
const hasRichText = (meta.value?.fields ?? []).some((f: any) => f.type === 'richtext')
const collab = isNew.value || !hasRichText ? null : useCmsCollab({ entity: entity.value, id: id.value, locale: isTranslation.value ? currentLocale.value : null })
// Shared on this page right now: a shared editor is mounted for it (not, say, a
// field in a collapsed group, which then merges like any other field).
const sharedFields = computed(() => (collab?.status.value === 'ready' ? collab.mounted.value : new Set<string>()))
form.setSharedText({ fields: () => sharedFields.value, othersHere: () => others.value.length > 0, reset: (key, value) => { collab?.set(key, value) } })
/**
 * Saves made from the shared document say so (it then matches the saved version) —
 * only when every shared field is on the page, so the save really holds the shared text.
 */
const collabHeaders = (): Record<string, string> => {
  if (!collab || collab.status.value !== 'ready' || !collab.epoch.value) return {}
  for (const k of collab.fields.value) if (!collab.mounted.value.has(k)) return {}
  return { 'x-cms-collab': collab.epoch.value }
}

// ── the "…" menu: whatever applies here ──
// A draft's top bar on a phone: "Save" while there is something to save (publishing moves into the menu).
const phoneSave = computed(() => narrow.value && dirty.value && !!publish.value && canPublish.value && !isPublished.value && ownsPublishing.value && !readOnly.value)
const draftActions = computed(() => !!publish.value && canPublish.value && !isPublished.value && ownsPublishing.value)
const menuGroups = computed(() => {
  const groups: any[][] = []
  if (narrow.value) {
    const g: any[] = []
    if (phoneSave.value) g.push({ label: t('editor.publishEllipsis'), icon: 'i-lucide-send', onSelect: () => { reviewOpen.value = true } })
    else if (draftActions.value && !readOnly.value) g.push({ label: t('editor.saveDraft'), icon: 'i-lucide-save', onSelect: () => save() })
    if (previewUrl.value) g.push({ label: t('editor.preview'), icon: 'i-lucide-eye', onSelect: togglePreview })
    if (!isNew.value) g.push({ label: t('revisions.open'), icon: 'i-lucide-history', onSelect: () => { historyOpen.value = true } })
    if (locales.value && !isNew.value) g.push({ label: t('translation.language'), icon: 'i-lucide-languages', children: localeItems.value })
    if (g.length) groups.push(g)
  }
  if (moreItems.value.length) groups.push(moreItems.value)
  if (entryItems.value.length) groups.push(entryItems.value)
  return groups
})
const moreItems = computed(() => {
  const items: any[] = []
  if (readOnly.value) return items
  if (!isNew.value && dirty.value) items.push({ label: t('editor.discard'), icon: 'i-lucide-undo-2', onSelect: discardChanges })
  if (!isNew.value && ownsPublishing.value && publish.value && canPublish.value && isPublished.value) {
    items.push({ label: t('editor.unpublish'), icon: 'i-lucide-eye-off', onSelect: confirmUnpublish })
  }
  // A language with a state of its own can go back to following the default language.
  if (isTranslation.value && perLocale.value && publish.value && canPublish.value && stateOwn.value) {
    items.push({ label: t('translation.followDefault'), icon: 'i-lucide-link', onSelect: followDefault })
  }
  // Removing a language's own state puts the default language back in its place: for people who may publish, unless it
  // is being translated (visitors see the default language there already).
  const mayRemove = !(perLocale.value && stateOwn.value && !canPublish.value && !shownState.value.translating)
  if (isTranslation.value && translated.value && mayRemove) items.push({ label: t('translation.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: removeTranslation })
  return items
})
// The entry itself: see it live, copy it, delete it (never from a translation).
const entryItems = computed(() => {
  const items: any[] = []
  if (isNew.value || isTranslation.value) return items
  if (liveHere.value && publicPath.value) items.push({ label: t('editor.viewOnSite'), icon: 'i-lucide-arrow-up-right', to: publicPath.value, target: '_blank' })
  if (meta.value?.can?.create !== false) items.push({ label: t('editor.duplicate'), icon: 'i-lucide-copy', onSelect: duplicateEntry })
  if (meta.value?.can?.delete !== false && !(readOnly.value && can.value.why !== 'published')) items.push({ label: t('editor.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: deleteEntry })
  return items
})
const entryActions = useCmsEntryActions()
async function duplicateEntry() {
  if (dirty.value && !await confirm({ title: t('editor.duplicateDirtyTitle'), description: t('editor.duplicateDirtyBody'), icon: 'i-lucide-copy', confirmLabel: t('editor.duplicateAnyway'), cancelLabel: t('common.cancel'), color: 'warning' })) return
  const copy = await entryActions.duplicate(entity.value, meta.value, id.value)
  if (copy) {
    dirty.value = false
    await router.push(`/admin/${entity.value}/${copy}`)
  }
}
async function deleteEntry() {
  if (await entryActions.remove(entity.value, meta.value, id.value, titleField.value ? state[titleField.value.key] : null)) {
    dirty.value = false
    await router.push(`/admin/${entity.value}`)
  }
}

const confirm = useCmsConfirm()
/** Taking it off the website is one click away from "Discard changes": ask first. */
async function confirmUnpublish() {
  // A page tree: the pages under this one go off the website with it.
  const below = subpagesOnSite.value
  const lang = localeName(currentLocale.value)
  const ok = await confirm({
    title: isTranslation.value ? t('translation.unpublishTitle', { lang }) : t('editor.unpublishTitle'),
    description: isTranslation.value ? t('translation.unpublishBody', { lang }) : below ? t('tree.unpublishBranchCount', { count: below }) : t('editor.unpublishBody'),
    icon: 'i-lucide-eye-off', confirmLabel: t('editor.unpublish'),
  })
  if (ok) await setPublished(false)
}
/** Back to the saved version. Shared text goes back for everyone editing it, so ask first. */
async function discardChanges() {
  const others = (live?.others.value ?? []).length > 0 && sharedFields.value.size > 0
  const ok = await confirm({
    title: t('editor.discardTitle'), description: others ? t('editor.discardSharedConfirm') : t('editor.discardConfirm'),
    icon: 'i-lucide-undo-2', cancelLabel: t('editor.keepEditing'), confirmLabel: t('editor.discard'), color: 'warning',
  })
  if (!ok) return
  await loadNewest()
}

// Text typed while offline that the shared document could not take back (it was
// restarted meanwhile): offered back, never dropped silently.
const lostText = ref<Record<string, any> | null>(null)
if (collab) watch(collab.lost, (v) => { if (v) lostText.value = v })
/** "Keep" on text a closed tab left behind: into the form (shared text: for everyone), as an unsaved change. */
function keepUnsaved(values: Record<string, any>) {
  for (const [key, value] of Object.entries(values)) {
    if (!collab?.set(key, structuredClone(toRaw(value)))) state[key] = structuredClone(toRaw(value))
  }
}
function restoreLost() {
  for (const [key, value] of Object.entries(lostText.value ?? {})) {
    if (!collab?.set(key, value)) state[key] = value
  }
  lostText.value = null
  if (collab) collab.lost.value = null
}

// ── history ──
const historyOpen = ref(false)
/** Put an older version into the form (shared text: for everyone). Saving makes it current. */
// Restoring brings back content, not the workflow: status, publish date (and the
// list position, which is not in this form) stay as they are now.
const workflowFields = computed(() => new Set([publish.value?.field, publish.value?.dateField].filter(Boolean) as string[]))
async function restoreRevision(data: Record<string, any>) {
  // Files deleted since that version are left out (an empty field, no broken image).
  const gone = await missingMedia(data)
  data = withoutMedia(data, gone)
  for (const f of editable.value) {
    if (!(f.key in data) || workflowFields.value.has(f.key) || f.readOnly) continue
    if (sharedFields.value.has(f.key) && collab?.set(f.key, data[f.key])) continue
    state[f.key] = structuredClone(toRaw(data[f.key]))
  }
  toast.add({
    title: t('revisions.restored'), icon: 'i-lucide-history', color: 'info',
    description: gone.size ? t('revisions.filesGone', { count: gone.size }) : undefined,
  })
}

/** Media ids a snapshot uses (media fields, images in rich text and blocks). */
function mediaIdsIn(data: Record<string, any>): string[] {
  const ids: string[] = []
  const walk = (v: any) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) return v.forEach(walk)
    if (typeof v.attrs?.mediaId === 'string') ids.push(v.attrs.mediaId)
    for (const x of Object.values(v)) walk(x)
  }
  // A group's media fields (and, inside it, rich text, lists and more groups).
  const groupMedia = (g: any, v: any) => {
    if (!v || typeof v !== 'object') return
    for (const gf of g.meta?.fields ?? []) {
      const x = v[gf.key]
      if (gf.type === 'media' && typeof x === 'string') ids.push(x)
      else if (gf.type === 'group') groupMedia(gf, x)
      else walk(x)
    }
  }
  for (const f of editable.value) {
    const v = data[f.key]
    if (f.type === 'media' && typeof v === 'string') ids.push(v)
    else if (f.type === 'gallery' && Array.isArray(v)) ids.push(...v.map((x: any) => x?.mediaId).filter(Boolean))
    else if (f.type === 'richtext') walk(v)
    else if (f.type === 'blocks' && Array.isArray(v)) {
      for (const b of v) for (const [k, x] of Object.entries(b ?? {})) {
        const bf = f.meta?.blocks?.[b?.type]?.fields?.find((y: any) => y.key === k)
        if (bf?.type === 'media' && typeof x === 'string') ids.push(x)
        else if (bf?.type === 'group') groupMedia(bf, x)
        else walk(x)
      }
    }
    else if (f.type === 'group') groupMedia(f, v)
  }
  return [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))]
}
async function missingMedia(data: Record<string, any>): Promise<Set<string>> {
  const ids = mediaIdsIn(data)
  if (!ids.length) return new Set()
  const res = await $fetch<{ ids: string[] }>('/api/cms/_media/exists', { method: 'POST', body: { ids } }).catch(() => ({ ids }))
  const have = new Set(res.ids)
  return new Set(ids.filter((id) => !have.has(id)))
}
/** A copy of the snapshot without the given files: fields emptied, images removed. */
function withoutMedia(data: Record<string, any>, gone: Set<string>): Record<string, any> {
  if (!gone.size) return data
  const strip = (v: any): any => {
    if (Array.isArray(v)) return v.filter((x) => !(x?.type === 'image' && gone.has(x?.attrs?.mediaId)) && !gone.has(x?.mediaId)).map(strip)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'string' && gone.has(x) ? null : strip(x)]))
    return v
  }
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) out[k] = typeof v === 'string' && gone.has(v) ? null : strip(v)
  return out
}

/** Translating: an empty text field shows the default language's text greyed inside it (its placeholder). */
const translatedPlaceholder = (f: any): string | undefined => {
  const v = isTranslation.value && f?.localized ? defaults.value[f.key] : undefined
  return typeof v === 'string' && v ? v : undefined
}
/** What the default language has in a field, for a translation's empty field to show (CmsField `fallback`). */
const fallbackOf = (f: any) => (isTranslation.value && f?.localized ? defaults.value[f.key] : undefined)
/** A field whose original is long (a text body, blocks): the note about it goes above it, where it is seen first. */
const refAbove = (f: any) => ['richtext', 'blocks', 'gallery', 'group'].includes(f?.type)
/** "Show the original beside it": the main text of a translation next to the default language's, on a wide screen. */
const compareOriginal = ref(false)
const compareKey = 'cms-compare-original'
const comparing = computed(() => isTranslation.value && roomy.value && compareOriginal.value && !!writeBody.value
  && !isEmptyRichText(defaults.value[writeBody.value.key]))
onMounted(() => {
  try {
    compareOriginal.value = localStorage.getItem(compareKey) === '1'
  }
  catch { /* storage blocked: off */ }
})
watch(compareOriginal, (v) => {
  try {
    localStorage.setItem(compareKey, v ? '1' : '0')
  }
  catch { /* for this visit only */ }
})

/**
 * Said once for the whole translation, not under every field: where a translated field is empty, the default
 * language's text shows greyed in it. Only while some field is like that and there is something to show.
 */
const showsDefault = computed(() => isTranslation.value
  && editable.value.some((f: any) => f.localized && cmsBlank(state[f.key]) && !cmsBlank(defaults.value[f.key])))

/** Copy the default language's value into this translation's field (shared text: for everyone). */
function copyDefault(key: string) {
  const value = structuredClone(toRaw(defaults.value[key]))
  if (sharedFields.value.has(key) && collab?.set(key, value)) return
  state[key] = value
}

// ── layout: which field goes where ──
const publish = computed(() => meta.value?.publish)
const titleKey = computed(() => meta.value?.titleField as string | undefined)
const titleField = computed(() => editable.value.find((f: any) => f.key === titleKey.value))
// A title that is an address (redirects): labelled, "/…" as the hint, set in mono.
const titleIsAddress = computed(() => ['path', 'url', 'link'].includes(titleField.value?.meta?.format))
const titlePlaceholder = computed(() => (titleIsAddress.value ? '/…' : t('editor.titlePlaceholder')))
const MAIN_TYPES = new Set(['text', 'richtext', 'media', 'blocks', 'gallery', 'group'])
const placementOf = (f: any): 'main' | 'sidebar' => f.meta?.position ?? (MAIN_TYPES.has(f.type) ? 'main' : 'sidebar')
// The publish field is changed by the Publish action, not edited as a field. In a
// translation only the translatable fields are shown.
const formFields = computed(() => editable.value.filter((f: any) =>
  f.key !== titleKey.value && f.key !== publish.value?.field && f.key !== meta.value?.orderField && (!isTranslation.value || f.localized)))
const mainFields = computed(() => formFields.value.filter((f: any) => !f.meta?.group && placementOf(f) === 'main'))
// ── arrangement: chosen from the content (graph `editor`, see editorLayout) ──
// write: one calm, centred writing column, details on demand · form: fields and a
// properties panel · preview: the form beside the live page. Same parts, same top bar.
const arrangement = computed<'write' | 'form' | 'preview'>(() => meta.value?.editor ?? 'form')
const wide = ref(false) // ≥ 1024px: panels side by side
const roomy = ref(false) // ≥ 1280px: the Write arrangement shows details by default
const narrow = ref(false) // < 768px: secondary actions move into "…"
const previewOpen = ref(arrangement.value === 'preview')
const previewSheet = ref(false)
const detailsOpen = ref(true)
const previewKey = computed(() => `cms-preview:${entity.value}`)
onMounted(() => {
  const mq = (q: string, set: (v: boolean) => void) => {
    const m = window.matchMedia(q)
    set(m.matches)
    m.addEventListener('change', (e) => set(e.matches))
  }
  mq('(min-width: 1024px)', (v) => { wide.value = v })
  mq('(min-width: 1280px)', (v) => { roomy.value = v })
  mq('(max-width: 767px)', (v) => { narrow.value = v })
  detailsOpen.value = arrangement.value !== 'write' || roomy.value
  try {
    const pref = localStorage.getItem(previewKey.value)
    if (pref) previewOpen.value = pref === '1'
  }
  catch { /* storage blocked: the arrangement's default */ }
})
// The live page loads the site with whatever the entry contains: beside the form on
// wide screens (remembered per collection), as a full-screen sheet on small ones.
function togglePreview() {
  if (!wide.value) {
    previewSheet.value = true
    return
  }
  previewOpen.value = !previewOpen.value
  try {
    localStorage.setItem(previewKey.value, previewOpen.value ? '1' : '0')
  }
  catch { /* storage blocked: for this visit only */ }
}
const split = computed(() => wide.value && previewOpen.value && !!previewUrl.value)
// Form and preview show every field in titled sections (admin.sections; tabs read as
// sections there) with a details column; write keeps the text apart from the details.
const sectioned = computed(() => arrangement.value !== 'write')
const formSectionConfig = computed(() => {
  if (meta.value?.sections?.length) return meta.value.sections
  const tabs = (meta.value?.tabs ?? []) as { label: any; fields: string[] }[]
  return tabs.length ? tabs.map((tab) => ({ label: tab.label, fields: tab.fields })) : null
})
const showAside = computed(() => !wide.value || arrangement.value !== 'write' || detailsOpen.value || split.value)
// The sidebar folds to icons while writing or looking at the page.
useCmsFocus(computed(() => wide.value && (arrangement.value !== 'form' || split.value)))
const groups = computed(() => {
  const out = new Map<string, { label: string; fields: any[] }>()
  for (const f of formFields.value) {
    if (!f.meta?.group) continue
    const label = tl(f.meta.group)
    if (!out.has(label)) out.set(label, { label, fields: [] })
    out.get(label)!.fields.push(f)
  }
  return [...out.values()]
})

// ── write: the column holds the cover photo, the title, the summary and the text, as
// the reader meets them; everything else is in the details beside it ──
const isImageMedia = (f: any) => f.type === 'media' && (!f.meta?.accept || String(f.meta.accept).startsWith('image'))
const writeCover = computed(() => mainFields.value.find(isImageMedia))
const writeLead = computed(() => mainFields.value.find((f: any) => f.type === 'text' && f.meta?.multiline))
const writeBody = computed(() => mainFields.value.find((f: any) => f.type === 'richtext'))
const inColumn = computed(() => new Set([writeCover.value?.key, writeLead.value?.key, writeBody.value?.key].filter(Boolean) as string[]))
// Further text bodies and lists of blocks stay in the column, under their labels.
const writeMore = computed(() => mainFields.value.filter((f: any) => !inColumn.value.has(f.key) && (f.type === 'richtext' || f.type === 'blocks')))
// admin.tabs after the first become folded groups in the details ("Photos & video"),
// as do .group() fields; the rest are rows.
const writeGroups = computed(() => {
  const tabs = (meta.value?.tabs ?? []) as { label: any; fields: string[] }[]
  const taken = new Set([...inColumn.value, ...writeMore.value.map((f: any) => f.key as string)])
  const out: { id: string; label: string; fields: any[] }[] = []
  tabs.forEach((tab, i) => {
    if (i === 0) return
    const fields = formFields.value.filter((f: any) => !f.meta?.group && tab.fields.includes(f.key) && !taken.has(f.key))
    fields.forEach((f: any) => taken.add(f.key))
    if (fields.length) out.push({ id: `tab-${i}`, label: tl(tab.label), fields })
  })
  for (const g of groups.value) out.push({ id: `group-${g.label}`, label: g.label, fields: g.fields })
  return out
})
const writeRows = computed(() => {
  const elsewhere = new Set([...inColumn.value, ...writeMore.value.map((f: any) => f.key as string), ...writeGroups.value.flatMap((g) => g.fields.map((f: any) => f.key as string))])
  const rows = formFields.value.filter((f: any) => !f.meta?.group && !elsewhere.has(f.key))
  // The address last: it follows from the title.
  return [...rows.filter((f: any) => f.type !== 'slug'), ...rows.filter((f: any) => f.type === 'slug')]
})
const groupSummary = (g: { fields: any[] }) => {
  const filled = g.fields.filter((f: any) => !cmsIsEmpty(state[f.key]) && !(f.type === 'boolean' && !state[f.key])).length
  return filled ? t('sections.filled', { n: filled, total: g.fields.length }) : t('sections.empty')
}
const openGroups = reactive<Record<string, boolean>>({})
// A group with an error inside opens itself.
watch(() => ({ ...fieldErrors }), (errs) => {
  for (const g of writeGroups.value) if (g.fields.some((f: any) => errs[f.key])) openGroups[g.id] = true
})

// ── a redirect from the address of a page that is on the website would hide that page ──
const shadowed = ref<{ title: string } | null>(null)
if (meta.value?.preset === 'redirects') {
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const check = async (from: unknown) => {
    const my = ++seq
    const path = typeof from === 'string' ? from.trim().split(/[?#]/)[0]!.replace(/(.)\/+$/, '$1') : ''
    if (!path.startsWith('/') || path === '/') {
      shadowed.value = null
      return
    }
    // The page's address may be nested (/about/team): its last part is what the picker can search by.
    const last = path.split('/').filter(Boolean).pop() ?? ''
    const codes = locales.value?.all ?? [undefined]
    const found = await Promise.all(codes.map((locale) => cmsFetch<{ items: { title: string; path: string; published: boolean }[] }>('/api/cms/_links', { query: { q: last, locale } }).catch(() => ({ items: [] }))))
    if (my !== seq) return
    const hit = found.flatMap((r) => r.items).find((i) => i.published && i.path === path)
    shadowed.value = hit ? { title: hit.title } : null
  }
  onMounted(() => {
    watch(() => state[titleKey.value ?? 'from'], (v) => {
      clearTimeout(timer)
      timer = setTimeout(() => check(v), 350)
    }, { immediate: true })
  })
  onBeforeUnmount(() => clearTimeout(timer))
}

// ── titles ──
const listLabel = computed(() => entityLabel(meta.value) || entity.value)
const heading = computed(() => {
  const v = titleKey.value ? state[titleKey.value] : ''
  if (v) return String(v)
  // An untranslated title: the default language's (what visitors see in its place).
  const shown = titleKey.value && isTranslation.value ? defaults.value[titleKey.value] : ''
  if (shown) return String(shown)
  return isNew.value ? t('editor.newTitle', { label: entitySingular(meta.value).toLowerCase() }) : t('common.untitled')
})
useHead({ title: heading })

// ── publishing ──
const canPublish = computed(() => meta.value?.can?.publish !== false)
// Publishing per language: a translation has its own status and schedule, and its own Publish and Unpublish.
const perLocale = computed(() => !!publish.value?.perLocale && !!locales.value)
// Whether this view has publish controls: the entry itself, or a language that publishes on its own.
const ownsPublishing = computed(() => !isTranslation.value || perLocale.value)
const isPublished = computed(() => !!publish.value && state[publish.value.field] === publish.value.publishedValue)
const publishedOn = computed(() => (publish.value?.dateField ? state[publish.value.dateField] : null))
// A publish date ahead: publishing schedules it (live from that moment).
const futureDate = computed(() => !!publishedOn.value && new Date(publishedOn.value).getTime() > Date.now())
const isScheduled = computed(() => isPublished.value && futureDate.value)
// What the top bar says. A language with a state of its own reads what the website does with it: the default
// language gates it, so it can wait for the default language (draft) or for its date (scheduled). A draft that was
// never on the website is being translated (`translating`: the default language's name, which visitors see meanwhile).
const shownState = computed(() => {
  const s = isTranslation.value && perLocale.value ? states.value[currentLocale.value ?? ''] : undefined
  if (!s || !stateOwn.value) return { published: isPublished.value, date: publishedOn.value, waitingFor: null as string | null, translating: null as string | null }
  return { published: s.state !== 'draft', date: s.state === 'scheduled' ? s.date : null, waitingFor: s.waitingFor ? localeName(s.waitingFor) : null, translating: s.translating ? defaultLabel.value : null }
})
// The details column adds what the bar does not say: since when, until when, who publishes. "Not on the website
// yet" is said once, by the address under the title, when there is one.
const asideNote = computed(() => {
  if (shownState.value.waitingFor) return t('translation.waitingForBody', { lang: shownState.value.waitingFor })
  if (shownState.value.translating) return t('translation.translatingBody', { lang: shownState.value.translating })
  if (isScheduled.value) return t('editor.goesLive', { date: formatDate(publishedOn.value) })
  if (isPublished.value && publishedOn.value) return t('editor.publishedSince', { date: formatDate(publishedOn.value, { time: false }) })
  if (!isPublished.value) return !canPublish.value ? t('editor.cannotPublish') : publicPath.value ? '' : t('editor.notPublished')
  return ''
})
// Whose state the bar shows, when the entry has languages: "English · Draft".
const shownStateWord = computed(() => (shownState.value.waitingFor ? t('translation.waitingFor', { lang: shownState.value.waitingFor })
  : shownState.value.translating ? t('translation.state.translating')
  : shownState.value.published && shownState.value.date && new Date(shownState.value.date).getTime() > Date.now() ? t('editor.scheduled')
    : shownState.value.published ? t('editor.published') : t('editor.draft')))
const stateLang = computed(() => (locales.value && (locales.value.all.length > 1) ? localeName(currentLocale.value) : null))
// Is the address of this language on the website right now? Not while it is a draft, scheduled, or waiting
// for the default language: then the address is not a link to a live page, and the preview stands in for it.
const liveHere = computed(() => shownState.value.published && !shownState.value.waitingFor
  && !(shownState.value.date && new Date(shownState.value.date).getTime() > Date.now()))

// A changed address leaves redirects behind: the "Saved" says so.
let redirectsMade = 0
const redirectNote = () => (redirectsMade ? { successTitle: t('editor.savedRedirect', { count: redirectsMade }) } : undefined)
async function save(successTitle?: string | null) {
  if (isTranslation.value) return saveTranslation(successTitle)
  redirectsMade = 0
  return form.submit(async () => {
    if (isNew.value) {
      const url: string = `/api/cms/${entity.value}`
      const res: any = await $fetch(url, { method: 'POST', body: form.body() })
      dirty.value = false // before the redirect, so the leave-guard does not fire
      handedOver.value = momentAfterCreate.value
      // Replace: Back then goes to where they came from, not to a blank "new" form.
      await router.replace(`/admin/${entity.value}/${res.row.id}`)
    }
    else {
      const url: string = `/api/cms/${entity.value}/${id.value}`
      const headers: Record<string, string> = { ...(version.value ? { 'x-cms-version': version.value } : {}), ...collabHeaders() }
      const res: any = await $fetch(url, { method: 'PATCH', body: form.body(), headers })
      redirectsMade = Number(res?.redirects) || 0
      savedAt.value = res?.row?.updatedAt ?? new Date().toISOString()
      version.value = res?.row?.updatedAt ?? null
      // The publish date may have been stamped by the server: show what was stored —
      // quietly, it is the saved value, not an edit made during the save.
      const dateKey = publish.value?.dateField
      if (dateKey && res?.row && dateKey in res.row) form.quiet(() => { state[dateKey] = res.row[dateKey] })
      if (live) live.incoming.value = null
      if (successTitle === undefined) return redirectNote()
    }
  }, successTitle === undefined ? (isNew.value ? t('editor.created') : t('editor.saved')) : successTitle)
}

// Set by Publish / Unpublish on a language that publishes on its own: this save carries its state.
let sendState = false
async function saveTranslation(successTitle?: string | null) {
  redirectsMade = 0
  const withState = sendState
  sendState = false
  return form.submit(async () => {
    const body: Record<string, any> = Object.fromEntries(editable.value.filter((f: any) => f.localized && !f.readOnly).map((f: any) => [f.key, state[f.key] ?? null]))
    const p = publish.value
    if (withState && p) {
      body[p.field] = state[p.field]
      if (p.dateField) body[p.dateField] = state[p.dateField] ?? null
    }
    const url: string = `/api/cms/${entity.value}/${id.value}?locale=${currentLocale.value}`
    const headers: Record<string, string> = { ...(version.value ? { 'x-cms-version': version.value } : {}), ...collabHeaders() }
    const res: any = await $fetch(url, { method: 'PATCH', body, headers })
    redirectsMade = Number(res?.row?.__redirects) || 0
    // The translation's own time (`updatedAt` on this row is the entry's: the original's, saved long before).
    savedAt.value = cmsSavedAt(res?.row, true) ?? new Date().toISOString()
    version.value = res?.row?.__version ?? null
    if (live) live.incoming.value = null
    // Saved with nothing in it, the language is not translated (the server kept no row).
    translated.value = !!res?.row?.__translated
    const code = currentLocale.value
    if (code) available.value = translated.value ? [...new Set([...available.value, code])] : available.value.filter((l) => l !== code)
    // The state this language is in now (the date may have been stamped by the server): shown as stored, quietly.
    if (perLocale.value && res?.row) {
      stateOwn.value = !!res.row.__stateOwn
      states.value = res.row.__states ?? states.value
      form.quiet(() => {
        if (p) {
          state[p.field] = res.row[p.field]
          if (p.dateField) state[p.dateField] = res.row[p.dateField] ?? null
        }
      })
    }
    return successTitle === undefined ? redirectNote() : undefined
  }, successTitle === undefined ? t('editor.saved') : successTitle)
}

async function removeTranslation() {
  const lang = localeName(currentLocale.value)
  if (!await confirm({ title: t('translation.removeTitle', { lang }), description: t('translation.removeBody', { lang }), icon: 'i-lucide-languages', confirmLabel: t('translation.remove'), cancelLabel: t('common.cancel'), color: 'error' })) return
  try {
    const url: string = `/api/cms/${entity.value}/${id.value}?locale=${currentLocale.value}`
    removedHere = true
    await $fetch(url, { method: 'DELETE' })
    toast.add({ title: t('translation.removed'), icon: 'i-lucide-check', color: 'success' })
    dirty.value = false
    await router.push({ query: {} })
  }
  catch (e: any) {
    removedHere = false
    toast.add({ title: t('team.actionFailed'), description: cmsRequestError(e, t as any), icon: 'i-lucide-x', color: 'error' })
  }
}

/** One language's state in the words the list and the bar use ("On the website", "Waiting for Czech", "Being translated"). */
const stateWord = (s: { state: 'published' | 'scheduled' | 'draft'; waitingFor?: string; translating?: true }) => (s.waitingFor
  ? t('translation.waitingFor', { lang: localeName(s.waitingFor) })
  : s.translating ? t('translation.state.translating')
  : t(`translation.state.${s.state}`))
const localeItems = computed(() => (locales.value?.all ?? []).map((code) => ({
  label: code === locales.value?.default ? `${localeLabel(code)} (${t('translation.default')})` : localeLabel(code),
  description: perLocale.value && states.value[code]
    ? [stateWord(states.value[code]!), code !== locales.value?.default && !available.value.includes(code) ? t('translation.notTranslated') : ''].filter(Boolean).join(' · ')
    : code === locales.value?.default ? undefined : (available.value.includes(code) ? t('translation.translated') : t('translation.notTranslated')),
  icon: code === currentLocale.value ? 'i-lucide-check' : undefined,
  to: { query: code === locales.value?.default ? {} : { locale: code } },
})))

async function setPublished(next: boolean, quiet = false): Promise<boolean> {
  const p = publish.value
  if (!p) return false
  const before = { status: state[p.field], date: p.dateField ? state[p.dateField] : undefined }
  state[p.field] = next ? p.publishedValue : p.draftValue
  if (isTranslation.value) sendState = true
  // The server stamps the publish date when there is none (its clock, not ours).
  const ok = await save(quiet ? null : next ? (futureDate.value ? t('editor.scheduledToast', { date: formatDate(publishedOn.value) }) : t('editor.publishedToast')) : t('editor.unpublishedToast'))
  if (!ok) {
    sendState = false
    // Never show "Published" for something the server did not accept.
    state[p.field] = before.status
    if (p.dateField) state[p.dateField] = before.date
  }
  return !!ok
}

/** A language that publishes on its own follows the default language again. */
async function followDefault() {
  const p = publish.value
  if (!p || !isTranslation.value) return
  const before = { status: state[p.field], date: p.dateField ? state[p.dateField] : undefined }
  state[p.field] = null
  if (p.dateField) state[p.dateField] = null
  sendState = true
  const ok = await save(t('translation.followDefaultDone', { lang: localeName(currentLocale.value) }))
  if (ok) await loadNewest()
  else {
    sendState = false
    state[p.field] = before.status
    if (p.dateField) state[p.dateField] = before.date
  }
}

// ── the review step before going live, and the moment after ──
const reviewOpen = ref(false)
const publicPath = computed(() => previewUrl.value?.split('?')[0] ?? null)
const dateFieldDesc = computed(() => (publish.value?.dateField ? editable.value.find((f: any) => f.key === publish.value.dateField) : undefined))
const hasContent = (f: any, v: any) => {
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (f.type === 'richtext') return /"text":"[^"]|"type":"image"/.test(JSON.stringify(v))
  return true
}
function toDetails() {
  document.querySelector('.cms-editor__aside')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
/** Close the review and bring the field into view (its tab first). */
async function goToField(key: string) {
  reviewOpen.value = false
  const group = writeGroups.value.find((g) => g.fields.some((f: any) => f.key === key))
  if (group) {
    detailsOpen.value = true
    openGroups[group.id] = true
  }
  await nextTick()
  const el = document.getElementById(`cms-field-${key}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // Show where: focus it and flash a ring around it for a moment.
  setTimeout(() => (el as HTMLElement).focus?.({ preventScroll: true }), 350)
  el.classList.remove('cms-flash')
  void el.offsetWidth
  el.classList.add('cms-flash')
  setTimeout(() => el.classList.remove('cms-flash'), 2000)
}
/** A language that publishes on its own while the default language is a draft: publishing it now only makes it ready. */
const gatedByDefault = computed(() => isTranslation.value && perLocale.value && !!locales.value && states.value[locales.value.default]?.state === 'draft')
const reviewChecks = computed(() => {
  const out: { ok: boolean; blocking?: boolean; title: string; description?: string; action?: { label: string; onClick: () => void } }[] = []
  // A translated field left empty is not empty on the website: visitors see the default language's
  // text there (and a translation may leave even a required field to it). Said as such, never as
  // "the page without it", and it never blocks.
  const fallsBack = (f: any) => isTranslation.value && f.localized && hasContent(f, defaults.value[f.key])
  const fallback = (f: any) => ({
    ok: false, title: t('review.missing', { field: fieldLabel(f) }), description: t('review.fallbackBody', { lang: defaultLabel.value }),
    action: { label: t('review.translate'), onClick: () => goToField(f.key) },
  })
  const tf = titleField.value
  if (tf) {
    const v = state[tf.key]
    out.push(v
      ? { ok: true, title: fieldLabel(tf), description: String(v) }
      : fallsBack(tf) ? fallback(tf)
        // A required title blocks like any other required field, in the same words.
        : { ok: false, blocking: !tf.optional, title: t('review.missing', { field: fieldLabel(tf) }), description: tf.optional ? t('review.titleMissingBody') : t('review.requiredBody'), action: { label: t('review.fix'), onClick: () => goToField(tf.key) } })
  }
  // Required fields left empty: the save would be refused, so these come first and
  // block publishing. A translation only checks what it translates.
  for (const f of (meta.value?.fields ?? []) as any[]) {
    if (f === tf || f.key === meta.value?.orderField) continue
    if (!(f.required || f.relation?.required)) continue
    if (isTranslation.value && !f.localized) continue
    if (hasContent(f, state[f.key])) continue
    if (fallsBack(f)) {
      if (!mainFields.value.includes(f)) out.push(fallback(f))
      continue
    }
    out.unshift({ ok: false, blocking: true, title: t('review.missing', { field: fieldLabel(f) }), description: t('review.requiredBody'), action: { label: t('review.fix'), onClick: () => goToField(f.key) } })
  }
  // The content itself: the text body and the main picture. Galleries, files and
  // other extras are optional by nature and are not worth a warning.
  const mainPicture = mainFields.value.find((f: any) => f.type === 'media' && (!f.meta?.accept || String(f.meta.accept).startsWith('image')))
  for (const f of mainFields.value) {
    if (f.type !== 'richtext' && f !== mainPicture) continue
    out.push(hasContent(f, state[f.key])
      ? { ok: true, title: fieldLabel(f) }
      : fallsBack(f) ? fallback(f)
        : { ok: false, title: t('review.missing', { field: fieldLabel(f) }), description: t('review.missingBody'), action: { label: t('review.add'), onClick: () => goToField(f.key) } })
  }
  if (publicPath.value) out.push({ ok: true, title: t('review.address'), description: publicPath.value })
  // A language that publishes on its own while the default language is a draft: it goes live together with
  // it, not now. Said plainly, before the rest (after anything that blocks).
  if (gatedByDefault.value) {
    const blocking = out.filter((c) => c.blocking)
    out.splice(0, blocking.length, ...blocking, {
      ok: false, title: t('review.defaultNotLive', { lang: cmsCapitalize(defaultLabel.value, adminLocale.value) }),
      description: t('review.defaultNotLiveBody', { default: defaultLabel.value }),
    })
  }
  // Translations not written yet (the page then shows the default language).
  if (locales.value && !isNew.value && !isTranslation.value) {
    for (const code of locales.value.all) {
      if (code === locales.value.default || available.value.includes(code)) continue
      out.push({
        ok: false, title: t('review.translationMissing', { lang: localeName(code) }), description: t('review.translationMissingBody', { lang: defaultLabel.value }),
        action: { label: t('review.translate'), onClick: () => { reviewOpen.value = false; router.push({ query: { locale: code } }) } },
      })
    }
  }
  // Text nobody has saved. What is in the form goes live with this publish (it is saved
  // first) — also what others are typing right now; text a closed tab left behind waits aside, not in it.
  if (collab && !isNew.value) {
    const typing = others.value.filter((p) => p.editing).map((p) => p.name)
    const unsavedShared = (editable.value as any[]).filter((f) => sharedFields.value.has(f.key) && f.key in form.changedFields())
    if (others.value.length && unsavedShared.length) {
      out.push({
        ok: false, title: t('review.sharedUnsaved', { names: (typing.length ? typing : others.value.map((p) => p.name)).join(', ') }),
        description: t('review.sharedUnsavedBody', { fields: unsavedShared.map((f) => fieldLabel(f)).join(', ') }),
      })
    }
    if (collab.unsaved.value) {
      out.push({
        ok: false, title: t('review.unsavedLeft'), description: t('review.unsavedLeftBody'),
        action: { label: t('review.look'), onClick: () => { reviewOpen.value = false; nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' })) } },
      })
    }
  }
  return out
})
const moment = ref<null | 'published' | 'scheduled' | 'waiting'>(null)
const momentOpen = computed({ get: () => !!moment.value, set: (v: boolean) => { if (!v) moment.value = null } })
// A new entry published from the review is saved first, then opened at its own
// address (a new page): the moment is handed over in app state and shown there.
const momentAfterCreate = ref<null | 'published' | 'scheduled'>(null)
const handedOver = useState<null | 'published' | 'scheduled'>('cms-moment', () => null)
onMounted(() => {
  if (handedOver.value) {
    moment.value = handedOver.value
    handedOver.value = null
  }
})
async function publishFromReview(when: 'now' | 'schedule') {
  const dk = publish.value?.dateField
  if (when === 'now' && dk && futureDate.value) state[dk] = null
  const kind = when === 'schedule' ? 'scheduled' : 'published'
  momentAfterCreate.value = kind
  const ok = await setPublished(true, true)
  momentAfterCreate.value = null
  if (!ok) {
    reviewOpen.value = false
    return
  }
  reviewOpen.value = false
  // A language published while the default language is a draft is ready, not live: it says so.
  moment.value = kind === 'published' && shownState.value.waitingFor ? 'waiting' : kind
}

// A page tree: the address runs through the ancestors, so it comes from the server (the saved
// parent and address parts), refreshed after each save.
const treeRows = meta.value?.tree && !isNew.value
  ? await useFetch<{ rows: { id: string; parentId: string | null; onSite: boolean; paths: Record<string, string> }[] }>(() => `/api/cms/${entity.value}/_tree`, { key: `cms-tree-address:${entity.value}:${id.value}` })
  : null
watch(savedAt, () => treeRows?.refresh())
/** How many pages under this one are on the website now (they go with it when it is taken down). */
const subpagesOnSite = computed(() => {
  const rows = treeRows?.data.value?.rows ?? []
  const byParent = new Map<string | null, typeof rows>()
  for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r])
  let count = 0
  const seen = new Set<string>()
  const walk = (parent: string) => {
    for (const r of byParent.get(parent) ?? []) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      if (r.onSite) count++
      walk(r.id)
    }
  }
  walk(id.value)
  return count
})
const treeAddress = computed(() => treeRows?.data.value?.rows.find((r) => r.id === id.value)?.paths?.[currentLocale.value ?? ''] ?? null)

const previewUrl = computed(() => {
  if (meta.value?.tree) {
    if (isNew.value || !treeAddress.value) return null
    return `${treeAddress.value}?preview${isTranslation.value ? `&locale=${currentLocale.value}` : ''}`
  }
  // The address in the language being edited (prefix included), from the graph.
  const paths: Record<string, string> | null = meta.value?.previewPaths ?? null
  // A language left out of a per-language map has no page: no preview then. An entry
  // without languages of its own uses the default language's address.
  const template = !paths ? null : currentLocale.value ? (paths[currentLocale.value] ?? null) : (paths[''] ?? Object.values(paths)[0] ?? null)
  if (!template || isNew.value) return null
  let ok = true
  const url = template.replace(/:(\w+)/g, (_m: string, k: string) => {
    const v = state[k]
    if (v === undefined || v === null || v === '') ok = false
    return encodeURIComponent(v ?? '')
  })
  return ok ? `${url}?preview${isTranslation.value ? `&locale=${currentLocale.value}` : ''}` : null
})

defineShortcuts({ meta_s: { usingInput: true, handler: () => { if (!saving.value) save() } } })
</script>

<template>
  <CmsPage v-if="graph && (!meta || missing)" :title="t('nav.notFoundTitle')">
    <CmsEmptyState variant="no-results" icon="i-lucide-map-pin-off" :title="t('nav.notFoundTitle')" :description="missing && meta ? t('nav.missingEntryBody') : t('nav.notFoundBody')">
      <template #actions>
        <UButton to="/admin" color="neutral" variant="outline" icon="i-lucide-house">{{ t('nav.home') }}</UButton>
      </template>
    </CmsEmptyState>
  </CmsPage>
  <!-- a person who may not add this kind of entry: said, never an editable form that cannot save -->
  <CmsPage v-else-if="cannotCreate" :back="{ label: listLabel, to: `/admin/${entity}` }" :title="listLabel">
    <CmsEmptyState variant="no-results" icon="i-lucide-lock" :title="t('readOnly.cannotCreateTitle')" :description="t('readOnly.cannotCreate')">
      <template #actions>
        <UButton :to="`/admin/${entity}`" color="neutral" variant="outline" icon="i-lucide-chevron-left">{{ t('moment.backTo', { list: listLabel }) }}</UButton>
      </template>
    </CmsEmptyState>
  </CmsPage>
  <CmsPage v-else :back="{ label: listLabel, to: `/admin/${entity}` }" :heading="heading" flush>
    <!-- one top bar for every arrangement: ‹ back · status · saved | language, history, details, preview, the primary action, … -->
    <template #status>
      <!-- phones: one thing — unsaved changes while there are any, else the status. With languages the status names
           whose it is ("English · Draft"), and on phones it is the language switcher too (the bar has no room for both). -->
      <UDropdownMenu v-if="publish && !isNew && narrow && localeItems.length > 1" :items="localeItems" :content="{ align: 'start' }">
        <button
          type="button" class="inline-flex min-w-0 items-center gap-1 rounded-md -mx-1 px-1 py-0.5 hover:bg-elevated/60"
          :class="saving || dirty ? 'max-md:hidden' : ''" :aria-label="`${t('translation.language')}: ${cmsLanguageState(stateLang ?? '', shownStateWord, adminLocale)}`"
        >
          <!-- the bar is short on a phone: the state's mark and the language's code ("○ EN ▾"), never its words, which
               would be cut off; the full words are the button's name and the menu's lines -->
          <CmsStatusBadge compact :published="shownState.published" :scheduled-for="shownState.date" :waiting-for="shownState.waitingFor" :translating="shownState.translating" :lang="(currentLocale ?? '').toUpperCase()" />
          <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
        </button>
      </UDropdownMenu>
      <CmsStatusBadge v-else-if="publish && !isNew" :published="shownState.published" :scheduled-for="shownState.date" :waiting-for="shownState.waitingFor" :translating="shownState.translating" :lang="stateLang" class="min-w-0" :class="saving || dirty ? 'max-md:hidden' : ''" />
      <!-- phones, content without publishing: the language switcher on its own -->
      <UDropdownMenu v-else-if="!isNew && narrow && localeItems.length > 1" :items="localeItems" :content="{ align: 'start' }">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-languages" trailing-icon="i-lucide-chevron-down" :aria-label="t('translation.language')">
          {{ (currentLocale ?? '').toUpperCase() }}
        </UButton>
      </UDropdownMenu>
      <span v-else-if="isNew" class="shrink-0" :class="saving || dirty ? 'max-md:hidden' : ''">{{ t('editor.newEntry') }}</span>
      <span v-if="readOnly" class="inline-flex items-center gap-1 text-muted"><UIcon name="i-lucide-lock" class="size-3.5" />{{ t('readOnly.badge') }}</span>
      <span v-if="!readOnly && ((publish && !isNew) || isNew) && (saving || dirty || savedAt)" class="text-dimmed max-md:hidden" aria-hidden="true">·</span>
      <span v-if="!readOnly" class="truncate" :class="[dirty ? 'cms-unsaved' : '', saving || dirty ? '' : 'max-md:hidden']">
        <template v-if="saving">{{ t('editor.saving') }}</template>
        <template v-else-if="dirty"><span class="md:hidden">{{ t('editor.unsavedShort') }}</span><span class="max-md:hidden">{{ t('editor.unsaved') }}</span></template>
        <CmsTime v-else-if="savedAt" v-slot="{ text }" :value="savedAt" relative>{{ t('editor.savedAgo', { time: text }) }}</CmsTime>
      </span>
    </template>
    <template #actions>
      <CmsPresence :people="others" />
      <UDropdownMenu v-if="locales && !isNew" :items="localeItems" :content="{ align: 'end' }">
        <UButton color="neutral" variant="ghost" icon="i-lucide-languages" trailing-icon="i-lucide-chevron-down" :aria-label="t('translation.language')" class="max-md:hidden">
          {{ (currentLocale ?? '').toUpperCase() }}
        </UButton>
      </UDropdownMenu>
      <UTooltip v-if="!isNew" :text="t('revisions.open')">
        <UButton variant="ghost" color="neutral" icon="i-lucide-history" :aria-label="t('revisions.open')" class="max-md:hidden" @click="() => { historyOpen = true }" />
      </UTooltip>
      <UButton
        v-if="arrangement === 'write' && wide && !split" color="neutral" variant="outline" icon="i-lucide-sliders-horizontal"
        :class="detailsOpen ? 'bg-(--cms-nav-active)' : ''" :aria-pressed="detailsOpen" @click="() => { detailsOpen = !detailsOpen }"
      >{{ t('editor.details') }}</UButton>
      <!-- phones: the details sit under the text; this says they exist and goes there -->
      <UButton
        v-if="!wide && showAside" color="neutral" variant="ghost" icon="i-lucide-sliders-horizontal"
        :aria-label="t('editor.details')" @click="toDetails"
      />
      <UButton
        v-if="previewUrl" color="neutral" variant="outline" icon="i-lucide-eye" class="max-md:hidden"
        :class="split ? 'bg-(--cms-nav-active)' : ''" :aria-pressed="split" @click="togglePreview"
      >{{ t('editor.preview') }}</UButton>

      <!-- one primary action (none for someone who cannot save here) -->
      <template v-if="readOnly" />
      <UButton v-else-if="isTranslation && !(perLocale && publish && canPublish)" :loading="saving" :aria-label="t('translation.save')" @click="() => { save() }">
        <!-- phones: the bar has no room for "Save translation" next to the language and its state -->
        <span class="max-md:hidden">{{ t('translation.save') }}</span><span class="md:hidden">{{ t('common.save') }}</span>
      </UButton>
      <template v-else-if="publish && canPublish">
        <UButton v-if="isPublished && !isNew" :loading="saving" @click="() => { save() }">{{ futureDate ? t('editor.saveChanges') : t('editor.update') }}</UButton>
        <template v-else>
          <UButton color="neutral" variant="outline" :loading="saving" class="max-md:hidden" @click="() => { save() }">{{ t('editor.saveDraft') }}</UButton>
          <!-- phones: with unsaved changes the bar offers Save (Publish waits in the menu), otherwise Publish -->
          <UButton v-if="phoneSave" class="md:hidden" :loading="saving" @click="() => { save() }">{{ t('common.save') }}</UButton>
          <UButton :disabled="saving" :class="phoneSave ? 'max-md:hidden' : ''" @click="() => { reviewOpen = true }">{{ t('editor.publishEllipsis') }}</UButton>
        </template>
      </template>
      <UButton v-else-if="isNew" :loading="saving" @click="() => { save() }">{{ publish ? t('editor.saveDraft') : t('common.create') }}</UButton>
      <UButton v-else :loading="saving" @click="() => { save() }">{{ publish ? t('editor.saveDraft') : t('common.save') }}</UButton>
      <UDropdownMenu v-if="menuGroups.length" :items="menuGroups" :content="{ align: 'end' }">
        <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="t('editor.moreActions')" />
      </UDropdownMenu>
    </template>

    <CmsRevisions
      v-if="!isNew" v-model:open="historyOpen" :entity="entity" :id="id"
      :locale="isTranslation ? currentLocale : null" :fields="editable.filter((f: any) => !workflowFields.has(f.key))" :current="state" @restore="restoreRevision"
    />

    <div
      class="cms-editor"
      :class="[arrangement === 'write' && !split ? 'cms-editor--write' : '', split ? 'cms-editor--split' : '', !showAside ? 'cms-editor--no-aside' : '', comparing && !split ? 'cms-editor--compare' : '']"
    >
      <!-- someone who cannot save here can read everything and change nothing -->
      <fieldset class="cms-fieldset contents" :disabled="readOnly">
      <div class="cms-editor__main">
        <div class="cms-editor__column">
          <UAlert
            v-if="lostText" color="warning" variant="subtle" icon="i-lucide-cloud-off" class="mb-6" role="alert"
            :title="t('live.offlineLost')" :description="t('live.offlineLostBody')"
            :actions="[{ label: t('live.restoreMine'), color: 'neutral', variant: 'outline', onClick: restoreLost }]"
            close @update:open="(open: boolean) => { if (!open) lostText = null }"
          />
          <UAlert
            v-if="readOnly" color="neutral" variant="subtle" icon="i-lucide-lock" class="mb-6" role="status"
            :title="t(`readOnly.${can.why ?? 'role'}`)" :description="t('readOnly.body')"
          />
          <UAlert
            v-if="shadowed" color="warning" variant="subtle" icon="i-lucide-triangle-alert" class="mb-6" role="status"
            :title="t('redirects.shadowsTitle', { title: shadowed.title })" :description="t('redirects.shadowsBody')"
          />
          <CmsUnsavedText :collab="collab" @keep="keepUnsaved" />
          <!-- translating: what the grey text in the empty fields is, said once (each field only offers "Use it as a start") -->
          <p v-if="showsDefault" class="mb-6 flex items-start gap-2 text-sm text-muted">
            <UIcon name="i-lucide-languages" class="size-4 shrink-0 mt-0.5 text-dimmed" aria-hidden="true" />
            <span>{{ t('translation.shownUntil', { lang: defaultLabel }) }}</span>
          </p>
          <CmsLiveNotice
            :deleted="live?.deleted.value" :conflict="conflict" :incoming="live?.incoming.value"
            :list-to="`/admin/${entity}`"
            @load="loadNewest" @save-anyway="saveOnTop" @dismiss="live && (live.incoming.value = null)"
          />

          <!-- form and preview: every field in titled sections -->
          <CmsFormSections
            v-if="sectioned" :fields="formFields" :sections="formSectionConfig" :state="state" :errors="fieldErrors"
            :disclose="!isTranslation" :menu="!split"
          >
            <template #top>
              <!-- the title is the page heading; the address it will have sits under it -->
              <div v-if="titleField">
              <label v-if="titleIsAddress" :for="`cms-field-${titleField.key}`" class="block mb-1 text-sm font-medium text-highlighted">{{ fieldLabel(titleField) }}</label>
                <textarea
                  :id="`cms-field-${titleField.key}`" v-model="state[titleField.key]" rows="1" class="cms-title-input resize-none field-sizing-content" :class="titleIsAddress ? 'cms-title-input--address' : ''"
                  :placeholder="translatedPlaceholder(titleField) ?? titlePlaceholder"
                  :disabled="(isTranslation && !titleField.localized) || !!titleField.readOnly"
                  :aria-label="fieldLabel(titleField)" :aria-invalid="!!fieldErrors[titleField.key]" :aria-describedby="fieldErrors[titleField.key] ? `cms-field-${titleField.key}-error` : undefined" autocomplete="off"
                  @keydown.enter.prevent
                />
                <p v-if="fieldErrors[titleField.key]" :id="`cms-field-${titleField.key}-error`" role="alert" class="mt-1 text-sm text-error">{{ fieldErrors[titleField.key] }}</p>
              <p v-else-if="titleIsAddress && fieldHelp(titleField)" class="mt-1.5 text-sm text-muted">{{ fieldHelp(titleField) }}</p>
                <CmsEntryAddress v-else-if="publicPath" :path="publicPath" :live="liveHere" :can-preview="!!previewUrl && !split" @preview="togglePreview" />
                <CmsTranslationRef
                  v-if="isTranslation && titleField.localized" :field="titleField" :value="defaults[titleField.key]"
                  :lang="defaultLabel" :empty="!state[titleField.key]" @copy="state[titleField.key] = defaults[titleField.key]"
                />
              </div>
            </template>
            <template #field="{ field: f }">
              <!-- translating: the default language's text greyed in the empty field, and a line saying so with the
                   copy action, right at the field (above a long text, under a short one) -->
              <CmsTranslationRef
                v-if="isTranslation && refAbove(f)" :field="f" :value="defaults[f.key]" :lang="defaultLabel" above
                :empty="state[f.key] == null || (Array.isArray(state[f.key]) && !state[f.key].length) || (f.type === 'richtext' && isEmptyRichText(state[f.key]))"
                @copy="copyDefault(f.key)"
              />
              <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="main" hide-optional :fallback="fallbackOf(f)" />
              <CmsTranslationRef
                v-if="isTranslation && !refAbove(f)" :field="f" :value="defaults[f.key]" :lang="defaultLabel"
                :empty="state[f.key] == null || state[f.key] === ''"
                @copy="copyDefault(f.key)"
              />
            </template>
          </CmsFormSections>

          <!-- write: the cover photo, the title, the summary, the text — as the reader meets them -->
          <div v-else class="space-y-6">
            <CmsFieldMedia
              v-if="writeCover" :id="`cms-field-${writeCover.key}`" v-model="state[writeCover.key]" :field="writeCover" :entity="entity"
              variant="cover" class="mb-2"
            />
            <!-- the title is the page heading; the address it will have sits under it -->
            <div v-if="titleField">
              <label v-if="titleIsAddress" :for="`cms-field-${titleField.key}`" class="block mb-1 text-sm font-medium text-highlighted">{{ fieldLabel(titleField) }}</label>
              <textarea
                :id="`cms-field-${titleField.key}`" v-model="state[titleField.key]" rows="1" class="cms-title-input resize-none field-sizing-content" :class="titleIsAddress ? 'cms-title-input--address' : ''"
                :placeholder="translatedPlaceholder(titleField) ?? titlePlaceholder"
                :disabled="(isTranslation && !titleField.localized) || !!titleField.readOnly"
                :aria-label="fieldLabel(titleField)" :aria-invalid="!!fieldErrors[titleField.key]" :aria-describedby="fieldErrors[titleField.key] ? `cms-field-${titleField.key}-error` : undefined" autocomplete="off"
                @keydown.enter.prevent
              />
              <p v-if="fieldErrors[titleField.key]" :id="`cms-field-${titleField.key}-error`" role="alert" class="mt-1 text-sm text-error">{{ fieldErrors[titleField.key] }}</p>
              <p v-else-if="titleIsAddress && fieldHelp(titleField)" class="mt-1.5 text-sm text-muted">{{ fieldHelp(titleField) }}</p>
              <CmsEntryAddress v-else-if="publicPath" :path="publicPath" :live="liveHere" :can-preview="!!previewUrl && !split" @preview="togglePreview" />
              <CmsTranslationRef
                v-if="isTranslation && titleField.localized" :field="titleField" :value="defaults[titleField.key]"
                :lang="defaultLabel" :empty="!state[titleField.key]" @copy="state[titleField.key] = defaults[titleField.key]"
              />
            </div>
            <!-- the summary: large, unboxed, right under the title -->
            <div v-if="writeLead">
              <textarea
                :id="`cms-field-${writeLead.key}`" v-model="state[writeLead.key]" rows="2"
                class="cms-lead-input resize-none field-sizing-content" :maxlength="writeLead.meta?.max"
                :placeholder="translatedPlaceholder(writeLead) ?? (fieldHelp(writeLead) || fieldLabel(writeLead))"
                :aria-label="fieldLabel(writeLead)" :aria-invalid="!!fieldErrors[writeLead.key]" :aria-describedby="fieldErrors[writeLead.key] ? `cms-field-${writeLead.key}-error` : undefined"
              />
              <p v-if="fieldErrors[writeLead.key]" :id="`cms-field-${writeLead.key}-error`" role="alert" class="mt-1 text-sm text-error">{{ fieldErrors[writeLead.key] }}</p>
              <p v-else-if="writeLead.meta?.max && (state[writeLead.key]?.length ?? 0) > writeLead.meta.max * 0.8" class="mt-1 text-xs text-muted tabular-nums">
                {{ state[writeLead.key]?.length ?? 0 }} / {{ writeLead.meta.max }}
              </p>
              <CmsTranslationRef
                v-if="isTranslation" :field="writeLead" :value="defaults[writeLead.key]" :lang="defaultLabel"
                :empty="!state[writeLead.key]" @copy="copyDefault(writeLead.key)"
              />
            </div>
            <!-- the text: no box, the toolbar a quiet line above it -->
            <div v-if="writeBody" :id="`cms-field-${writeBody.key}`" class="cms-write-body" :aria-label="fieldLabel(writeBody)" role="group">
              <!-- translating: what the default language says, above the text (not under a long one) -->
              <CmsTranslationRef
                v-if="isTranslation" v-model:compare="compareOriginal" :field="writeBody" :value="defaults[writeBody.key]" :lang="defaultLabel" above
                :empty="state[writeBody.key] == null || isEmptyRichText(state[writeBody.key])" :can-compare="roomy"
                @copy="copyDefault(writeBody.key)"
              />
              <div :class="comparing ? 'cms-compare' : ''">
                <!-- wide screens, on request: the original beside the translation, as the reader meets both -->
                <section v-if="comparing" class="cms-compare__original" :aria-label="t('translation.originalLabel', { lang: defaultLabel })">
                  <p class="cms-compare__label">{{ t('translation.originalLabel', { lang: defaultLabel }) }}</p>
                  <CmsContent :doc="defaults[writeBody.key]" class="cms-prose" />
                </section>
                <CmsFieldRichText v-model="state[writeBody.key]" :field="writeBody" :fallback="comparing ? undefined : fallbackOf(writeBody)" />
              </div>
              <p v-if="fieldErrors[writeBody.key]" :id="`cms-field-${writeBody.key}-error`" role="alert" class="mt-1 text-sm text-error">{{ fieldErrors[writeBody.key] }}</p>
            </div>
            <div v-for="f in writeMore" :key="f.key">
              <CmsTranslationRef
                v-if="isTranslation" :field="f" :value="defaults[f.key]" :lang="defaultLabel" above
                :empty="state[f.key] == null || (Array.isArray(state[f.key]) && !state[f.key].length) || (f.type === 'richtext' && isEmptyRichText(state[f.key]))"
                @copy="copyDefault(f.key)"
              />
              <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="main" :fallback="fallbackOf(f)" />
            </div>
          </div>
        </div>
      </div>

      <aside v-if="showAside" class="cms-editor__aside" :aria-label="t('editor.details')">
        <div class="cms-editor__aside-inner space-y-5">
          <!-- the status itself is in the top bar; here only what it does not say -->
          <div v-if="publish && !isNew && (asideNote || (isTranslation && (!perLocale || !stateOwn)))" class="flex items-start gap-2 text-sm text-muted">
            <UIcon :name="isScheduled ? 'i-lucide-clock' : isPublished ? 'i-lucide-globe' : 'i-lucide-pencil-line'" class="size-4 shrink-0 mt-0.5" />
            <div>
              <p v-if="asideNote">{{ asideNote }}</p>
              <p v-if="isTranslation && !perLocale" class="text-xs">{{ t('translation.publishingShared') }}</p>
              <p v-else-if="isTranslation && !stateOwn" class="text-xs">{{ t('translation.followsDefault', { lang: defaultLabel }) }}</p>
            </div>
          </div>

          <!-- form and preview: what the fields do not say — where it is, when it was saved -->
          <dl v-if="sectioned" class="space-y-3 text-sm">
            <div v-if="isNew" class="flex items-start gap-2 text-muted">
              <dt class="sr-only">{{ t('editor.newEntry') }}</dt>
              <UIcon name="i-lucide-sparkles" class="size-4 shrink-0 mt-0.5" />
              <dd>{{ t('editor.newEntryHint') }}</dd>
            </div>
            <div v-if="publicPath && liveHere" class="flex items-start gap-2 min-w-0">
              <dt class="sr-only">{{ t('editor.onWebsite') }}</dt>
              <UIcon name="i-lucide-link" class="size-4 shrink-0 mt-0.5 text-muted" />
              <dd class="min-w-0"><a :href="publicPath" target="_blank" rel="noopener" class="text-highlighted hover:underline underline-offset-2 break-all">{{ publicPath }}</a></dd>
            </div>
            <div v-if="createdAt && !isNew" class="flex items-start gap-2 text-muted">
              <dt class="sr-only">{{ t('editor.created') }}</dt>
              <UIcon name="i-lucide-calendar-plus" class="size-4 shrink-0 mt-0.5" />
              <dd>{{ t('editor.createdOn', { date: formatDate(createdAt, { time: false }) }) }}</dd>
            </div>
            <div v-if="locales && !isNew" class="flex items-start gap-2">
              <dt class="sr-only">{{ t('translation.languages') }}</dt>
              <UIcon name="i-lucide-languages" class="size-4 shrink-0 mt-0.5 text-muted" />
              <dd class="min-w-0 flex-1">
                <ul class="space-y-1.5">
                  <li v-for="code in locales.all" :key="code" class="flex items-center justify-between gap-2">
                    <NuxtLink
                      :to="{ query: code === locales.default ? {} : { locale: code } }"
                      class="hover:underline underline-offset-2" :class="code === currentLocale ? 'font-medium text-highlighted' : 'text-default'"
                    >{{ localeLabel(code) }}</NuxtLink>
                    <span v-if="perLocale && states[code]" class="flex items-center gap-2 text-xs text-muted">
                      <span v-if="code !== locales.default && !available.includes(code)" class="cms-unsaved">{{ t('translation.notTranslated') }}</span>
                      <CmsStatusBadge :published="states[code].state !== 'draft'" :scheduled-for="states[code].state === 'scheduled' ? states[code].date : null" :waiting-for="states[code].waitingFor ? localeName(states[code].waitingFor) : null" :translating="states[code].translating ? defaultLabel : null" />
                      <UTooltip v-if="code !== locales.default && !states[code].own" :text="t('translation.followsDefault', { lang: defaultLabel })">
                        <UIcon name="i-lucide-link" class="size-3.5 text-dimmed" />
                      </UTooltip>
                    </span>
                    <span v-else class="text-xs" :class="code === locales.default || available.includes(code) ? 'text-muted' : 'cms-unsaved'">
                      {{ code === locales.default ? t('translation.default') : available.includes(code) ? t('translation.translated') : t('translation.notTranslated') }}
                    </span>
                  </li>
                </ul>
              </dd>
            </div>
          </dl>

          <!-- write: the details beside the text, as quiet rows -->
          <div v-else class="space-y-1">
            <div v-for="f in writeRows" :key="f.key">
              <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="sidebar" row :fallback="fallbackOf(f)" />
              <CmsTranslationRef
                v-if="isTranslation" :field="f" :value="defaults[f.key]" :lang="defaultLabel" :empty="!state[f.key]"
                @copy="state[f.key] = defaults[f.key]"
              />
            </div>
          </div>
          <p v-if="isTranslation && hasSharedFields" class="text-xs text-muted border-t border-default pt-4">
            {{ t('translation.shared') }}
            <NuxtLink :to="{ query: {} }" class="underline underline-offset-2 hover:text-highlighted">{{ t('translation.editShared', { lang: defaultLabel }) }}</NuxtLink>
          </p>

          <!-- write: photos, race facts, search… folded, each saying what is filled in -->
          <div v-if="!sectioned" class="border-t border-default">
            <UCollapsible v-for="g in writeGroups" :key="g.id" v-model:open="openGroups[g.id]" class="border-b border-default">
              <button type="button" class="group w-full flex items-center justify-between gap-3 py-3.5 text-left">
                <span class="text-sm font-medium text-highlighted">{{ g.label }}</span>
                <span class="flex items-center gap-2 text-xs text-muted">
                  {{ groupSummary(g) }}
                  <UIcon name="i-lucide-chevron-down" class="size-4 text-dimmed transition-transform group-data-[state=open]:rotate-180" />
                </span>
              </button>
              <template #content>
                <div class="space-y-5 pb-5">
                  <div v-for="f in g.fields" :key="f.key">
                    <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="sidebar" hide-optional :fallback="fallbackOf(f)" />
                    <CmsTranslationRef
                      v-if="isTranslation" :field="f" :value="defaults[f.key]" :lang="defaultLabel"
                      :empty="state[f.key] == null || (Array.isArray(state[f.key]) && !state[f.key].length)"
                      @copy="copyDefault(f.key)"
                    />
                  </div>
                </div>
              </template>
            </UCollapsible>
          </div>
        </div>
      </aside>
      </fieldset>
      <div v-if="split && previewUrl" class="cms-editor__preview">
        <CmsPreviewPanel
          :url="previewUrl" :entity="entity" :id="id"
          :locale="isTranslation ? currentLocale : null" :data="form.body()" :version="version" @close="togglePreview"
        />
      </div>
    </div>

    <!-- small screens: the page as a full-screen sheet -->
    <UModal v-if="previewUrl" v-model:open="previewSheet" fullscreen :title="t('editor.preview')" :ui="{ header: 'hidden', body: 'p-3 sm:p-4 flex flex-col' }">
      <template #body>
        <CmsPreviewPanel
          :url="previewUrl" :entity="entity" :id="id" sheet
          :locale="isTranslation ? currentLocale : null" :data="form.body()" :version="version" @close="previewSheet = false"
        />
      </template>
    </UModal>

    <CmsPublishReview
      v-if="publish && canPublish" v-model:open="reviewOpen"
      :checks="reviewChecks" :entity="entity" :busy="saving"
      :title="isTranslation && perLocale ? t('review.titleLang', { lang: localeName(currentLocale) }) : undefined"
      :subtitle="isTranslation && perLocale ? (shownState.translating ? t('review.subtitleTranslating', { default: shownState.translating }) : t('review.subtitleLang')) : undefined"
      :now-hint="gatedByDefault ? t('review.nowHintGated', { lang: defaultLabel }) : undefined"
      :publish-label="gatedByDefault ? t('editor.publish') : undefined"
      :date-field="dateFieldDesc" :date="publish.dateField ? state[publish.dateField] : undefined"
      @update:date="(v: any) => { if (publish?.dateField) state[publish.dateField] = v }"
      @publish="publishFromReview"
    />
    <CmsMoment
      v-model:open="momentOpen" :animal="moment === 'published' ? 'whale' : 'turtle'"
      :title="moment === 'scheduled' ? t('moment.scheduledTitle') : moment === 'waiting' ? t('moment.waitingTitle') : t('moment.liveTitle')"
      :description="moment === 'scheduled' ? t('moment.scheduledBody', { date: formatDate(publishedOn) }) : moment === 'waiting' ? t('moment.waitingBody', { lang: defaultLabel }) : t('moment.liveBody')"
    >
      <UButton v-if="moment === 'published' && publicPath" :to="publicPath" target="_blank" size="sm" color="neutral" variant="outline" icon="i-lucide-arrow-up-right">{{ t('moment.view') }}</UButton>
      <UButton :to="`/admin/${entity}`" size="sm" color="neutral" variant="ghost">{{ t('moment.backTo', { list: listLabel }) }}</UButton>
    </CmsMoment>
  </CmsPage>
</template>

<style scoped>
/* Read-only: still easy to read (the browser dims disabled controls a lot). */
.cms-fieldset:disabled :is(input, textarea, select, button):disabled { opacity: 0.85; cursor: default; }
.cms-fieldset:disabled :deep(.cms-rte__toolbar) { display: none; }
</style>
