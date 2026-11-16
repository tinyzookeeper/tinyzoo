<script setup lang="ts">
// A file shown properly where it is opened (the library's panel, a media field): a picture
// as itself, a video in a player and a sound with its controls — the browser's own, so the
// keyboard, captions menus and phones' full-screen all work — and anything else as a card
// with its name that opens the file. `preload="metadata"`: nothing big downloads until Play.
const props = defineProps<{ media: any; /** Picture: how it sits in its box. */ fit?: 'cover' | 'contain'; width?: number }>()
const { t } = useCmsI18n()
const kind = computed(() => cmsMediaKind(props.media))
const name = computed(() => props.media?.name || String(props.media?.key ?? '').split('/').pop() || '')
</script>

<template>
  <video
    v-if="kind === 'video'" :src="media.url" controls preload="metadata" playsinline
    class="block w-full max-h-[22rem] bg-black" :aria-label="t('media.videoLabel', { name })"
  />
  <div v-else-if="kind === 'audio'" class="flex flex-col gap-2 p-3">
    <span class="flex items-center gap-2 text-sm text-highlighted"><UIcon name="i-lucide-music" class="size-4 shrink-0 text-muted" aria-hidden="true" /><span class="truncate">{{ name }}</span></span>
    <audio :src="media.url" controls preload="metadata" class="w-full" :aria-label="t('media.audioLabel', { name })" />
  </div>
  <img
    v-else-if="kind === 'image'" :src="cmsThumbUrl(media, width ?? 960)" :alt="media.alt ?? ''"
    :width="media.width || undefined" :height="media.height || undefined" decoding="async"
    class="block w-full" :class="fit === 'cover' ? 'size-full object-cover' : 'max-h-[22rem] object-contain mx-auto'"
    @error="(e: Event) => cmsThumbFallback(e, media.url)"
  >
  <a v-else :href="media.url" target="_blank" rel="noopener" class="flex items-center gap-3 p-3 hover:bg-elevated/60">
    <span class="grid size-9 shrink-0 place-items-center rounded-md border border-default bg-default">
      <UIcon :name="cmsMediaIcon(media)" class="size-5 text-muted" aria-hidden="true" />
    </span>
    <span class="min-w-0"><span class="block truncate text-sm font-medium text-highlighted">{{ name }}</span></span>
    <UIcon name="i-lucide-arrow-up-right" class="ml-auto size-4 shrink-0 text-dimmed" aria-hidden="true" />
  </a>
</template>
