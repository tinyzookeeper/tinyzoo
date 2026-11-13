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
const { t, tl, entityLabel, entitySingular, fieldLabel, formatDate } = useCmsI18n()
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
const localeLabel = (code?: string | null) => (code ? tl(locales.value?.labels?.[code], code.toUpperCase()) : '')
const defaultLabel = computed(() => localeLabel(locales.value?.default))
const available = ref<string[]>([])
const defaults = ref<Record<string, any>>({})
const translated = ref(false)

const savedAt = ref<string | null>(null)
// The version this tab edits (the entry's updatedAt): sent with every save, so saving
// over someone else's newer version is refused unless the editor chooses to.
const version = ref<string | null>(null)
const rowUrl = (): string => `/api/cms/${entity.value}/${id.value}${isTranslation.value ? `?locale=${currentLocale.value}` : ''}`
function adopt(row: Record<string, any> | null | undefined) {
  savedAt.value = row?.updatedAt ?? null
  // A translation has its own version.
  version.value = (isTranslation.value ? row?.__version : row?.updatedAt) ?? null
  available.value = row?.__locales ?? []
  defaults.value = row?.__defaults ?? {}
  translated.value = !!row?.__translated
}
if (!isNew.value) {
  const { data } = await useFetch<{ row: Record<string, any> }>(rowUrl)
  form.load(data.value?.row)
  adopt(data.value?.row)
}
else {
  form.load({})
}

const fetchRow = async () => (await $fetch<{ row: Record<string, any> }>(rowUrl())).row

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
async function onRemoteChange(c: LiveChange) {
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
const collab = isNew.value ? null : useCmsCollab({ entity: entity.value, id: id.value, locale: isTranslation.value ? currentLocale.value : null })
// Shared on this page right now: a shared editor is mounted for it (not, say, a
// field in a collapsed group, which then merges like any other field).
const sharedFields = computed(() => (collab?.status.value === 'ready' ? collab.mounted.value : new Set<string>()))
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
const moreItems = computed(() => {
  const items: any[] = []
  if (!isNew.value && dirty.value) items.push({ label: t('editor.discard'), icon: 'i-lucide-undo-2', onSelect: discardChanges })
  if (!isNew.value && !isTranslation.value && publish.value && canPublish.value && isPublished.value) {
    items.push({ label: t('editor.unpublish'), icon: 'i-lucide-eye-off', onSelect: () => setPublished(false) })
  }
  if (isTranslation.value && translated.value) items.push({ label: t('translation.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: removeTranslation })
  return items
})

/** Back to the saved version. Shared text goes back for everyone editing it, so ask first. */
async function discardChanges() {
  const others = (live?.others.value ?? []).length > 0 && sharedFields.value.size > 0
  if (!window.confirm(others ? t('editor.discardSharedConfirm') : t('editor.discardConfirm'))) return
  await loadNewest()
}

// Text typed while offline that the shared document could not take back (it was
// restarted meanwhile): offered back, never dropped silently.
const lostText = ref<Record<string, any> | null>(null)
if (collab) watch(collab.lost, (v) => { if (v) lostText.value = v })
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
    if (!(f.key in data) || workflowFields.value.has(f.key)) continue
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
  for (const f of editable.value) {
    const v = data[f.key]
    if (f.type === 'media' && typeof v === 'string') ids.push(v)
    else if (f.type === 'gallery' && Array.isArray(v)) ids.push(...v.map((x: any) => x?.mediaId).filter(Boolean))
    else if (f.type === 'richtext') walk(v)
    else if (f.type === 'blocks' && Array.isArray(v)) {
      for (const b of v) for (const [k, x] of Object.entries(b ?? {})) {
        const bf = f.meta?.blocks?.[b?.type]?.fields?.find((y: any) => y.key === k)
        if (bf?.type === 'media' && typeof x === 'string') ids.push(x)
        else walk(x)
      }
    }
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
const MAIN_TYPES = new Set(['text', 'richtext', 'media', 'blocks', 'gallery'])
const placementOf = (f: any): 'main' | 'sidebar' => f.meta?.position ?? (MAIN_TYPES.has(f.type) ? 'main' : 'sidebar')
// The publish field is changed by the Publish action, not edited as a field. In a
// translation only the translatable fields are shown.
const formFields = computed(() => editable.value.filter((f: any) =>
  f.key !== titleKey.value && f.key !== publish.value?.field && f.key !== meta.value?.orderField && (!isTranslation.value || f.localized)))
const mainFields = computed(() => formFields.value.filter((f: any) => !f.meta?.group && placementOf(f) === 'main'))
// Tabs for long forms (admin.tabs): fields in no tab go into the first. All tabs stay
// mounted, so shared text and field state survive switching.
const tabItems = computed(() => {
  const tabs = (meta.value?.tabs ?? []) as { label: any; fields: string[] }[]
  if (!tabs.length) return []
  const assigned = new Set(tabs.flatMap((tab) => tab.fields))
  return tabs.map((tab, i) => {
    const fields = mainFields.value.filter((f: any) => tab.fields.includes(f.key) || (i === 0 && !assigned.has(f.key)))
    const hasError = fields.some((f: any) => fieldErrors[f.key])
    return { label: tl(tab.label), value: String(i), fields, icon: hasError ? 'i-lucide-circle-alert' : undefined }
  }).filter((tab) => tab.fields.length)
})

// ── live preview beside the form: opened on demand (it loads the site's page, with
// whatever the entry contains, so only when someone asks for it) ──
const previewOpen = ref(false)
function togglePreview() {
  previewOpen.value = !previewOpen.value
}
const sideFields = computed(() => formFields.value.filter((f: any) => !f.meta?.group && placementOf(f) === 'sidebar'))
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
const openGroups = reactive<Record<string, boolean>>({})
// A group with an error inside opens itself.
watch(() => ({ ...fieldErrors }), (errs) => {
  for (const g of groups.value) if (g.fields.some((f: any) => errs[f.key])) openGroups[g.label] = true
})

// ── titles ──
const listLabel = computed(() => entityLabel(meta.value) || entity.value)
const heading = computed(() => {
  const v = titleKey.value ? state[titleKey.value] : ''
  if (v) return String(v)
  return isNew.value ? t('editor.newTitle', { label: entitySingular(meta.value).toLowerCase() }) : t('common.untitled')
})
useHead({ title: heading })

// ── publishing ──
const canPublish = computed(() => meta.value?.can?.publish !== false)
const isPublished = computed(() => !!publish.value && state[publish.value.field] === publish.value.publishedValue)
const publishedOn = computed(() => (publish.value?.dateField ? state[publish.value.dateField] : null))
// A publish date ahead: publishing schedules it (live from that moment).
const futureDate = computed(() => !!publishedOn.value && new Date(publishedOn.value).getTime() > Date.now())
const isScheduled = computed(() => isPublished.value && futureDate.value)

async function save(successTitle?: string) {
  if (isTranslation.value) return saveTranslation()
  return form.submit(async () => {
    if (isNew.value) {
      const url: string = `/api/cms/${entity.value}`
      const res: any = await $fetch(url, { method: 'POST', body: form.body() })
      dirty.value = false // before the redirect, so the leave-guard does not fire
      await router.push(`/admin/${entity.value}/${res.row.id}`)
    }
    else {
      const url: string = `/api/cms/${entity.value}/${id.value}`
      const headers: Record<string, string> = { ...(version.value ? { 'x-cms-version': version.value } : {}), ...collabHeaders() }
      const res: any = await $fetch(url, { method: 'PATCH', body: form.body(), headers })
      savedAt.value = res?.row?.updatedAt ?? new Date().toISOString()
      version.value = res?.row?.updatedAt ?? null
      // The publish date may have been stamped by the server: show what was stored.
      const dateKey = publish.value?.dateField
      if (dateKey && res?.row && dateKey in res.row) state[dateKey] = res.row[dateKey]
      if (live) live.incoming.value = null
    }
  }, successTitle ?? (isNew.value ? t('editor.created') : t('editor.saved')))
}

async function saveTranslation() {
  return form.submit(async () => {
    const body = Object.fromEntries(editable.value.filter((f: any) => f.localized).map((f: any) => [f.key, state[f.key] ?? null]))
    const url: string = `/api/cms/${entity.value}/${id.value}?locale=${currentLocale.value}`
    const headers: Record<string, string> = { ...(version.value ? { 'x-cms-version': version.value } : {}), ...collabHeaders() }
    const res: any = await $fetch(url, { method: 'PATCH', body, headers })
    savedAt.value = res?.row?.updatedAt ?? new Date().toISOString()
    version.value = res?.row?.__version ?? null
    if (live) live.incoming.value = null
    translated.value = true
    if (currentLocale.value && !available.value.includes(currentLocale.value)) available.value = [...available.value, currentLocale.value]
  }, t('editor.saved'))
}

async function removeTranslation() {
  try {
    const url: string = `/api/cms/${entity.value}/${id.value}?locale=${currentLocale.value}`
    await $fetch(url, { method: 'DELETE' })
    toast.add({ title: t('translation.removed'), icon: 'i-lucide-check', color: 'success' })
    dirty.value = false
    await router.push({ query: {} })
  }
  catch (e: any) {
    toast.add({ title: t('team.actionFailed'), description: e?.data?.statusMessage, icon: 'i-lucide-x', color: 'error' })
  }
}

const localeItems = computed(() => (locales.value?.all ?? []).map((code) => ({
  label: code === locales.value?.default ? `${localeLabel(code)} (${t('translation.default')})` : localeLabel(code),
  description: code === locales.value?.default ? undefined : (available.value.includes(code) ? t('translation.translated') : t('translation.notTranslated')),
  icon: code === currentLocale.value ? 'i-lucide-check' : undefined,
  to: { query: code === locales.value?.default ? {} : { locale: code } },
})))

async function setPublished(next: boolean) {
  const p = publish.value
  if (!p) return
  const before = { status: state[p.field], date: p.dateField ? state[p.dateField] : undefined }
  state[p.field] = next ? p.publishedValue : p.draftValue
  // The server stamps the publish date when there is none (its clock, not ours).
  const ok = await save(next ? (futureDate.value ? t('editor.scheduledToast', { date: formatDate(publishedOn.value) }) : t('editor.publishedToast')) : t('editor.unpublishedToast'))
  if (!ok) {
    // Never show "Published" for something the server did not accept.
    state[p.field] = before.status
    if (p.dateField) state[p.dateField] = before.date
  }
}

const previewUrl = computed(() => {
  // The address in the language being edited (prefix included), from the graph.
  const paths: Record<string, string> | null = meta.value?.previewPaths ?? null
  const template = paths ? (paths[currentLocale.value ?? ''] ?? Object.values(paths)[0] ?? null) : null
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
  <CmsPage :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: listLabel, to: `/admin/${entity}` }, { label: heading }]">
    <template #actions>
      <CmsPresence :people="others" />
      <UDropdownMenu v-if="locales && !isNew" :items="localeItems" :content="{ align: 'end' }">
        <UButton color="neutral" variant="ghost" icon="i-lucide-languages" trailing-icon="i-lucide-chevron-down" :aria-label="t('translation.language')">
          {{ (currentLocale ?? '').toUpperCase() }}
        </UButton>
      </UDropdownMenu>
      <span class="hidden md:inline text-sm mr-1" :class="dirty ? 'text-warning' : 'text-dimmed'">
        <template v-if="dirty">{{ t('editor.unsaved') }}</template>
        <template v-else-if="savedAt">{{ t('editor.savedAgo', { time: '' }) }}<CmsTime :value="savedAt" relative /></template>
      </span>
      <UTooltip v-if="!isNew" :text="t('revisions.open')">
        <UButton variant="ghost" color="neutral" icon="i-lucide-history" :aria-label="t('revisions.open')" @click="historyOpen = true" />
      </UTooltip>
      <UTooltip v-if="previewUrl" :text="t('editor.previewPanel')">
        <UButton
          variant="ghost" :color="previewOpen ? 'primary' : 'neutral'" icon="i-lucide-panel-right"
          :aria-label="t('editor.previewPanel')" :aria-pressed="previewOpen" @click="togglePreview"
        />
      </UTooltip>

      <!-- one primary action -->
      <template v-if="isTranslation">
        <UButton :loading="saving" @click="save()">{{ t('translation.save') }}</UButton>
      </template>
      <UButton v-else-if="isNew" :loading="saving" @click="save()">{{ t('common.create') }}</UButton>
      <template v-else-if="publish && canPublish">
        <template v-if="isPublished">
          <UButton :loading="saving" @click="save()">{{ t('editor.update') }}</UButton>
        </template>
        <template v-else>
          <UButton color="neutral" variant="outline" :loading="saving" @click="save()">{{ t('editor.saveDraft') }}</UButton>
          <UButton :loading="saving" :icon="futureDate ? 'i-lucide-clock' : undefined" @click="setPublished(true)">{{ futureDate ? t('editor.schedule') : t('editor.publish') }}</UButton>
        </template>
      </template>
      <UButton v-else :loading="saving" @click="save()">{{ publish ? t('editor.saveDraft') : t('common.save') }}</UButton>
      <UDropdownMenu v-if="moreItems.length" :items="[moreItems]" :content="{ align: 'end' }">
        <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="t('editor.moreActions')" />
      </UDropdownMenu>
    </template>
    <UAlert
      v-if="lostText" color="warning" variant="subtle" icon="i-lucide-cloud-off" class="mb-6" role="alert"
      :title="t('live.offlineLost')" :description="t('live.offlineLostBody')"
      :actions="[{ label: t('live.restoreMine'), color: 'neutral', variant: 'outline', onClick: restoreLost }]"
      close @update:open="(open: boolean) => { if (!open) lostText = null }"
    />

    <CmsRevisions
      v-if="!isNew" v-model:open="historyOpen" :entity="entity" :id="id"
      :locale="isTranslation ? currentLocale : null" :fields="editable.filter((f: any) => !workflowFields.has(f.key))" :current="state" @restore="restoreRevision"
    />
    <CmsLiveNotice
      :deleted="live?.deleted.value" :conflict="conflict" :incoming="live?.incoming.value"
      :list-to="`/admin/${entity}`"
      @load="loadNewest" @save-anyway="saveOnTop" @dismiss="live && (live.incoming.value = null)"
    />
    <div :class="previewOpen && previewUrl ? 'cms-with-preview' : ''">
    <div class="cms-editor">
      <div class="cms-editor__main space-y-8">
        <!-- the title is the page heading -->
        <div v-if="titleField">
          <input
            v-model="state[titleField.key]" class="cms-title-input"
            :placeholder="isTranslation ? (defaults[titleField.key] || t('editor.titlePlaceholder')) : t('editor.titlePlaceholder')"
            :disabled="isTranslation && !titleField.localized"
            :aria-label="fieldLabel(titleField)" :aria-invalid="!!fieldErrors[titleField.key]" autocomplete="off"
          >
          <p v-if="fieldErrors[titleField.key]" class="mt-1 text-sm text-error">{{ fieldErrors[titleField.key] }}</p>
          <CmsTranslationRef
            v-if="isTranslation && titleField.localized" :field="titleField" :value="defaults[titleField.key]"
            :lang="defaultLabel" :empty="!state[titleField.key]" @copy="state[titleField.key] = defaults[titleField.key]"
          />
        </div>
        <UTabs
          v-if="tabItems.length" :items="tabItems" :unmount-on-hide="false" variant="link"
          :ui="{ list: 'border-b border-default gap-4', trigger: 'px-0', content: 'pt-6 space-y-8' }"
        >
          <template #content="{ item }">
            <div v-for="f in (item as any).fields" :key="f.key">
              <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="main" />
              <CmsTranslationRef
                v-if="isTranslation" :field="f" :value="defaults[f.key]" :lang="defaultLabel"
                :empty="state[f.key] == null || (Array.isArray(state[f.key]) && !state[f.key].length)"
                @copy="copyDefault(f.key)"
              />
            </div>
          </template>
        </UTabs>
        <template v-else>
          <div v-for="f in mainFields" :key="f.key">
            <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="main" />
            <CmsTranslationRef
              v-if="isTranslation" :field="f" :value="defaults[f.key]" :lang="defaultLabel"
              :empty="state[f.key] == null || (Array.isArray(state[f.key]) && !state[f.key].length)"
              @copy="copyDefault(f.key)"
            />
          </div>
        </template>
      </div>

      <aside class="cms-editor__aside space-y-5" :aria-label="t('editor.status')">
        <div v-if="publish && !isNew" class="space-y-1">
          <p class="text-xs font-medium text-muted">{{ t('editor.status') }}</p>
          <CmsStatusBadge :published="isPublished" :scheduled-for="publishedOn" />
          <p class="text-xs text-dimmed">
            <template v-if="isScheduled">{{ t('editor.goesLive', { date: formatDate(publishedOn) }) }}</template>
            <template v-else-if="isPublished && publishedOn">{{ t('editor.publishedSince', { date: formatDate(publishedOn, { time: false }) }) }}</template>
            <template v-else-if="!isPublished">{{ canPublish ? t('editor.notPublished') : t('editor.cannotPublish') }}</template>
          </p>
          <p v-if="isTranslation" class="text-xs text-dimmed">{{ t('translation.publishingShared') }}</p>
        </div>

        <div v-for="f in sideFields" :key="f.key">
          <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="sidebar" />
          <CmsTranslationRef
            v-if="isTranslation" :field="f" :value="defaults[f.key]" :lang="defaultLabel" :empty="!state[f.key]"
            @copy="state[f.key] = defaults[f.key]"
          />
        </div>
        <p v-if="isTranslation" class="text-xs text-muted border-t border-default pt-4">
          {{ t('translation.shared') }}
          <NuxtLink :to="{ query: {} }" class="underline underline-offset-2 hover:text-highlighted">{{ t('translation.editShared', { lang: defaultLabel }) }}</NuxtLink>
        </p>

        <UCollapsible
          v-for="g in groups" :key="g.label" v-model:open="openGroups[g.label]"
          class="border-t border-default pt-4"
        >
          <button type="button" class="group w-full flex items-center justify-between text-xs font-medium text-muted hover:text-highlighted">
            {{ g.label }}
            <UIcon name="i-lucide-chevron-down" class="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </button>
          <template #content>
            <div class="space-y-5 pt-4">
              <CmsField
                v-for="f in g.fields" :key="f.key"
                v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="sidebar"
              />
            </div>
          </template>
        </UCollapsible>
      </aside>
    </div>
    <CmsPreviewPanel
      v-if="previewOpen && previewUrl" :url="previewUrl" :entity="entity" :id="id"
      :locale="isTranslation ? currentLocale : null" :data="form.body()" :version="version" @close="togglePreview"
    />
    </div>
  </CmsPage>
</template>
