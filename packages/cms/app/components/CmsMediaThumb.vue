<script setup lang="ts">
// A library file drawn small: a picture as its smaller copy (a few kB, not the original),
// anything else as an icon for its kind (a film strip, a note, a document) — the grid never
// loads a video or a PDF just to show a tile.
const props = defineProps<{ media: any; fit?: 'cover' | 'contain'; width?: number }>()
const kind = computed(() => cmsMediaKind(props.media))
const src = computed(() => cmsThumbUrl(props.media, props.width ?? 320))
const style = computed(() => (props.media?.focalX != null ? { objectPosition: `${props.media.focalX}% ${props.media.focalY}%` } : undefined))
const ext = computed(() => String(props.media?.key ?? props.media?.name ?? '').split('.').pop()?.slice(0, 5).toUpperCase())
</script>

<template>
  <img
    v-if="kind === 'image'" :src="src" :alt="media.alt ?? ''" loading="lazy" decoding="async"
    class="size-full" :class="fit === 'contain' ? 'object-contain' : 'object-cover'" :style="style"
    @error="(e: Event) => cmsThumbFallback(e, media.url)"
  >
  <span v-else class="flex size-full flex-col items-center justify-center gap-1 text-muted">
    <UIcon :name="cmsMediaIcon(media)" class="size-8" aria-hidden="true" />
    <span v-if="ext" class="text-[0.6875rem] font-medium tracking-wide">{{ ext }}</span>
  </span>
</template>
