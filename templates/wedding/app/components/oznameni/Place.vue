<script setup lang="ts">
// Oznámení's place: a matted pair of photographs, a quiet card with contour lines and the
// address, and the ways to get there as a ruled table.
const props = defineProps<{ block: BlockOf<'place'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useWedding()
const photos = computed(() => placePhotos(props.block, 'oznameni'))
const hasAddress = computed(() => !!(settings.value?.address || settings.value?.mapUrl))
</script>

<template>
  <section :id="anchor" class="wrap pt-20 lg:pt-28 pb-20 lg:pb-24">
    <div class="text-center max-w-[40rem] mx-auto">
      <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="text-[2.6rem] lg:text-[3.4rem] leading-[1.08] mt-4"><KitMarked :text="block.heading" :attrs="{ class: 'font-serif italic text-[0.9em]' }" /></component>
      <p v-if="block.text" class="mt-4">{{ tidyText(block.text) }}</p>
    </div>

    <div v-if="photos.length" class="flex flex-col sm:flex-row gap-5 lg:gap-8 mt-12 lg:mt-16">
      <figure class="sm:flex-[1.5_1_0%] min-w-0"><div class="frame aspect-[3/2]"><CmsImage :media="photos[0]!.image" sizes="(min-width: 640px) 60vw, 100vw" /></div></figure>
      <figure v-if="photos[1]" class="sm:flex-[0.75_1_0%] min-w-0"><div class="frame aspect-[3/2] sm:aspect-[3/4]"><CmsImage :media="photos[1].image" sizes="(min-width: 640px) 60vw, 100vw" /></div></figure>
    </div>

    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-12 mt-12 lg:mt-16 items-start">
      <!-- The address on a drawn map: contour lines, a dashed road, a pin -->
      <div v-if="hasAddress" class="lg:col-span-5 border border-line bg-card">
        <div class="relative aspect-[16/9] overflow-hidden border-b border-line text-line" aria-hidden="true">
          <svg class="absolute inset-0 w-full h-full" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-width="1">
            <ellipse cx="206" cy="112" rx="30" ry="19" transform="rotate(-14 206 112)" />
            <ellipse cx="203" cy="113" rx="62" ry="40" transform="rotate(-12 203 113)" />
            <ellipse cx="198" cy="115" rx="98" ry="64" transform="rotate(-10 198 115)" />
            <ellipse cx="192" cy="117" rx="138" ry="90" transform="rotate(-8 192 117)" />
            <ellipse cx="186" cy="118" rx="182" ry="118" transform="rotate(-7 186 118)" />
            <ellipse cx="180" cy="120" rx="230" ry="150" transform="rotate(-6 180 120)" />
            <ellipse cx="174" cy="122" rx="282" ry="186" transform="rotate(-5 174 122)" />
            <path d="M-10 190C70 170 110 178 150 150s40-44 56-38 60 20 110-6 70-66 110-76" stroke="var(--brand)" stroke-dasharray="5 5" />
          </svg>
          <span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-brand text-brand-ink"><UIcon name="i-lucide-map-pin" class="size-[1.125rem]" /></span>
          <span class="absolute right-4 top-3 label text-quiet">{{ words.north }}</span>
        </div>
        <div class="px-6 sm:px-9 py-8 text-center">
          <p class="label text-quiet">{{ words.address }}</p>
          <p v-if="settings?.venueName" class="font-display text-ink text-[1.75rem] leading-tight mt-2">{{ tidyText(settings.venueName) }}</p>
          <p v-if="settings?.address" class="mt-1">{{ tidyText(settings.address) }}</p>
          <p v-if="settings?.coordinates" class="label text-quiet mt-3">{{ settings.coordinates }}</p>
          <a v-if="settings?.mapUrl" class="tlink label mt-4" :href="settings.mapUrl" target="_blank" rel="noopener">{{ words.openMap }} <UIcon name="i-lucide-arrow-up-right" class="size-4" aria-hidden="true" /></a>
        </div>
      </div>

      <dl v-if="block.notes.length" class="border-b border-line" :class="hasAddress ? 'lg:col-span-7' : 'lg:col-span-12'">
        <div v-for="n in block.notes" :key="n.id" class="grid sm:grid-cols-[11rem_1fr] gap-x-6 gap-y-2 py-6 border-t border-line">
          <dt class="label text-brand pt-1.5">{{ n.label }}</dt>
          <dd>
            {{ tidyText(n.text) }}
            <span v-if="n.firstValue || n.secondValue" class="flex flex-wrap gap-x-8 gap-y-1 mt-3 text-ink">
              <span v-if="n.firstValue"><span class="label text-quiet mr-2">{{ n.firstLabel }}</span><span class="font-display text-[1.4rem]">{{ tidyText(n.firstValue) }}</span></span>
              <span v-if="n.secondValue"><span class="label text-quiet mr-2">{{ n.secondLabel }}</span><span class="font-display text-[1.4rem]">{{ tidyText(n.secondValue) }}</span></span>
            </span>
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>
