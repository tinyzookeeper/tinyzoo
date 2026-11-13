<script setup lang="ts">
// Edits a single-row global (site settings, navigation). Fetches the one row, renders
// the same CmsField widgets as the entry editor, and upserts via PUT /_singleton/:name.
// With translatable fields, a language switcher edits the translations (?locale=).
import type { LiveChange } from '../composables/useCmsLive'

const props = defineProps<{ entity: string, meta: any }>()
const route = useRoute()
const { t, tl, entityLabel } = useCmsI18n()

// A global never "creates" from the form's point of view (PUT upserts).
const form = useCmsForm(computed(() => props.meta?.fields ?? []), computed(() => false))
const { state, fieldErrors, editable, dirty, saving, conflict } = form
const toast = useToast()

// ── content languages (as in the entry editor) ──
const locales = computed(() => props.meta?.locales as { default: string; all: string[]; labels: Record<string, any> } | null)
const currentLocale = computed(() => {
  const q = route.query.locale
  return typeof q === 'string' && locales.value?.all.includes(q) ? q : (locales.value?.default ?? null)
})
const isTranslation = computed(() => !!locales.value && currentLocale.value !== locales.value.default)
const localeLabel = (code?: string | null) => (code ? tl(locales.value?.labels?.[code], code.toUpperCase()) : '')
const defaultLabel = computed(() => localeLabel(locales.value?.default))

const rowUrl = (): string => `/api/cms/_singleton/${props.entity}${isTranslation.value ? `?locale=${currentLocale.value}` : ''}`
const { data } = await useFetch<{ row: Record<string, any> | null }>(rowUrl, { watch: [() => props.entity] })
form.load(data.value?.row)
const exists = computed(() => !!data.value?.row?.id)
const available = ref<string[]>(data.value?.row?.__locales ?? [])
const defaults = computed<Record<string, any>>(() => data.value?.row?.__defaults ?? {})
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
const collab = rowId ? useCmsCollab({ entity: props.entity, id: rowId, locale: isTranslation.value ? currentLocale.value : null }) : null
const sharedFields = computed(() => (collab?.status.value === 'ready' ? collab.mounted.value : new Set<string>()))
const collabHeaders = (): Record<string, string> => {
  if (!collab || collab.status.value !== 'ready' || !collab.epoch.value) return {}
  for (const k of collab.fields.value) if (!collab.mounted.value.has(k)) return {}
  return { 'x-cms-collab': collab.epoch.value }
}
function copyDefault(key: string) {
  const value = structuredClone(toRaw(defaults.value[key]))
  if (sharedFields.value.has(key) && collab?.set(key, value)) return
  state[key] = value
}

const title = computed(() => entityLabel(props.meta))
const visible = computed(() => editable.value.filter((f: any) => !isTranslation.value || f.localized))

// Same convention as the entry editor: grouped fields (e.g. "Search & sharing")
// collapse below the rest.
const ungrouped = computed(() => visible.value.filter((f: any) => !f.meta?.group))
const groups = computed(() => {
  const out = new Map<string, { label: string; fields: any[] }>()
  for (const f of visible.value) {
    if (!f.meta?.group) continue
    const label = tl(f.meta.group)
    if (!out.has(label)) out.set(label, { label, fields: [] })
    out.get(label)!.fields.push(f)
  }
  return [...out.values()]
})
const openGroups = reactive<Record<string, boolean>>({})
watch(() => ({ ...fieldErrors }), (errs) => {
  for (const g of groups.value) if (g.fields.some((f: any) => errs[f.key])) openGroups[g.label] = true
})
useHead({ title })

const localeItems = computed(() => (locales.value?.all ?? []).map((code) => ({
  label: code === locales.value?.default ? `${localeLabel(code)} (${t('translation.default')})` : localeLabel(code),
  description: code === locales.value?.default ? undefined : (available.value.includes(code) ? t('translation.translated') : t('translation.notTranslated')),
  icon: code === currentLocale.value ? 'i-lucide-check' : undefined,
  to: { query: code === locales.value?.default ? {} : { locale: code } },
})))

function save() {
  return form.submit(async () => {
    if (isTranslation.value) {
      const body = Object.fromEntries(editable.value.filter((f: any) => f.localized).map((f: any) => [f.key, state[f.key] ?? null]))
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
  })
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => { if (!saving.value) save() } } })
</script>

<template>
  <CmsPage
    :title="title" :description="tl(meta?.description) || undefined" narrow
    :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: title }]"
  >
    <template #actions>
      <CmsPresence :people="others" />
      <UDropdownMenu v-if="locales && exists" :items="localeItems" :content="{ align: 'end' }">
        <UButton color="neutral" variant="ghost" icon="i-lucide-languages" trailing-icon="i-lucide-chevron-down" :aria-label="t('translation.language')">
          {{ (currentLocale ?? '').toUpperCase() }}
        </UButton>
      </UDropdownMenu>
      <span v-if="dirty" class="hidden md:inline text-sm text-warning mr-1">{{ t('editor.unsaved') }}</span>
      <UTooltip :text="t('editor.shortcutSave')">
        <UButton :loading="saving" :disabled="meta?.can?.update === false" icon="i-lucide-check" @click="save()">
          {{ isTranslation ? t('translation.save') : t('common.save') }}
        </UButton>
      </UTooltip>
    </template>

    <CmsLiveNotice
      :conflict="conflict" :incoming="live?.incoming.value"
      @load="loadNewest" @save-anyway="saveOnTop" @dismiss="live && (live.incoming.value = null)"
    />
    <div class="space-y-6">
      <p v-if="isTranslation" class="text-sm text-muted">
        {{ t('translation.shared') }}
        <NuxtLink :to="{ query: {} }" class="underline underline-offset-2 hover:text-highlighted">{{ t('translation.editShared', { lang: defaultLabel }) }}</NuxtLink>
      </p>
      <div v-for="f in ungrouped" :key="f.key">
        <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" />
        <CmsTranslationRef
          v-if="isTranslation" :field="f" :value="defaults[f.key]" :lang="defaultLabel"
          :empty="state[f.key] == null || (Array.isArray(state[f.key]) && !state[f.key].length)"
          @copy="copyDefault(f.key)"
        />
      </div>
      <UCollapsible
        v-for="g in groups" :key="g.label" v-model:open="openGroups[g.label]"
        class="border-t border-default pt-4"
      >
        <button type="button" class="group w-full flex items-center justify-between text-sm font-medium text-muted hover:text-highlighted">
          {{ g.label }}
          <UIcon name="i-lucide-chevron-down" class="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </button>
        <template #content>
          <div class="space-y-6 pt-4">
            <CmsField
              v-for="f in g.fields" :key="f.key"
              v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]"
            />
          </div>
        </template>
      </UCollapsible>
    </div>
  </CmsPage>
</template>
