<script setup lang="ts">
const props = defineProps<{ field: any; row: any; entity?: string }>()
const { t } = useCmsI18n()
const on = computed(() => !!props.row[props.field.key])
</script>

<template>
  <UIcon
    :name="on ? 'i-lucide-check' : 'i-lucide-minus'" :aria-label="on ? t('fields.yes') : t('fields.no')"
    class="size-4" :class="on ? 'text-primary' : 'text-dimmed'"
  />
</template>
