<script setup lang="ts">
const { t } = useCmsI18n()
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()

const options = ref<{ id: string; label: string }[]>([])
const loading = ref(false)
async function load(q = '') {
  loading.value = true
  try {
    options.value = await cmsFetch(`/api/cms/${props.field.relation.to}/options`, {
      query: { q, selected: model.value ?? '' },
    })
  } finally {
    loading.value = false
  }
}
onMounted(() => load())
</script>

<template>
  <USelectMenu
    v-model="model" :items="options" value-key="id" :loading="loading"
    :placeholder="t('common.select')" class="w-full" @update:open="(o: boolean) => o && load()"
  />
</template>
