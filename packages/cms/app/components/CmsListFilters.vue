<script setup lang="ts">
// The list's filters: one quiet "Filter" button opening a panel with a control per
// filterable field, and the active filters as removable chips. The value is the
// query the list endpoint reads: { 'filter.<field>': value, 'filter.<field>.from': … }.
const props = defineProps<{ fields: any[] }>()
const model = defineModel<Record<string, string>>({ default: () => ({}) })
const { t, tl, fieldLabel, formatDate } = useCmsI18n()

const set = (param: string, value: string | null | undefined) => {
  const next = { ...model.value }
  if (value) next[param] = value
  else delete next[param]
  model.value = next
}
const optionLabel = (f: any, v: string) => tl(f.meta?.labels?.[v], v)

// Related entries: fetched once per field, with labels for chips.
const relationOptions = reactive<Record<string, { id: string; label: string }[]>>({})
async function loadRelation(f: any) {
  if (relationOptions[f.key]) return
  const selected = model.value[`filter.${f.key}`]
  relationOptions[f.key] = await cmsFetch<any[]>(`/api/cms/${f.relation.to}/options`, { query: selected ? { selected } : {} }).catch(() => [])
}
watch(() => props.fields, (fs) => { for (const f of fs) if (f.relation && model.value[`filter.${f.key}`]) loadRelation(f) }, { immediate: true })

const chips = computed(() => {
  const out: { param: string; label: string }[] = []
  for (const f of props.fields) {
    const v = model.value[`filter.${f.key}`]
    const name = fieldLabel(f)
    if (v) {
      let shown = v
      if (f.type === 'select') shown = v.split(',').map((x) => optionLabel(f, x)).join(', ')
      else if (f.type === 'boolean') shown = v === 'true' ? t('fields.yes') : t('fields.no')
      else if (f.type === 'media') shown = v === 'yes' ? t('list.filterHas') : t('list.filterHasNot')
      else if (f.relation) shown = relationOptions[f.key]?.find((o) => o.id === v)?.label ?? '…'
      out.push({ param: `filter.${f.key}`, label: `${name}: ${shown}` })
    }
    for (const part of ['from', 'to'] as const) {
      const d = model.value[`filter.${f.key}.${part}`]
      if (d) out.push({ param: `filter.${f.key}.${part}`, label: `${name} ${t(part === 'from' ? 'list.filterFrom' : 'list.filterTo')} ${formatDate(d, { time: false })}` })
    }
  }
  return out
})
const count = computed(() => chips.value.length)
// Days in the admin's time zone (cms.admin.timeZone), sent as exact instants: from the
// day's first minute to its last.
const config = useCmsAdminConfig()
const dateValue = (param: string) => toZonedInput(model.value[param], config.value.timeZone).slice(0, 10)
const setDate = (param: string, v: string, part: 'from' | 'to') => {
  if (!v) return set(param, null)
  const at = fromZonedInput(`${v}T${part === 'from' ? '00:00' : '23:59'}`, config.value.timeZone)
  if (!at) return set(param, null)
  set(param, part === 'to' ? new Date(new Date(at).getTime() + 59_999).toISOString() : at)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UPopover :content="{ align: 'start' }">
      <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-list-filter">
        {{ t('list.filter') }}<span v-if="count" class="ml-1 tabular-nums text-muted">{{ count }}</span>
      </UButton>
      <template #content>
        <div class="w-72 space-y-4 p-4">
          <div v-for="f in fields" :key="f.key" class="space-y-1.5">
            <p class="text-xs font-medium text-muted">{{ fieldLabel(f) }}</p>
            <USelect
              v-if="f.type === 'select'" :model-value="model[`filter.${f.key}`] || undefined" class="w-full" size="sm"
              :items="(f.meta?.options ?? []).map((o: string) => ({ label: optionLabel(f, o), value: o }))" :placeholder="t('list.filterAny')"
              @update:model-value="(v: any) => set(`filter.${f.key}`, v)"
            />
            <USelect
              v-else-if="f.type === 'boolean'" :model-value="model[`filter.${f.key}`] || undefined" class="w-full" size="sm"
              :items="[{ label: t('fields.yes'), value: 'true' }, { label: t('fields.no'), value: 'false' }]" :placeholder="t('list.filterAny')"
              @update:model-value="(v: any) => set(`filter.${f.key}`, v)"
            />
            <USelect
              v-else-if="f.type === 'media'" :model-value="model[`filter.${f.key}`] || undefined" class="w-full" size="sm"
              :items="[{ label: t('list.filterHas'), value: 'yes' }, { label: t('list.filterHasNot'), value: 'no' }]" :placeholder="t('list.filterAny')"
              @update:model-value="(v: any) => set(`filter.${f.key}`, v)"
            />
            <USelectMenu
              v-else-if="f.relation" :model-value="model[`filter.${f.key}`] || undefined" class="w-full" size="sm"
              :items="relationOptions[f.key] ?? []" value-key="id" :placeholder="t('list.filterAny')"
              @update:open="(o: boolean) => o && loadRelation(f)" @update:model-value="(v: any) => set(`filter.${f.key}`, v)"
            />
            <div v-else-if="f.type === 'datetime'" class="grid grid-cols-2 gap-2">
              <CmsDayPicker :label="`${fieldLabel(f)} ${t('list.filterFrom')}`" :placeholder="t('list.filterFrom')" :model-value="dateValue(`filter.${f.key}.from`)" @update:model-value="(v: string) => setDate(`filter.${f.key}.from`, v, 'from')" />
              <CmsDayPicker :label="`${fieldLabel(f)} ${t('list.filterTo')}`" :placeholder="t('list.filterTo')" :model-value="dateValue(`filter.${f.key}.to`)" @update:model-value="(v: string) => setDate(`filter.${f.key}.to`, v, 'to')" />
            </div>
          </div>
          <UButton v-if="count" color="neutral" variant="link" size="sm" class="px-0" @click="model = {}">{{ t('list.filterClear') }}</UButton>
        </div>
      </template>
    </UPopover>
    <UBadge
      v-for="c in chips" :key="c.param" color="neutral" variant="soft" size="md" class="gap-1"
    >
      {{ c.label }}
      <button type="button" class="text-dimmed hover:text-highlighted" :aria-label="t('list.filterRemove', { name: c.label })" @click="set(c.param, null)">
        <UIcon name="i-lucide-x" class="size-3.5 block" />
      </button>
    </UBadge>
  </div>
</template>
