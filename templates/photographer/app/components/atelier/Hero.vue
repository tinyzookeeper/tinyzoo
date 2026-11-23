<script setup lang="ts">
// Ateliér's opening: one wide photograph with its caption, then the heading beside the text.
const props = defineProps<{ block: BlockOf<'hero'> }>()
const { settings } = await useSite()
const first = computed(() => props.block.images[0] ?? null)
// "Anna a Vojta · Budislav, srpen 2026": the caption's two halves sit at the two ends.
const caption = computed(() => {
  const [left, ...rest] = (first.value?.caption ?? '').split(' · ')
  return { left: left ?? '', right: rest.join(' · ') }
})
</script>

<template>
  <section class="wrap pt-5 md:pt-8">
    <figure v-if="first?.image">
      <div class="ph aspect-[4/5] md:aspect-[16/7]">
        <CmsImage :media="first.image" eager sizes="(min-width: 1360px) 75rem, 100vw" />
      </div>
      <figcaption v-if="first.caption" class="flex justify-between gap-6 pt-3 label text-quiet">
        <span>{{ caption.left }}</span>
        <span class="text-right">{{ caption.right }}</span>
      </figcaption>
    </figure>

    <div class="grid md:grid-cols-12 gap-x-10 gap-y-7 pt-10 md:pt-16 pb-20 md:pb-28">
      <div class="md:col-span-8">
        <p v-if="block.eyebrow" class="label text-quiet mb-4 md:mb-5">{{ block.eyebrow }}</p>
        <h1 class="text-[2.55rem] md:text-[4.5rem] leading-[1.04] text-balance"><KitMarked :text="block.heading" /></h1>
      </div>
      <div class="md:col-span-4 md:pt-4">
        <p v-if="block.text">{{ tidyText(block.text) }}</p>
        <p v-if="settings?.availability" class="mt-4 text-ink">{{ tidyText(settings.availability) }}</p>
        <div class="mt-5 flex flex-wrap gap-x-8 gap-y-1 label">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="tlink" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
