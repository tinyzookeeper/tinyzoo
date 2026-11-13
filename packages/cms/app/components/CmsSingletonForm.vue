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

// Same convention as the entry editor: grouped fields (e.g. "Search & sharing")
// collapse below the rest.
const ungrouped = computed(() => editable.value.filter((f: any) => !f.meta?.group))
const groups = computed(() => {
  const out = new Map<string, { label: string; fields: any[] }>()
  for (const f of editable.value) {
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
        <UButton :loading="saving" :disabled="meta?.can?.update === false" icon="i-lucide-check" @click="save()">{{ t('common.save') }}</UButton>
      </UTooltip>
    </template>

    <div class="space-y-6">
      <CmsField
        v-for="f in ungrouped" :key="f.key"
        v-model="state[f.key]" :field="f" :entity="entity" :error="fieldErrors[f.key]"
      />
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
