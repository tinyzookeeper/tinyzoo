<script setup lang="ts">
// Remount per record so state/dirty/guard fully reset when switching records
// (and after a create→redirect), rather than reusing a stale component instance.
definePageMeta({ layout: 'admin', key: (route) => route.fullPath })
const route = useRoute()
const router = useRouter()
const { t, entityLabel, entitySingular } = useCmsI18n()
const entity = computed(() => route.params.entity as string)
const id = computed(() => route.params.id as string)
const isNew = computed(() => id.value === 'new')

const { data: graph } = await useFetch<any[]>('/api/cms/_graph', { key: 'cms-graph' })
const meta = computed(() => (graph.value ?? []).find((e: any) => e.name === entity.value))
const form = useCmsForm(computed(() => meta.value?.fields ?? []), isNew)
const { state, fieldErrors, editable, dirty, saving } = form

if (!isNew.value) {
  const { data } = await useFetch<{ row: Record<string, any> }>((): string => `/api/cms/${entity.value}/${id.value}`)
  form.load(data.value?.row)
}
else {
  form.load({})
}

const listLabel = computed(() => entityLabel(meta.value) || entity.value)
const heading = computed(() => {
  if (isNew.value) return t('editor.newTitle', { label: entitySingular(meta.value).toLowerCase() })
  const tf = meta.value?.titleField
  return (tf && state[tf]) || t('common.untitled')
})
useHead({ title: heading })

// Publish workflow (only when the entity declares `publish`).
const publish = computed(() => meta.value?.publish)
const isPublished = computed(() => !!publish.value && state[publish.value.field] === publish.value.publishedValue)

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
      await $fetch(url, { method: 'PATCH', body: form.body() })
    }
  }, successTitle ?? (isNew.value ? t('editor.created') : t('editor.saved')))
}

async function togglePublish() {
  const p = publish.value
  if (!p) return
  const willPublish = !isPublished.value
  const before = { status: state[p.field], date: p.dateField ? state[p.dateField] : undefined }
  state[p.field] = willPublish ? p.publishedValue : p.draftValue
  if (willPublish && p.dateField && !state[p.dateField]) state[p.dateField] = new Date().toISOString()
  const ok = await save(willPublish ? t('editor.publishedToast') : t('editor.unpublishedToast'))
  if (!ok) {
    // Never show "Published" for something the server did not accept.
    state[p.field] = before.status
    if (p.dateField) state[p.dateField] = before.date
  }
}

const previewUrl = computed(() => {
  const p = publish.value
  if (!p?.preview) return null
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
  <CmsPage
    :title="heading" narrow
    :breadcrumbs="[{ label: t('nav.home'), to: '/admin' }, { label: listLabel, to: `/admin/${entity}` }, { label: heading }]"
  >
    <template #badge>
      <CmsStatusBadge v-if="publish && !isNew" :published="isPublished" size="md" />
    </template>

    <template #actions>
      <span v-if="dirty" class="hidden md:inline text-sm text-warning mr-1">{{ t('editor.unsaved') }}</span>
      <UButton
        v-if="publish && !isNew && previewUrl" :to="previewUrl" target="_blank"
        variant="ghost" color="neutral" icon="i-lucide-external-link"
      >{{ t('editor.preview') }}</UButton>
      <UButton
        v-if="publish && !isNew && meta?.can?.publish !== false" color="neutral" variant="outline" :loading="saving"
        :icon="isPublished ? 'i-lucide-eye-off' : 'i-lucide-globe'" @click="togglePublish"
      >{{ isPublished ? t('editor.unpublish') : t('editor.publish') }}</UButton>
      <UTooltip :text="t('editor.shortcutSave')">
        <UButton :loading="saving" icon="i-lucide-check" @click="save()">{{ isNew ? t('common.create') : t('common.save') }}</UButton>
      </UTooltip>
    </template>

    <div class="cms-card p-5 sm:p-6 space-y-6">
      <CmsField
        v-for="f in editable" :key="f.key"
        v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]"
      />
    </div>
  </CmsPage>
</template>
