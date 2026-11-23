<script setup lang="ts">
// Večer's opening: the evening photograph across the whole screen, the names in a light italic
// over its sky (the header sits over the same photograph when this block opens the page), and
// under it the invitation itself beside the couple's portrait in a champagne keyline.
const props = defineProps<{ block: BlockOf<'invitation'>; first?: boolean; anchor?: string }>()
const { settings, couple, names, day, deadline, words } = await useWedding()
const photo = computed(() => invitationPhoto(props.block, 'vecer'))
const area = computed(() => beforeComma(settings.value?.venueArea))
const ceremony = computed(() => (day.value?.time ? words.value.ceremonyAt(day.value.time) : ''))
// On a phone the place and the ceremony share a line while they fit; a longer pair stands on two.
const stacked = computed(() => area.value.length + ceremony.value.length > 31)
</script>

<template>
  <div :id="anchor">
    <!-- The evening on the farm -->
    <div class="relative isolate flex flex-col h-[100svh] min-h-[40rem] max-h-[62rem] overflow-hidden" :class="first ? '-mt-[76px] lg:-mt-[104px] pt-[76px] lg:pt-[104px]' : ''">
      <!-- (a wide photograph fills a tall screen by its height: the copy asked for is as wide as that needs) -->
      <CmsImage v-if="photo" :media="photo" eager sizes="(min-aspect-ratio: 3/2) 100vw, 150vh" class="absolute inset-0 -z-20 w-full h-full object-cover" />
      <div class="hero-scrim absolute inset-0 -z-10" aria-hidden="true" />

      <section class="wrap w-full text-center pt-[4svh] lg:pt-[3.5svh]">
        <p v-if="block.eyebrow" class="label text-brand rise">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="rise rise-2 italic font-light text-[clamp(3.9rem,17vw,5.5rem)] lg:text-[clamp(4.2rem,min(8.4vw,13svh),7.6rem)] leading-[1.06] lg:leading-[1.1] tracking-[-0.02em] mt-6 lg:mt-8" data-wordmark>
          <template v-if="couple.second"><span class="block lg:inline">{{ couple.first }}</span> <span class="block lg:inline text-brand text-[0.7em] lg:text-[0.82em] leading-none lg:mx-[0.04em]">&amp;</span> <span class="block lg:inline">{{ couple.second }}</span></template>
          <template v-else>{{ couple.first }}</template>
        </component>
        <div class="rise rise-3">
          <span class="block w-12 h-px bg-brand/70 mx-auto mt-7 lg:mt-5" aria-hidden="true" />
          <p v-if="day" class="text-ink text-[1.45rem] lg:text-[1.75rem] leading-tight mt-6 lg:mt-7"><time :datetime="day.iso">{{ day.weekday }} {{ tidyText(day.date) }}</time></p>
          <p v-if="settings?.venueName || area || ceremony" class="label text-ink mt-3 lg:mt-4 max-sm:leading-[2]">
            <span v-if="settings?.venueName" class="max-sm:block">{{ settings.venueName }}</span> <span v-if="settings?.venueName && (area || ceremony)" class="text-brand mx-1 max-sm:hidden" aria-hidden="true">·</span> <span v-if="area || ceremony" class="max-sm:block"><span :class="stacked ? 'max-sm:block' : ''">{{ area }}</span> <span v-if="area && ceremony" class="text-brand mx-1" :class="stacked ? 'max-sm:hidden' : ''" aria-hidden="true">·</span> <span v-if="ceremony" :class="stacked ? 'max-sm:block' : ''">{{ tidyText(ceremony) }}</span></span>
          </p>
        </div>
      </section>
    </div>

    <!-- The invitation -->
    <section class="wrap pt-20 lg:pt-32 pb-24 lg:pb-36">
      <div class="grid lg:grid-cols-12 gap-x-12 gap-y-14 items-center">
        <figure v-if="block.image" class="lg:col-span-5 w-full max-w-[25rem] lg:max-w-none mx-auto p-[11px]">
          <div class="keyline aspect-[4/5]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 28rem, 90vw" class="w-full h-full object-cover" /></div>
        </figure>
        <div :class="block.image ? 'lg:col-span-6 lg:col-start-7' : 'lg:col-span-8 lg:col-start-3'">
          <p v-if="block.greeting" class="label text-brand">{{ block.greeting }}</p>
          <p v-if="block.lead" class="italic font-light text-ink text-[1.75rem] lg:text-[2.35rem] leading-[1.22] tracking-[-0.01em] mt-5">{{ tidyText(block.lead) }}</p>
          <p v-if="block.text" class="mt-7 max-w-[33rem]">{{ tidyText(block.text) }}</p>
          <p class="italic text-brand text-[1.5rem] mt-6">{{ names }}</p>
          <div class="flex flex-col sm:flex-row sm:items-center gap-x-9 gap-y-3 mt-9">
            <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn label" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
            <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink label self-start sm:self-auto" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
          </div>
          <p v-if="deadline" class="label text-quiet mt-7">{{ words.replyBy(deadline.date) }}</p>
        </div>
      </div>
    </section>
  </div>
</template>
