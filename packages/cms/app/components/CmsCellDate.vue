<script setup lang="ts">
// A date in the admin's language and time zone (stable between server and browser).
const props = defineProps<{ field: any; row: any; entity?: string }>()
const { t, formatDate } = useCmsI18n()
const v = computed(() => props.row[props.field.key])
</script>

<template>
  <span class="text-muted whitespace-nowrap tabular-nums">{{ v ? formatDate(v, { time: false }) : t('common.none') }}</span>
</template>
