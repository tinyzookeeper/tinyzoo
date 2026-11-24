<script setup lang="ts">
// Negativ's story of one day: a film strip. Two full-width rows on a desktop, one row to
// swipe on a phone.
const props = defineProps<{ block: BlockOf<'story'>; first?: boolean }>()
const words = useSiteWords()
const photos = computed(() => props.block.photos.filter((p) => p.image).map((p) => ({ ...p, ...shapeOf(p.image) })))
const rows = computed(() => twoRows(photos.value, 'first'))
const size = computed(() => byLength(props.block.heading, [
  [14, 'text-[19vw] md:text-[11vw] wide:text-[min(11vw,11rem)]'],
  [26, 'text-[14vw] md:text-[8vw] wide:text-[min(8vw,8rem)]'],
], 'text-[11vw] md:text-[6vw] wide:text-[min(6vw,6rem)]'))
</script>

<template>
  <section class="bg-panel mt-[4px] pt-14 md:pt-24 pb-14 md:pb-24 overflow-hidden">
    <div class="pad grid md:grid-cols-12 gap-x-10 gap-y-6 items-end mb-9 md:mb-14">
      <div class="md:col-span-8">
        <p v-if="block.eyebrow" class="m text-brand mb-4">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="d" :class="size"><KitMarked :text="block.heading" plain /></component>
      </div>
      <dl v-if="block.facts.length" class="md:col-span-4 m grid grid-cols-[5.5rem_1fr] gap-y-1.5 border-t border-rule pt-4">
        <template v-for="f in block.facts" :key="f.id">
          <dt class="text-dim">{{ f.label }}</dt><dd>{{ f.value }}</dd>
        </template>
      </dl>
    </div>

    <!-- a desktop: two rows across the whole page -->
    <div class="strip">
      <div v-for="(row, r) in rows" :key="r" class="row">
        <figure v-for="p in row" :key="p.id" :style="{ '--ar': p.ratio }">
          <div class="frame"><CmsImage :media="p.image" sizes="40vw" /></div>
          <figcaption class="m pt-2.5 px-3 flex gap-4"><span v-if="p.time" class="text-brand shrink-0">{{ p.time }}</span><span>{{ p.caption }}</span></figcaption>
        </figure>
      </div>
    </div>
    <!-- a phone: one row to swipe, the next picture peeking in -->
    <UCarousel
      v-slot="{ item }" :items="photos" align="start" drag-free contain-scroll="trimSnaps" class="md:hidden"
      :ui="{ root: 'px-5', viewport: 'overflow-visible', container: '-ms-1 items-start', item: 'basis-auto ps-1' }"
    >
      <figure :style="{ '--ar': item.ratio, 'width': `calc(${item.ratio} * 20.5rem)` }">
        <div class="frame"><CmsImage :media="item.image" sizes="90vw" /></div>
        <figcaption class="m pt-2.5 flex gap-4"><span v-if="item.time" class="text-brand shrink-0">{{ item.time }}</span><span>{{ item.caption }}</span></figcaption>
      </figure>
    </UCarousel>
    <p v-if="photos.length > 1" class="md:hidden pad m text-dim mt-4 flex items-center gap-2">{{ words.swipe }} <UIcon name="i-lucide-arrow-right" class="size-3.5" aria-hidden="true" /></p>

    <div class="pad grid md:grid-cols-12 gap-x-10 gap-y-6 items-start mt-9 md:mt-14">
      <div class="md:col-span-6 md:col-start-1">
        <p v-if="block.text" class="text-[1.3rem] md:text-[1.65rem] leading-[1.3] font-medium">{{ tidyText(block.text) }}</p>
        <p v-if="block.closing" class="mt-4 text-dim">{{ tidyText(block.closing) }}</p>
      </div>
      <div v-if="block.buttonLabel && block.buttonUrl" class="md:col-span-5 md:col-start-8 flex md:justify-end">
        <NuxtLink class="btn m !font-medium" :to="siteHref(block.buttonUrl)">{{ block.buttonLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </section>
</template>
