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
const { t, tl, entityLabel, entitySingular, fieldLabel, formatDate } = useCmsI18n()
const entity = computed(() => route.params.entity as string)
const id = computed(() => route.params.id as string)
const isNew = computed(() => id.value === 'new')

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
const form = useCmsForm(computed(() => meta.value?.fields ?? []), isNew)
const { state, fieldErrors, editable, dirty, saving } = form

const savedAt = ref<string | null>(null)
if (!isNew.value) {
  const { data } = await useFetch<{ row: Record<string, any> }>((): string => `/api/cms/${entity.value}/${id.value}`)
  form.load(data.value?.row)
  savedAt.value = data.value?.row?.updatedAt ?? null
}
else {
  form.load({})
}

// ── layout: which field goes where ──
const publish = computed(() => meta.value?.publish)
const titleKey = computed(() => meta.value?.titleField as string | undefined)
const titleField = computed(() => editable.value.find((f: any) => f.key === titleKey.value))
const MAIN_TYPES = new Set(['text', 'richtext', 'media', 'blocks'])
const placementOf = (f: any): 'main' | 'sidebar' => f.meta?.position ?? (MAIN_TYPES.has(f.type) ? 'main' : 'sidebar')
// The publish field is changed by the Publish action, not edited as a field.
const formFields = computed(() => editable.value.filter((f: any) => f.key !== titleKey.value && f.key !== publish.value?.field))
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

async function save(successTitle?: string) {
  return form.submit(async () => {
    if (isNew.value) {
      const url: string = `/api/cms/${entity.value}`
      const res: any = await $fetch(url, { method: 'POST', body: form.body() })
      dirty.value = false // before the redirect, so the leave-guard does not fire
      await router.push(`/admin/${entity.value}/${res.row.id}`)
    }
    else {
      const url: string = `/api/cms/${entity.value}/${id.value}`
      const res: any = await $fetch(url, { method: 'PATCH', body: form.body() })
      savedAt.value = res?.row?.updatedAt ?? new Date().toISOString()
    }
  }, successTitle ?? (isNew.value ? t('editor.created') : t('editor.saved')))
}

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
  return ok ? `${url}?preview` : null
})

defineShortcuts({ meta_s: { usingInput: true, handler: () => { if (!saving.value) save() } } })
</script>

<template>
  <CmsPage :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: listLabel, to: `/admin/${entity}` }, { label: heading }]">
    <template #actions>
      <span class="hidden md:inline text-sm mr-1" :class="dirty ? 'text-warning' : 'text-dimmed'">
        <template v-if="dirty">{{ t('editor.unsaved') }}</template>
        <template v-else-if="savedAt">{{ t('editor.savedAgo', { time: '' }) }}<CmsTime :value="savedAt" relative /></template>
      </span>
      <UTooltip v-if="previewUrl" :text="t('editor.preview')">
        <UButton :to="previewUrl" target="_blank" variant="ghost" color="neutral" icon="i-lucide-eye" :aria-label="t('editor.preview')" />
      </UTooltip>

      <!-- one primary action -->
      <UButton v-if="isNew" :loading="saving" @click="save()">{{ t('common.create') }}</UButton>
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

    <div class="cms-editor">
      <div class="cms-editor__main space-y-8">
        <!-- the title is the page heading -->
        <div v-if="titleField">
          <input
            v-model="state[titleField.key]" class="cms-title-input" :placeholder="t('editor.titlePlaceholder')"
            :aria-label="fieldLabel(titleField)" :aria-invalid="!!fieldErrors[titleField.key]" autocomplete="off"
          >
          <p v-if="fieldErrors[titleField.key]" class="mt-1 text-sm text-error">{{ fieldErrors[titleField.key] }}</p>
        </div>
        <CmsField
          v-for="f in mainFields" :key="f.key"
          v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="main"
        />
      </div>

      <aside class="cms-editor__aside space-y-5" :aria-label="t('editor.status')">
        <div v-if="publish && !isNew" class="space-y-1">
          <p class="text-xs font-medium text-muted">{{ t('editor.status') }}</p>
          <CmsStatusBadge :published="isPublished" />
          <p class="text-xs text-dimmed">
            <template v-if="isPublished && publishedOn">{{ t('editor.publishedSince', { date: formatDate(publishedOn, { time: false }) }) }}</template>
            <template v-else-if="!isPublished">{{ canPublish ? t('editor.notPublished') : t('editor.cannotPublish') }}</template>
          </p>
        </div>

        <CmsField
          v-for="f in sideFields" :key="f.key"
          v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]" placement="sidebar"
        />

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
