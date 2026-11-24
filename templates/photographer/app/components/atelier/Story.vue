<script setup lang="ts">
// Ateliér's story of one day: two rows of photographs of one height, each with its time.
const props = defineProps<{ block: BlockOf<'story'>; first?: boolean }>()
const photos = computed(() => props.block.photos.filter((p) => p.image).map((p) => ({ ...p, ...shapeOf(p.image) })))
const rows = computed(() => twoRows(photos.value))
// On a phone a wide or lone picture takes the whole width; tall and square ones pair up.
const full = (row: typeof photos.value, i: number) => row[i]!.shape === 'wide' || row.length < 3
</script>

<template>
  <section class="bg-tint">
    <div class="wrap py-20 md:py-28">
      <div class="grid md:grid-cols-12 gap-x-10 gap-y-6 mb-12 md:mb-16">
        <div class="md:col-span-7">
          <p v-if="block.eyebrow" class="label text-quiet mb-4">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="text-[2.7rem] md:text-[4.2rem] leading-[1.02]"><em><KitMarked :text="block.heading" plain /></em></component>
          <p v-if="block.facts.length" class="label text-ink mt-5">{{ block.facts.map((f) => tidyText(f.value)).join(' · ') }}</p>
        </div>
        <p v-if="block.text" class="md:col-span-5 md:pt-10 max-w-[34rem]">{{ tidyText(block.text) }}</p>
      </div>

      <div class="grid gap-8 md:gap-10">
        <div v-for="(row, r) in rows" :key="r" class="jrow">
          <figure v-for="(p, i) in row" :key="p.id" :class="full(row, i) ? 'm-full' : ''" :style="{ '--ar': p.ratio }">
            <div class="ph"><CmsImage :media="p.image" sizes="(min-width: 768px) 40vw, 100vw" /></div>
            <figcaption class="pt-3 flex items-baseline gap-4">
              <span v-if="p.time" class="label text-quiet shrink-0">{{ p.time }}</span>
              <span class="font-display text-ink text-[1.15rem] leading-snug">{{ tidyText(p.caption) }}</span>
            </figcaption>
          </figure>
        </div>
      </div>

      <div v-if="block.closing || block.buttonLabel" class="mt-12 md:mt-16 flex flex-col md:flex-row md:items-center md:justify-between gap-5 border-t border-line pt-7">
        <p class="font-display text-ink text-[1.35rem] md:text-[1.6rem] leading-snug max-w-[40rem]">{{ tidyText(block.closing) }}</p>
        <NuxtLink v-if="block.buttonLabel && block.buttonUrl" class="btn label shrink-0" :to="siteHref(block.buttonUrl)">{{ block.buttonLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
      </div>
    </div>
  </section>
</template>
