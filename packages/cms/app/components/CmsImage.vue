<script setup lang="ts">
// A picture from the CMS on the website: its description as alt text, its real size
// (no layout jump), lazy loading, smaller copies for smaller screens (srcset: the
// browser downloads the one that fits), and the focal point the editor set, so a
// cropped picture (object-fit: cover) keeps what matters in view.
//
//   <CmsImage :media="post.hero" class="aspect-video w-full object-cover" />
//   <CmsImage :media="post.hero" eager sizes="100vw" />   // the page's main picture
//   <CmsImage :media="card.image" sizes="(min-width: 768px) 20rem, 100vw" />   // say how wide it shows
import type { CmsImageProps } from '../../src/frontend'
import { CMS_IMAGE_WIDTHS as WIDTHS } from '../../shared/image-widths'

const props = defineProps<CmsImageProps>()
const style = computed(() => (props.media?.focal ? { objectPosition: `${props.media.focal.x}% ${props.media.focal.y}%` } : undefined))

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
