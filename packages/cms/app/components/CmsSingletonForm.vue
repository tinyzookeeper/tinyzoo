<script setup lang="ts">
// Edits a single-row global (site settings, navigation). Fetches the one row, renders
// the same CmsField widgets as the entry editor, and upserts via PUT /_singleton/:name.
// With translatable fields, a language switcher edits the translations (?locale=).
import type { LiveChange } from '../composables/useCmsLive'

const props = defineProps<{ entity: string, meta: any }>()
const route = useRoute()
const { t, tl, languageName, entityLabel } = useCmsI18n()

// A global never "creates" from the form's point of view (PUT upserts).
const form = useCmsForm(computed(() => props.meta?.fields ?? []), computed(() => false))
const { state, fieldErrors, editable, dirty, saving, conflict } = form
const toast = useToast()
// The editor in the preview (experimental, NUXT_CMS_BUILDER=on): provided only when the menu says it is on.
provideCmsBuilder(useCmsBuilderOn())

// ── content languages (as in the entry editor) ──
const locales = computed(() => props.meta?.locales as { default: string; all: string[]; labels: Record<string, any> } | null)
const currentLocale = computed(() => {
  const q = route.query.locale
  return typeof q === 'string' && locales.value?.all.includes(q) ? q : (locales.value?.default ?? null)
})
const isTranslation = computed(() => !!locales.value && currentLocale.value !== locales.value.default)
const localeLabel = (code?: string | null) => (code ? tl(locales.value?.labels?.[code], code.toUpperCase()) : '')
const defaultLabel = computed(() => {
  const code = locales.value?.default
  return languageName(code, code ? locales.value?.labels?.[code] : null)
})

const rowUrl = (): string => `/api/cms/_singleton/${props.entity}${isTranslation.value ? `?locale=${currentLocale.value}` : ''}`
const { data } = await useFetch<{ row: Record<string, any> | null; can?: { update: boolean; why?: string } }>(rowUrl, { watch: [() => props.entity] })
// A person who may not change this (settings are for editors and administrators) can
// read the form and nothing more: said, not a save that fails.
const readOnly = computed(() => data.value?.can?.update === false || props.meta?.can?.update === false)
provide('cmsReadOnly', readOnly)
form.load(data.value?.row)
const exists = computed(() => !!data.value?.row?.id)
const available = ref<string[]>(data.value?.row?.__locales ?? [])
const defaults = computed<Record<string, any>>(() => data.value?.row?.__defaults ?? {})
/** A field whose original is long (a text body, blocks): the note about it goes above it. */
const refAbove = (f: any) => ['richtext', 'blocks', 'gallery', 'group'].includes(f?.type)
// The version this form edits (a translation has its own); see the entry editor.
const versionOf = (row: Record<string, any> | null | undefined) => (isTranslation.value ? row?.__version : row?.updatedAt) ?? null
const version = ref<string | null>(versionOf(data.value?.row))
const fetchRow = async () => (await $fetch<{ row: Record<string, any> | null }>(rowUrl())).row

async function loadNewest() {
  const row = await fetchRow()
  await form.replace(row)
  data.value = { row }
  version.value = versionOf(row)
  // Shared text follows only when someone asks for the saved version: for everyone.
  for (const key of sharedFields.value) collab?.set(key, row?.[key])
  if (live) live.incoming.value = null
}

/** Someone else saved or we reconnected: fetch, then merge field by field (as in the entry editor). */
async function onRemoteChange(c: LiveChange) {
  const row = await fetchRow().catch(() => null)
  if (!row || versionOf(row) === version.value) return
  if (!saving.value && await form.merge(row, sharedFields.value)) {
    data.value = { row }
    version.value = versionOf(row)
    toast.add({ title: c.byName ? t('live.reloaded', { name: c.byName }) : t('live.reloadedSomeone'), icon: 'i-lucide-refresh-cw', color: 'info' })
    return
  }
  if (live) live.incoming.value = c
}

/** The newest version with only this form's changed fields put back on it, saved. */
async function saveOnTop() {
  const mine = form.changedFields()
  await loadNewest()
  Object.assign(state, mine)
  await save()
}

// Realtime, once the global has its row (the first save creates it).
const rowId = data.value?.row?.id as string | undefined
const live = rowId
  ? useCmsEntryLive({
      entity: props.entity,
      id: rowId,
      version,
      dirty,
      saving,
      locale: computed(() => (isTranslation.value ? currentLocale.value : null)),
      onChange: onRemoteChange,
    })
  : null
const others = computed(() => live?.others.value ?? [])

// Shared editing of the rich-text fields, as in the entry editor.
// Only when there is text to write together (a rich-text field).
const hasRichText = (props.meta?.fields ?? []).some((f: any) => f.type === 'richtext')
const collab = rowId && hasRichText ? useCmsCollab({ entity: props.entity, id: rowId, locale: isTranslation.value ? currentLocale.value : null }) : null
const sharedFields = computed(() => (collab?.status.value === 'ready' ? collab.mounted.value : new Set<string>()))
form.setSharedText({ fields: () => sharedFields.value, othersHere: () => others.value.length > 0, reset: (key, value) => { collab?.set(key, value) } })
const collabHeaders = (): Record<string, string> => {
  if (!collab || collab.status.value !== 'ready' || !collab.epoch.value) return {}
  for (const k of collab.fields.value) if (!collab.mounted.value.has(k)) return {}
  return { 'x-cms-collab': collab.epoch.value }
}
/** "Keep" on text a closed tab left behind: into the form (shared text: for everyone), as an unsaved change. */
function keepUnsaved(values: Record<string, any>) {
  for (const [key, value] of Object.entries(values)) {
    if (!collab?.set(key, structuredClone(toRaw(value)))) state[key] = structuredClone(toRaw(value))
  }
}
function copyDefault(key: string) {
  const value = structuredClone(toRaw(defaults.value[key]))
  if (sharedFields.value.has(key) && collab?.set(key, value)) return
  state[key] = value
}

const title = computed(() => entityLabel(props.meta))
const visible = computed(() => editable.value.filter((f: any) => !isTranslation.value || f.localized))

useHead({ title })

// ── arrangement: a global with a page on the website (admin.preview, e.g. the home
// page) is edited beside that page; others are a plain form ──
const arrangement = computed<'write' | 'form' | 'preview'>(() => props.meta?.editor ?? 'form')
const wide = ref(false)
const previewOpen = ref(arrangement.value === 'preview')
const previewSheet = ref(false)
const previewKey = computed(() => `cms-preview:${props.entity}`)
onMounted(() => {
  const m = window.matchMedia('(min-width: 1024px)')
  wide.value = m.matches
  m.addEventListener('change', (e) => { wide.value = e.matches })
  try {
    const pref = localStorage.getItem(previewKey.value)
    if (pref) previewOpen.value = pref === '1'
  }
  catch { /* storage blocked: the arrangement's default */ }
})
const previewUrl = computed(() => {
  const paths: Record<string, string> | null = props.meta?.previewPaths ?? null
  const template = !paths ? null : currentLocale.value ? (paths[currentLocale.value] ?? null) : (paths[''] ?? Object.values(paths)[0] ?? null)
  if (!template || !rowId) return null
  let ok = true
  const url = template.replace(/:(\w+)/g, (_m: string, k: string) => {
    const v = state[k]
    if (v === undefined || v === null || v === '') ok = false
    return encodeURIComponent(v ?? '')
  })
  return ok ? `${url}?preview${isTranslation.value ? `&locale=${currentLocale.value}` : ''}` : null
})
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
useCmsFocus(split)

// Before the first save there is nothing to translate yet: the languages show, with
// a word on what to do first.
const localeItems = computed(() => (locales.value?.all ?? []).map((code) => {
  const isDefault = code === locales.value?.default
  return {
    label: isDefault ? `${localeLabel(code)} (${t('translation.default')})` : localeLabel(code),
    description: isDefault ? undefined : !exists.value ? t('translation.saveFirst') : (available.value.includes(code) ? t('translation.translated') : t('translation.notTranslated')),
    icon: code === currentLocale.value ? 'i-lucide-check' : undefined,
    disabled: !isDefault && !exists.value,
    to: { query: isDefault ? {} : { locale: code } },
  }
}))

async function save() {
  if (!await form.confirmSwitchOffs()) return false
  return form.submit(async () => {
    if (isTranslation.value) {
      const body = Object.fromEntries(editable.value.filter((f: any) => f.localized && !f.readOnly).map((f: any) => [f.key, state[f.key] ?? null]))
      const url: string = `/api/cms/_singleton/${props.entity}?locale=${currentLocale.value}`
      const headers: Record<string, string> = { ...(version.value ? { 'x-cms-version': version.value } : {}), ...collabHeaders() }
      const res: any = await $fetch(url, { method: 'PUT', body, headers })
      version.value = versionOf(res?.row)
      if (live) live.incoming.value = null
      if (currentLocale.value && !available.value.includes(currentLocale.value)) available.value = [...available.value, currentLocale.value]
      return
    }
    const url: string = `/api/cms/_singleton/${props.entity}`
    const headers: Record<string, string> = { ...(version.value ? { 'x-cms-version': version.value } : {}), ...collabHeaders() }
    const res: any = await $fetch(url, { method: 'PUT', body: form.body(), headers })
    version.value = versionOf(res?.row)
    if (live) live.incoming.value = null
    // The first save creates the row: languages can be translated from now on.
    if (!exists.value && res?.row) data.value = { row: res.row }
    // The admin's own name may come from this global (cms.admin.nameFrom): show the new one at once.
    if (String((useAppConfig().cms as any)?.admin?.nameFrom ?? '').startsWith(`${props.entity}.`)) void refreshNuxtData('cms-admin-theme')
  }, t('editor.savedLive'))
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => { if (!saving.value) save() } } })
</script>

<template>
  <CmsPage flush :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: title }]">
    <template #actions>
      <CmsPresence :people="others" />
      <UDropdownMenu v-if="locales && (meta?.fields ?? []).some((f: any) => f.localized)" :items="localeItems" :content="{ align: 'end' }">
        <UButton color="neutral" variant="ghost" icon="i-lucide-languages" trailing-icon="i-lucide-chevron-down" :aria-label="t('translation.language')">
          {{ (currentLocale ?? '').toUpperCase() }}
        </UButton>
      </UDropdownMenu>
      <span v-if="readOnly" class="inline-flex items-center gap-1 text-sm text-muted mr-1"><UIcon name="i-lucide-lock" class="size-3.5" />{{ t('readOnly.badge') }}</span>
      <span v-else-if="dirty" class="max-md:hidden text-sm cms-unsaved mr-1">{{ t('editor.unsaved') }}</span>
      <UButton
        v-if="previewUrl" color="neutral" variant="outline" icon="i-lucide-eye"
        :class="split ? 'bg-(--cms-nav-active)' : ''" :aria-pressed="split" :aria-label="t('editor.preview')" @click="togglePreview"
      ><span class="max-sm:hidden">{{ t('editor.preview') }}</span></UButton>
      <UTooltip v-if="!readOnly" :text="t('editor.shortcutSave')">
        <UButton :loading="saving" @click="() => { save() }">
          {{ isTranslation ? t('translation.save') : t('common.save') }}
        </UButton>
      </UTooltip>
    </template>

    <div class="cms-editor cms-editor--no-aside" :class="split ? 'cms-editor--split' : ''">
      <fieldset class="cms-fieldset contents" :disabled="readOnly">
      <div class="cms-editor__main">
        <div class="cms-editor__column">
          <UAlert
            v-if="readOnly" color="neutral" variant="subtle" icon="i-lucide-lock" class="mb-6" role="status"
            :title="t('readOnly.role')" :description="t('readOnly.body')"
          />
          <CmsUnsavedText :collab="collab" @keep="keepUnsaved" />
          <CmsLiveNotice
            :conflict="conflict" :incoming="live?.incoming.value"
            @load="loadNewest" @save-anyway="saveOnTop" @dismiss="live && (live.incoming.value = null)"
          />
          <CmsFormSections
            :fields="visible" :sections="meta?.sections" :state="state" :errors="fieldErrors"
            :disclose="!isTranslation" :menu="!split"
          >
            <template #top>
              <h1 class="cms-display text-[1.75rem] leading-tight text-highlighted">{{ title }}</h1>
              <p v-if="tl(meta?.description)" class="mt-1 text-sm text-muted text-pretty">{{ tl(meta?.description) }}</p>
              <p class="mt-3 text-sm text-muted flex items-center gap-1.5">
                <UIcon name="i-lucide-globe" class="size-3.5 shrink-0" />{{ t('editor.liveOnSave') }}
              </p>
              <p v-if="isTranslation && (meta?.fields ?? []).some((f: any) => !f.localized)" class="mt-2 text-sm text-muted">
                {{ t('translation.shared') }}
                <NuxtLink :to="{ query: {} }" class="underline underline-offset-2 hover:text-highlighted">{{ t('translation.editShared', { lang: defaultLabel }) }}</NuxtLink>
              </p>
            </template>
            <template #field="{ field: f }">
              <!-- translating: the default language's text greyed in the empty field, the line about it at the field -->
              <CmsTranslationRef
                v-if="isTranslation && refAbove(f)" :field="f" :value="defaults[f.key]" :lang="defaultLabel" above
                :empty="state[f.key] == null || (Array.isArray(state[f.key]) && !state[f.key].length) || (f.type === 'richtext' && isEmptyRichText(state[f.key]))"
                @copy="copyDefault(f.key)"
              />
              <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="main" hide-optional :fallback="isTranslation && f.localized ? defaults[f.key] : undefined" />
              <CmsTranslationRef
                v-if="isTranslation && !refAbove(f)" :field="f" :value="defaults[f.key]" :lang="defaultLabel"
                :empty="state[f.key] == null || state[f.key] === ''"
                @copy="copyDefault(f.key)"
              />
            </template>
          </CmsFormSections>
        </div>
      </div>
      </fieldset>
      <div v-if="split && previewUrl && rowId" class="cms-editor__preview">
        <CmsPreviewPanel
          :url="previewUrl" :entity="entity" :id="rowId"
          :locale="isTranslation ? currentLocale : null" :data="form.body()" :version="version" @close="togglePreview"
        />
      </div>
    </div>

    <UModal v-if="previewUrl && rowId" v-model:open="previewSheet" fullscreen :title="t('editor.preview')" :ui="{ header: 'hidden', body: 'p-3 sm:p-4 flex flex-col' }">
      <template #body>
        <CmsPreviewPanel
          :url="previewUrl" :entity="entity" :id="rowId" sheet
          :locale="isTranslation ? currentLocale : null" :data="form.body()" :version="version" @close="previewSheet = false"
        />
      </template>
    </UModal>
  </CmsPage>
</template>

<style scoped>
/* Read-only: still easy to read (the browser dims disabled controls a lot). */
.cms-fieldset:disabled :is(input, textarea, select, button):disabled { opacity: 0.85; cursor: default; }
.cms-fieldset:disabled :deep(.cms-rte__toolbar) { display: none; }
</style>
