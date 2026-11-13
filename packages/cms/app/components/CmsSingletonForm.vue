<script setup lang="ts">
// Edits a single-row global (site settings, homepage). Fetches the one row, renders
// the same CmsField widgets as the entry editor, and upserts via PUT /_singleton/:name.
const props = defineProps<{ entity: string, meta: any }>()
const { t, tl, entityLabel } = useCmsI18n()

// A global never "creates" from the form's point of view (PUT upserts).
const form = useCmsForm(computed(() => props.meta?.fields ?? []), computed(() => false))
const { state, fieldErrors, editable, dirty, saving } = form

const { data } = await useFetch<{ row: Record<string, any> | null }>((): string => `/api/cms/_singleton/${props.entity}`, { watch: [() => props.entity] })
form.load(data.value?.row)

const title = computed(() => entityLabel(props.meta))
useHead({ title })

function save() {
  return form.submit(async () => {
    const url: string = `/api/cms/_singleton/${props.entity}`
    await $fetch(url, { method: 'PUT', body: form.body() })
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
      <span v-if="dirty" class="hidden md:inline text-sm text-warning mr-1">{{ t('editor.unsaved') }}</span>
      <UTooltip :text="t('editor.shortcutSave')">
        <UButton :loading="saving" icon="i-lucide-check" @click="save()">{{ t('common.save') }}</UButton>
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
