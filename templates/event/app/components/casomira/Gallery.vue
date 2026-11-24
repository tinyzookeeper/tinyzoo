<script setup lang="ts">
// Časomíra's photographs: one strip to swipe, every photograph with a caption in mono under it
// and graded down to sit in the dark page (full colour on hover). Taller than wide ones keep
// their shape; every one is as high as the others.
const props = defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string }>()
const { words } = await useEvent()
const photos = computed(() => props.block.photos.filter((p) => p.image))
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap flex flex-wrap items-end justify-between gap-4">
      <div>
        <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
      </div>
      <a v-if="block.linkLabel && block.linkUrl" :href="siteHref(block.linkUrl)" class="ulink mono" :target="isExternal(block.linkUrl) ? '_blank' : undefined" :rel="isExternal(block.linkUrl) ? 'noopener' : undefined">{{ block.linkLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></a>
    </div>
    <div v-if="photos.length" class="mt-9" role="group" :aria-label="words.swipePhotos">
      <UCarousel
        v-slot="{ item }" :items="photos" align="start" contain-scroll="trimSnaps" drag-free
        :ui="{ viewport: 'strip-pad', container: 'items-start -ms-3', item: 'basis-auto ps-3' }"
      >
        <figure>
          <CmsImage :media="item.image" sizes="(min-width: 640px) 26rem, 17rem" class="ph h-[17rem] sm:h-[26rem] w-auto object-cover rounded-[6px]" :class="aspectOf(item.image)" draggable="false" />
          <figcaption v-if="item.caption" class="mono text-quiet mt-2.5">{{ item.caption }}</figcaption>
        </figure>
      </UCarousel>
    </div>
    <p v-if="block.credit" class="wrap mt-4 mono text-quiet">{{ block.credit }}</p>
  </section>
</template>
