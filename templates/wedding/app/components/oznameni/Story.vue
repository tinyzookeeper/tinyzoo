<script setup lang="ts">
// Oznámení's story: the parts as ruled paragraphs on the left, their photographs matted on the right.
const props = defineProps<{ block: BlockOf<'story'>; first?: boolean; anchor?: string }>()
const photos = computed(() => props.block.parts.filter((p) => p.image))
</script>

<template>
  <section :id="anchor" class="wrap pb-24 lg:pb-32">
    <div class="orn" aria-hidden="true"><i /><svg width="9" height="9" viewBox="0 0 10 10"><path d="M5 0l5 5-5 5-5-5z" fill="currentColor" /></svg><i /></div>
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-12 mt-16 lg:mt-24 items-start">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mt-4"><KitMarked :text="block.heading" :attrs="{ class: 'font-serif italic text-[0.9em]' }" /></component>

        <div v-for="(p, i) in block.parts" :key="p.id" class="border-t border-line pt-6" :class="i ? 'mt-8' : 'mt-10'">
          <p class="label text-quiet">{{ p.label }}</p>
          <p v-if="p.text" class="mt-3">{{ tidyText(p.text) }}</p>
        </div>
        <p v-if="block.closing" class="mt-8 italic">{{ tidyText(block.closing) }}</p>
      </div>

      <div v-if="photos.length" class="lg:col-span-7 lg:pl-6">
        <figure v-for="(p, i) in photos" :key="p.id" :class="i % 2 ? 'mt-10 sm:w-[68%] sm:ml-auto' : i ? 'mt-10' : ''">
          <div class="frame aspect-[3/2]"><CmsImage :media="p.image" sizes="(min-width: 1024px) 40rem, 100vw" /></div>
          <figcaption v-if="p.caption" class="label text-quiet mt-3">{{ p.caption }}</figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>
