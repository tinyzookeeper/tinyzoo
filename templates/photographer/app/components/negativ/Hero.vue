<script setup lang="ts">
// Negativ's opening: one photograph, edge to edge and as tall as the screen, the heading in
// huge capitals at its foot. Under it, one dense line with the free dates.
const props = defineProps<{ block: BlockOf<'hero'> }>()
const { settings } = await useSite()
const words = useSiteWords()
const image = computed(() => props.block.images[0]?.image ?? null)
// The design's size holds two short lines; a longer heading steps down so it stays a headline.
const size = computed(() => byLength(props.block.heading, [
  [30, 'text-[16.5vw] md:text-[11.4vw] wide:text-[min(11.4vw,11.5rem)] max-w-[14ch]'],
  [52, 'text-[13vw] md:text-[8vw] wide:text-[min(8vw,8rem)] max-w-[19ch]'],
], 'text-[10.5vw] md:text-[6vw] wide:text-[min(6vw,6rem)] max-w-[24ch]'))
</script>

<template>
  <div>
    <section class="relative flex flex-col min-h-[100svh] md:min-h-[880px] md:h-[100svh] md:max-h-[1040px] text-[var(--on-photo)] bg-[#0b0b0a]" :class="image ? '' : 'pt-[72px] md:pt-[84px]'">
      <template v-if="image">
        <CmsImage :media="image" eager sizes="100vw" class="absolute inset-0 w-full h-full object-cover" />
        <div class="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(8,8,7,.72)_0%,rgba(8,8,7,.1)_22%,rgba(8,8,7,.12)_42%,rgba(8,8,7,.9)_86%,rgba(8,8,7,.96)_100%)]" aria-hidden="true" />
      </template>

      <div class="relative pad mt-auto pt-[96px] pb-7 md:pb-10">
        <p v-if="block.eyebrow" class="m mb-4 md:mb-5">{{ block.eyebrow }}</p>
        <h1 class="d" :class="size"><KitMarked :text="block.heading" plain /></h1>
        <div class="mt-6 md:mt-8 grid md:grid-cols-12 gap-x-10 gap-y-6 items-end">
          <p v-if="block.text" class="md:col-span-5 text-[1.1rem] md:text-[1.2rem] leading-snug max-w-[30rem]">{{ tidyText(block.text) }}</p>
          <div class="md:col-span-7 flex flex-wrap md:justify-end gap-3">
            <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn btn-ghost m !font-medium" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Free dates: one dense line -->
    <section v-if="settings?.availability || (block.secondaryLabel && block.secondaryUrl)" class="pad border-b border-rule" :aria-label="words.freeDates">
      <div class="flex flex-col md:flex-row md:items-center gap-x-10 gap-y-1 py-4 md:py-0 md:min-h-[64px] m">
        <template v-if="settings?.availability">
          <span class="text-brand shrink-0">{{ words.freeDates }}</span>
          <span class="text-fg">{{ tidyText(settings.availability) }}</span>
        </template>
        <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="lnk md:ml-auto text-fg shrink-0" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }} <UIcon name="i-lucide-arrow-right" class="ml-2 size-3.5" aria-hidden="true" /></NuxtLink>
      </div>
    </section>
  </div>
</template>
