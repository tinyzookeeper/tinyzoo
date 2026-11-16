<script setup lang="ts">
// A picture from the CMS on the website: its description as alt text, its real size
// (no layout jump), lazy loading, smaller copies for smaller screens (srcset: the
// browser downloads the one that fits), and the focal point the editor set, so a
// cropped picture (object-fit: cover) keeps what matters in view.
//
//   <CmsImage :media="post.hero" class="aspect-video w-full object-cover" />
//   <CmsImage :media="post.hero" eager sizes="100vw" />   // the page's main picture
//   <CmsImage :media="card.image" sizes="(min-width: 768px) 20rem, 100vw" />   // say how wide it shows
const props = defineProps<{
  media: { id?: string; url: string; alt?: string | null; width?: number | null; height?: number | null; mime?: string | null; focal?: { x: number; y: number } | null } | null | undefined
  /** Load now (the first picture on the page); otherwise lazily. */
  eager?: boolean
  /** How wide the picture shows (CSS sizes), so the browser picks the right copy. Default: the full screen width. */
  sizes?: string
  /** Override the stored description (e.g. '' for a purely decorative picture). */
  alt?: string
}>()
const style = computed(() => (props.media?.focal ? { objectPosition: `${props.media.focal.x}% ${props.media.focal.y}%` } : undefined))

// The widths the CMS makes smaller copies at (server/utils/cmsImageSizes.ts).
const WIDTHS = [320, 640, 960, 1280, 1920]
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const srcset = computed(() => {
  const m = props.media
  if (!m?.id || !m.width || !m.mime || !RESIZABLE.has(m.mime)) return undefined
  const smaller = WIDTHS.filter((w) => w < m.width!)
  if (!smaller.length) return undefined
  return [...smaller.map((w) => `/api/cms/_media/img/${m.id}/${w}.webp ${w}w`), `${m.url} ${m.width}w`].join(', ')
})
</script>

<template>
  <img
    v-if="media?.url" :src="media.url" :srcset="srcset" :alt="alt ?? media.alt ?? ''"
    :width="media.width || undefined" :height="media.height || undefined" :sizes="srcset ? (sizes ?? '100vw') : sizes"
    :loading="eager ? 'eager' : 'lazy'" :fetchpriority="eager ? 'high' : undefined" decoding="async" :style="style"
  >
</template>
