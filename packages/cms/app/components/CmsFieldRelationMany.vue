<script setup lang="ts">
// Several related items (tags, authors): the chosen ones as chips that wrap, so all
// of them stay readable in a narrow panel, and a menu to add more.
const { t, fieldLabel } = useCmsI18n()
const props = defineProps<{ field: any; entity?: string; id?: string }>()
const model = defineModel<any>()

const options = ref<{ id: string; label: string }[]>([])
const loading = ref(false)
const ready = ref(false)
const known = reactive(new Map<string, string>())
async function load(q = '') {
  loading.value = true
  try {
    options.value = await cmsFetch<{ id: string; label: string }[]>(`/api/cms/${props.field.relation.to}/options`, {
      query: { q, selected: Array.isArray(model.value) ? model.value.join(',') : '' },
    })
    for (const o of options.value) known.set(o.id, o.label)
  } finally {
    loading.value = false
    ready.value = true
  }
}
onMounted(() => load())
const ids = computed<string[]>(() => (Array.isArray(model.value) ? model.value : []))
watch(ids, (v) => { if (v.some((id) => !known.has(id))) load() })
function remove(id: string) {
  model.value = ids.value.filter((x) => x !== id)
}
const icon = computed(() => cmsFieldIcon(props.field))
const injected = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const variant = computed(() => injected?.value ?? 'outline')
</script>

<template>
  <div class="w-full space-y-1.5">
    <USkeleton v-if="ids.length && !ready" class="h-6 w-2/3 rounded-md" />
    <ul v-else-if="ids.length" class="flex flex-wrap gap-1.5" :aria-label="t('fields.chosen')">
      <li v-for="cid in ids" :key="cid" class="inline-flex max-w-full items-center gap-1 rounded-md bg-elevated py-0.5 pl-2 pr-0.5 text-sm text-highlighted">
        <span class="truncate">{{ known.get(cid) ?? '…' }}</span>
        <UButton
          size="xs" color="neutral" variant="link" icon="i-lucide-x" class="p-0.5"
          :aria-label="t('fields.removeItem', { name: known.get(cid) ?? '' })" @click="remove(cid)"
        />
      </li>
    </ul>
    <USelectMenu
      :id="id" v-model="model" multiple :items="options" value-key="id" :loading="loading" :icon="icon ?? 'i-lucide-plus'"
      :variant="variant" :aria-label="fieldLabel(field)" class="w-full" @update:open="(o: boolean) => o && load()"
    >
      <span class="truncate text-muted">{{ ids.length ? t('fields.addMore') : t('common.select') }}</span>
    </USelectMenu>
  </div>
</template>
