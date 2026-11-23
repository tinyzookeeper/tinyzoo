<script setup lang="ts">
// Magnets' "who it is for": the heading as one large sentence, the kinds of business as pills (the
// first three filled, the last one dashed) and the first photograph as a tile with its caption.
const props = defineProps<{ block: BlockOf<'audience'>; first?: boolean; anchor?: string }>()
const photo = computed(() => props.block.photos.find((p) => p.image) ?? null)
const size = computed(() => byLength(props.block.heading, [[70, 'text-[34px] sm:text-[44px] lg:text-[52px]'], [120, 'text-[28px] sm:text-[36px] lg:text-[42px]']], 'text-[24px] sm:text-[30px] lg:text-[34px]'))
const pill = (i: number, last: boolean) => (i === 0 ? 'bg-ink px-5 py-2 text-cream' : i === 1 ? 'bg-brand px-5 py-2' : i === 2 ? 'bg-sky px-5 py-2' : last ? 'border-2 border-dashed border-ink px-5 py-1.5' : 'border-2 border-ink px-5 py-1.5')
</script>

<template>
  <section :id="anchor" class="wrap pt-12 lg:pt-20">
    <div class="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
      <div :class="photo ? 'lg:col-span-7' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="q mt-4" :class="size"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-4 max-w-[36rem]">{{ tidyText(block.text) }}</p>
        <ul v-if="block.tags.length" class="mt-7 flex flex-wrap gap-2 font-display text-[18px] font-bold lg:text-[20px]">
          <li v-for="(t, i) in block.tags" :key="i" class="rounded-full" :class="pill(i, i === block.tags.length - 1 && block.tags.length > 3)">{{ tidyText(t.text) }}</li>
        </ul>
      </div>
      <figure v-if="photo" class="lg:col-span-5">
        <CmsImage :media="photo.image" sizes="(min-width: 1024px) 32rem, 100vw" class="tile aspect-[3/2] w-full object-cover" />
        <figcaption class="mono mt-3">{{ tidyText(photo.title) }}<template v-if="photo.caption">: {{ tidyText(photo.caption) }}</template></figcaption>
      </figure>
    </div>
  </section>
</template>
