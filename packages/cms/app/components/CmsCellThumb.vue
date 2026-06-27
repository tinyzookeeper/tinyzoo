<script setup lang="ts">
// Media list cell: the row carries the resolved record as `${key}__media`.
const props = defineProps<{ field: any; row: any; entity?: string }>()
const media = computed(() => props.row[`${props.field.key}__media`])
const isImage = computed(() => String(media.value?.mime ?? '').startsWith('image/'))
</script>

<template>
  <img
    v-if="isImage"
    :src="media.url"
    :width="media.width || undefined" :height="media.height || undefined"
    loading="lazy" decoding="async"
    class="size-9 rounded object-cover border border-default"
  >
  <UIcon v-else-if="media" name="i-lucide-file" class="size-5 text-dimmed" />
  <span v-else class="text-dimmed">—</span>
</template>
