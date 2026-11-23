<script setup lang="ts">
// Patra's gallery: rounded photographs with their captions on a pill laid over the corner, in a
// twelve-column grid of wide and narrow pictures (seven and five, four and eight columns); a row
// to swipe on a phone.
const props = defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string }>()
// [columns of twelve, height on a tablet, height on a desktop, width on a phone]
const PATTERN = [
  { span: 'md:col-span-7', height: 'md:h-[24rem] lg:h-[31rem]', phone: 'w-[84vw]', sizes: '(min-width: 1024px) 50rem, (min-width: 768px) 58vw, 84vw' },
  { span: 'md:col-span-5', height: 'md:h-[24rem] lg:h-[31rem]', phone: 'w-[64vw]', sizes: '(min-width: 1024px) 36rem, (min-width: 768px) 42vw, 64vw' },
  { span: 'md:col-span-4', height: 'md:h-[24rem] lg:h-[33rem]', phone: 'w-[64vw]', sizes: '(min-width: 1024px) 30rem, (min-width: 768px) 34vw, 64vw' },
  { span: 'md:col-span-8', height: 'md:h-[24rem] lg:h-[33rem]', phone: 'w-[84vw]', sizes: '(min-width: 1024px) 56rem, (min-width: 768px) 66vw, 84vw' },
]
const cells = computed(() => props.block.photos.filter((p) => p.image).map((p, i) => ({ ...p, ...PATTERN[i % PATTERN.length]! })))
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-4 items-end">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3">{{ block.heading }}</component>
      </div>
      <p v-if="block.text" class="lead lg:col-span-5">{{ tidyText(block.text) }}</p>
    </div>
    <!-- a phone swipes the row -->
    <div class="md:hidden mt-10">
      <UCarousel v-slot="{ item }" :items="cells" align="start" contain-scroll="trimSnaps" drag-free :ui="{ viewport: '-mx-5 px-5', container: '-ms-3', item: 'basis-auto ps-3' }">
        <figure class="relative h-[19rem]" :class="item.phone"><CmsImage :media="item.image!" class="photo" :sizes="item.sizes" /><figcaption v-if="item.caption" class="chip-cap">{{ item.caption }}</figcaption></figure>
      </UCarousel>
    </div>
    <div class="hidden md:grid mt-10 lg:mt-12 md:grid-cols-12 md:gap-4 lg:gap-6">
      <figure v-for="(c, i) in cells" :key="i" class="relative" :class="[c.span, c.height]"><CmsImage :media="c.image!" class="photo" :sizes="c.sizes" /><figcaption v-if="c.caption" class="chip-cap">{{ c.caption }}</figcaption></figure>
    </div>
  </section>
</template>
