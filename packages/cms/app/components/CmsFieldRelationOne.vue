<script setup lang="ts">
const { t, fieldLabel } = useCmsI18n()
const props = defineProps<{ field: any; entity?: string; id?: string }>()
const model = defineModel<any>()

// A page's parent picker (a relation to its own collection) leaves out the page itself and
// everything below it: choosing one of those would make a loop.
const route = useRoute()
const selfId = computed(() => {
  const own = props.entity && props.entity === props.field.relation.to && route.params.entity === props.entity
  return own && typeof route.params.id === 'string' && route.params.id !== 'new' ? route.params.id : ''
})
const options = ref<{ id: string; label: string }[]>([])
const loading = ref(false)
// Until the names arrive, a chosen item shows as a placeholder bar, never its raw id.
const ready = ref(false)
async function load(q = '') {
  loading.value = true
  try {
    options.value = await cmsFetch(`/api/cms/${props.field.relation.to}/options`, {
      query: { q, selected: model.value ?? '', exclude: selfId.value || undefined },
    })
  } finally {
    loading.value = false
    ready.value = true
  }
}
onMounted(() => load())
// A value loaded later (a newer version, a restored one) needs its name too.
watch(model, (v) => { if (v && !options.value.some((o) => o.id === v)) load() })
const icon = computed(() => cmsFieldIcon(props.field))
const injected = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const variant = computed(() => injected?.value ?? 'outline')
</script>

<template>
  <div class="flex items-center gap-2">
    <USkeleton v-if="model && !ready" class="h-8 w-full rounded-md" />
    <USelectMenu v-else
      :id="id" v-model="model" :variant="variant" :items="options" value-key="id" :loading="loading" :icon="icon"
      :placeholder="variant === 'ghost' ? t('fields.notSet') : t('common.select')" :aria-label="fieldLabel(field)" class="w-full min-w-0" @update:open="(o: boolean) => o && load()"
    />
    <UButton
      v-if="model && field.optional" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('fields.clear')"
      @click="model = null"
    />
  </div>
</template>
