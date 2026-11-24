<script setup lang="ts">
// One Day's "who uses it" (the design has no such section: it is drawn from its own elements): a
// heading and a line, the kinds of business as pills, the customers as rounded photographs.
const props = defineProps<{ block: BlockOf<'audience'>; first?: boolean; anchor?: string }>()
const photos = computed(() => props.block.photos.filter((p) => p.image))
</script>

<template>
  <section :id="anchor" class="bg-noon">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="pb-16 pt-6 lg:pb-28 lg:pl-14 lg:pt-24">
        <p v-if="block.eyebrow" class="time text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 max-w-[24ch] text-[36px] sm:text-[46px] lg:text-[52px]" :class="block.eyebrow ? 'mt-3' : ''"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[36rem]">{{ tidyText(block.text) }}</p>
        <ul v-if="block.tags.length" class="mt-7 flex flex-wrap gap-2 text-[16px] font-medium">
          <li v-for="(t, i) in block.tags" :key="i" class="rounded-full bg-morning px-4 py-1.5 shadow-[inset_0_0_0_1px_rgb(43_29_18/.15)]">{{ tidyText(t.text) }}</li>
        </ul>
        <div v-if="photos.length" class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <figure v-for="(p, i) in photos" :key="i">
            <CmsImage :media="p.image" sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 100vw" class="aspect-[4/3] w-full rounded-[22px] object-cover" />
            <figcaption class="mt-3 text-[15px] leading-snug"><b class="font-semibold">{{ tidyText(p.title) }}</b><template v-if="p.caption"><br><span class="opacity-75">{{ tidyText(p.caption) }}</span></template></figcaption>
          </figure>
        </div>
      </div>
    </div>
  </section>
</template>
