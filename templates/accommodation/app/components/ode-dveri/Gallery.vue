<script setup lang="ts">
// Ode dveří's gallery: one row of photographs to swipe, each with its caption, ending in a
// tile that leads to the whole gallery. Arrows beside the heading move the row.
const props = defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string }>()
const { words } = await useStay()
const carousel = useTemplateRef('carousel')
const photos = computed(() => props.block.photos.filter((p) => !!p.image))
const items = computed(() => [...photos.value.map((p) => ({ kind: 'photo' as const, id: p.id, image: p.image!, caption: p.caption })), ...(props.block.moreUrl ? [{ kind: 'more' as const, id: 'more' }] : [])])
// The widths of the slides, repeating after four.
const WIDTHS = ['w-[80vw] sm:w-[36rem]', 'w-[80vw] sm:w-[36rem]', 'w-[60vw] sm:w-[25rem]', 'w-[52vw] sm:w-[20rem]']
</script>

<template>
  <section :id="anchor" class="pt-20 md:pt-28">
    <div class="wrap flex flex-wrap items-end justify-between gap-4">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <div class="flex items-center gap-2">
        <button type="button" class="fchip !px-3.5" :aria-label="words.previous" @click="carousel?.emblaApi?.scrollPrev()"><UIcon name="i-lucide-arrow-left" class="size-5" aria-hidden="true" /></button>
        <button type="button" class="fchip !px-3.5" :aria-label="words.next" @click="carousel?.emblaApi?.scrollNext()"><UIcon name="i-lucide-arrow-right" class="size-5" aria-hidden="true" /></button>
      </div>
    </div>
    <div class="wrap !pr-0 mt-8 md:mt-10" role="group" :aria-label="words.galleryStrip">
      <UCarousel
        ref="carousel" v-slot="{ item, index }" :items="items" align="start" contain-scroll="trimSnaps" drag-free
        :ui="{ container: 'items-start -ms-4', item: 'basis-auto ps-4' }"
      >
        <figure v-if="item.kind === 'photo'" :class="WIDTHS[index % 4]">
          <div class="ph h-[15rem] sm:h-[25rem]"><CmsImage :media="item.image" sizes="(min-width: 640px) 36rem, 80vw" /></div>
          <figcaption v-if="item.caption" class="mt-2.5 text-sm text-quiet">{{ item.caption }}</figcaption>
        </figure>
        <NuxtLink v-else :to="siteHref(block.moreUrl)" class="w-[60vw] sm:w-[20rem] h-[15rem] sm:h-[25rem] rounded-[20px] bg-soft text-ink p-7 flex flex-col justify-between hover:bg-brand-soft transition-colors">
          <span class="text-5xl font-semibold tracking-[-0.03em] num">{{ block.moreCount }}</span>
          <span class="font-semibold text-xl leading-snug">{{ block.moreLabel }} <UIcon name="i-lucide-arrow-right" class="align-middle size-[1em] text-brand" aria-hidden="true" /></span>
        </NuxtLink>
      </UCarousel>
    </div>
  </section>
</template>
