<script setup lang="ts">
// Gallery in a list: how many files.
const props = defineProps<{ field: any; row: any }>()
const { t } = useCmsI18n()
const count = computed(() => (Array.isArray(props.row[props.field.key]) ? props.row[props.field.key].length : 0))
</script>

<template>
  <span class="text-muted tabular-nums">{{ count ? t('fields.galleryCount', { count }) : t('common.none') }}</span>
</template>
