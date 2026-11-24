<script setup lang="ts">
// Magazín's story: a large headline, two captioned photographs, the parts as dated columns,
// then a photograph across the whole page.
const props = defineProps<{ block: BlockOf<'story'>; first?: boolean; anchor?: string }>()
const photos = computed(() => props.block.parts.filter((p) => p.image))
</script>

<template>
  <div :id="anchor">
    <section class="wrap pt-24 lg:pt-40 pb-20 lg:pb-32">
      <div class="grid lg:grid-cols-12 gap-x-10">
        <p v-if="block.eyebrow" class="label text-brand lg:col-span-12">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="lg:col-span-9 text-[2.7rem] sm:text-[3.4rem] lg:text-[5rem] leading-[1.04] lg:leading-[1.02] tracking-[-0.02em] mt-5 display"><KitMarked :text="block.heading" :attrs="{ class: 'text-brand' }" /></component>
      </div>

      <div v-if="photos.length" class="grid lg:grid-cols-12 gap-x-10 gap-y-9 items-end mt-12 lg:mt-20">
        <figure v-for="(p, i) in photos" :key="p.id" :class="i % 2 ? 'lg:col-span-5 sm:max-lg:w-[70%] sm:max-lg:ml-auto' : 'lg:col-span-7'">
          <div class="zoom aspect-[3/2]"><CmsImage :media="p.image" sizes="(min-width: 1024px) 44rem, 100vw" /></div>
          <figcaption v-if="p.caption" class="cap"><b v-if="captionParts(p.caption)[0]">{{ captionParts(p.caption)[0] }}</b>{{ captionParts(p.caption)[1] }}</figcaption>
        </figure>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-12 gap-x-10 gap-y-10 mt-14 lg:mt-20">
        <div v-for="p in block.parts" :key="p.id" class="lg:col-span-4">
          <p class="label text-quiet border-t border-ink pt-4">{{ p.label }}</p>
          <p v-if="p.text" class="mt-5">{{ tidyText(p.text) }}</p>
        </div>
        <p v-if="block.closing" class="md:col-span-2 lg:col-span-4 serif text-ink text-[1.7rem] lg:text-[2rem] leading-[1.25] lg:pl-6 lg:pt-3">{{ tidyText(block.closing) }}</p>
      </div>
    </section>

    <figure v-if="block.wideImage">
      <div class="aspect-[4/5] sm:aspect-[16/9] lg:aspect-[2/1] lg:max-h-[52rem] w-full overflow-hidden">
        <CmsImage :media="block.wideImage" sizes="(min-width: 640px) 100vw, 200vw" class="w-full h-full object-cover" />
      </div>
      <figcaption v-if="block.wideCaption" class="wrap cap sm:text-right"><b v-if="captionParts(block.wideCaption)[0]">{{ captionParts(block.wideCaption)[0] }}</b>{{ captionParts(block.wideCaption)[1] }}</figcaption>
    </figure>
  </div>
</template>
