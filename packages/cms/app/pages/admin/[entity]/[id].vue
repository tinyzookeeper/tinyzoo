<script setup lang="ts">
// Entry editor. The title is the page heading; content fields fill the main column;
// properties (status, URL, dates, relations…) sit in a side panel; grouped fields
// (e.g. "Search & sharing") collapse at the bottom of the panel. Status is shown once
// and changed through the header's single primary action.
//
// Remount per record so state/dirty/guard fully reset when switching records
// (and after a create→redirect), rather than reusing a stale component instance.
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
const form = useCmsForm(computed(() => meta.value?.fields ?? []), isNew)
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
  version.value = row?.updatedAt ?? null
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

/** Replace the form with the newest saved version (discarding unsaved edits here). */
async function loadNewest() {
  const res = await $fetch<{ row: Record<string, any> }>(rowUrl())
  await form.replace(res.row)
  adopt(res.row)
  live && (live.incoming.value = null)
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
      reload: async (c) => {
        const by = c.byName
        await loadNewest()
        toast.add({ title: by ? t('live.reloaded', { name: by }) : t('live.reloadedSomeone'), icon: 'i-lucide-refresh-cw', color: 'info' })
      },
    })
const others = computed(() => live?.others.value ?? [])

// ── layout: which field goes where ──
const publish = computed(() => meta.value?.publish)
const titleKey = computed(() => meta.value?.titleField as string | undefined)
const titleField = computed(() => editable.value.find((f: any) => f.key === titleKey.value))
const MAIN_TYPES = new Set(['text', 'richtext', 'media', 'blocks'])
const placementOf = (f: any): 'main' | 'sidebar' => f.meta?.position ?? (MAIN_TYPES.has(f.type) ? 'main' : 'sidebar')
// The publish field is changed by the Publish action, not edited as a field. In a
// translation only the translatable fields are shown.
const formFields = computed(() => editable.value.filter((f: any) =>
  f.key !== titleKey.value && f.key !== publish.value?.field && (!isTranslation.value || f.localized)))
const mainFields = computed(() => formFields.value.filter((f: any) => !f.meta?.group && placementOf(f) === 'main'))
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

async function save(successTitle?: string, force = false) {
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
      const headers: Record<string, string> = !force && version.value ? { 'x-cms-version': version.value } : {}
      const res: any = await $fetch(url, { method: 'PATCH', body: form.body(), headers })
      savedAt.value = res?.row?.updatedAt ?? new Date().toISOString()
      version.value = res?.row?.updatedAt ?? null
      if (live) live.incoming.value = null
    }
  }, successTitle ?? (isNew.value ? t('editor.created') : t('editor.saved')))
}

async function saveTranslation() {
  return form.submit(async () => {
    const body = Object.fromEntries(editable.value.filter((f: any) => f.localized).map((f: any) => [f.key, state[f.key] ?? null]))
    const url: string = `/api/cms/${entity.value}/${id.value}?locale=${currentLocale.value}`
    const res: any = await $fetch(url, { method: 'PATCH', body })
    savedAt.value = res?.row?.updatedAt ?? new Date().toISOString()
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
  if (next && p.dateField && !state[p.dateField]) state[p.dateField] = new Date().toISOString()
  const ok = await save(next ? t('editor.publishedToast') : t('editor.unpublishedToast'))
  if (!ok) {
    // Never show "Published" for something the server did not accept.
    state[p.field] = before.status
    if (p.dateField) state[p.dateField] = before.date
  }
}

const previewUrl = computed(() => {
  const p = publish.value
  if (!p?.preview || isNew.value) return null
  let ok = true
  const url = p.preview.replace(/:(\w+)/g, (_m: string, k: string) => {
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
      <UTooltip v-if="previewUrl" :text="t('editor.preview')">
        <UButton :to="previewUrl" target="_blank" variant="ghost" color="neutral" icon="i-lucide-eye" :aria-label="t('editor.preview')" />
      </UTooltip>

      <!-- one primary action -->
      <template v-if="isTranslation">
        <UButton :loading="saving" @click="save()">{{ t('translation.save') }}</UButton>
        <UDropdownMenu v-if="translated" :items="[[{ label: t('translation.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: removeTranslation }]]" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="t('editor.moreActions')" />
        </UDropdownMenu>
      </template>
      <UButton v-else-if="isNew" :loading="saving" @click="save()">{{ t('common.create') }}</UButton>
      <template v-else-if="publish && canPublish">
        <template v-if="isPublished">
          <UButton :loading="saving" @click="save()">{{ t('editor.update') }}</UButton>
          <UDropdownMenu :items="[[{ label: t('editor.unpublish'), icon: 'i-lucide-eye-off', onSelect: () => setPublished(false) }]]" :content="{ align: 'end' }">
            <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="t('editor.moreActions')" />
          </UDropdownMenu>
        </template>
        <template v-else>
          <UButton color="neutral" variant="outline" :loading="saving" @click="save()">{{ t('editor.saveDraft') }}</UButton>
          <UButton :loading="saving" @click="setPublished(true)">{{ t('editor.publish') }}</UButton>
        </template>
      </template>
      <UButton v-else :loading="saving" @click="save()">{{ publish ? t('editor.saveDraft') : t('common.save') }}</UButton>
    </template>

    <CmsLiveNotice
      :deleted="live?.deleted.value" :conflict="isTranslation ? null : conflict" :incoming="live?.incoming.value"
      :list-to="`/admin/${entity}`"
      @load="loadNewest" @save-anyway="save(undefined, true)" @dismiss="live && (live.incoming.value = null)"
    />
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
        <div v-for="f in mainFields" :key="f.key">
          <CmsField v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="main" />
          <CmsTranslationRef
            v-if="isTranslation" :field="f" :value="defaults[f.key]" :lang="defaultLabel"
            :empty="state[f.key] == null || (Array.isArray(state[f.key]) && !state[f.key].length)"
            @copy="state[f.key] = structuredClone(toRaw(defaults[f.key]))"
          />
        </div>
      </div>

      <aside class="cms-editor__aside space-y-5" :aria-label="t('editor.status')">
        <div v-if="publish && !isNew" class="space-y-1">
          <p class="text-xs font-medium text-muted">{{ t('editor.status') }}</p>
          <CmsStatusBadge :published="isPublished" />
          <p class="text-xs text-dimmed">
            <template v-if="isPublished && publishedOn">{{ t('editor.publishedSince', { date: formatDate(publishedOn, { time: false }) }) }}</template>
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
  </CmsPage>
</template>
