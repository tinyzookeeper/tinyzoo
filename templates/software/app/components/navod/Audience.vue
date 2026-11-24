<script setup lang="ts">
// Návod's "who uses it": a heading with a line of text, then the customers as captioned photographs
// in a row (a row to swipe on a phone). The testimonials under it continue the same section.
const props = defineProps<{ block: BlockOf<'audience'>; first?: boolean; anchor?: string }>()
const sections = await usePageSections()
const number = computed(() => sectionNumber(sections.value, 'audience'))
const photos = computed(() => props.block.photos.filter((p) => p.image))
</script>

<template>
  <section :id="anchor" class="nv-audience border-t border-ink/15">
    <div class="wrap nv-audience-wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:gap-12">
        <div class="lg:col-span-5">
          <p v-if="block.eyebrow" class="label text-quiet"><span class="text-brand">{{ number }}</span> · {{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink lg:text-[42px]"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text" class="max-w-[36rem] lg:col-span-7 lg:pt-2">{{ tidyText(block.text) }}</p>
      </div>
      <div v-if="photos.length" class="-mx-5 mt-10 pb-2 md:mx-0">
        <UCarousel
          v-slot="{ item }" :items="photos" align="start" contain-scroll="trimSnaps" drag-free
          :ui="{ viewport: 'px-5 md:px-0', container: 'items-start -ms-4 md:-ms-6', item: 'basis-[73%] md:basis-1/4 ps-4 md:ps-6' }"
        >
          <figure>
            <CmsImage :media="item.image" sizes="(min-width: 768px) 20rem, 72vw" class="aspect-[4/3] w-full border border-ink object-cover" />
            <figcaption class="mt-3 text-[14px] leading-snug"><b class="font-semibold text-ink">{{ tidyText(item.title) }}</b><template v-if="item.caption"><br><span class="text-quiet">{{ tidyText(item.caption) }}</span></template></figcaption>
          </figure>
        </UCarousel>
      </div>
    </div>
  </section>
</template>
