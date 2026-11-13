<script setup lang="ts">
const { t } = useCmsI18n()
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()

const options = ref<{ id: string; label: string }[]>([])
const loading = ref(false)
async function load(q = '') {
  loading.value = true
  try {
    options.value = await cmsFetch<{ id: string; label: string }[]>(`/api/cms/${props.field.relation.to}/options`, {
      query: { q, selected: Array.isArray(model.value) ? model.value.join(',') : '' },
    })
  } finally {
    loading.value = false
  }
}
onMounted(() => load())
</script>

<template>
  <USelectMenu
    v-model="model" multiple :items="options" value-key="id" :loading="loading"
    :placeholder="t('common.select')" class="w-full" @update:open="(o: boolean) => o && load()"
  />
</template>
