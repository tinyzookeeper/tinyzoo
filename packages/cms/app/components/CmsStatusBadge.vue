<script setup lang="ts">
// Publication status. Colour is semantic and consistent everywhere:
// draft = neutral, published = success (scheduled/changed arrive with Phase 4).
const props = defineProps<{ published: boolean; size?: 'sm' | 'md' }>()
const { t } = useCmsI18n()
</script>

<template>
  <UBadge
    :color="props.published ? 'success' : 'neutral'" variant="subtle" :size="size ?? 'sm'"
    class="rounded-full gap-1.5 font-medium"
  >
    <span class="size-1.5 rounded-full" :class="props.published ? 'bg-success' : 'bg-(--ui-text-dimmed)'" aria-hidden="true" />
    {{ props.published ? t('editor.published') : t('editor.draft') }}
  </UBadge>
</template>
