<script setup lang="ts">
const props = defineProps<{ field: any; row: any; entity?: string }>()
const { t } = useCmsI18n()
const count = computed(() => (Array.isArray(props.row[props.field.key]) ? props.row[props.field.key].length : 0))
</script>

<template>
  <span class="text-muted whitespace-nowrap">{{ t('blocks.count', { count }) }}</span>
</template>
