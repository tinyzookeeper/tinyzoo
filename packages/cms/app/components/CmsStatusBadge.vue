<script setup lang="ts">
// Publication status, the same everywhere: a dot and a word, no pill.
// Draft = grey, published = green.
const props = defineProps<{ published: boolean }>()
const { t } = useCmsI18n()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-sm" :class="props.published ? 'text-default' : 'text-muted'">
    <span class="size-2 rounded-full shrink-0" :class="props.published ? 'bg-success' : 'border border-(--ui-text-dimmed)'" aria-hidden="true" />
    {{ props.published ? t('editor.published') : t('editor.draft') }}
  </span>
</template>
