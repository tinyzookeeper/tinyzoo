<script setup lang="ts">
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()
const { tl } = useCmsI18n()
const items = computed(() => (props.field.meta.options as string[]).map((value) => ({
  value,
  label: tl(props.field.meta.labels?.[value], value),
})))
</script>

<template>
  <USelect v-model="model" :items="items" class="w-full" />
</template>
