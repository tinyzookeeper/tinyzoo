<script setup lang="ts">
// Oznámení's opening: the announcement itself. The names centred with an italic ampersand,
// the couple in an oval cameo between "when" and "where", then the invitation in italics.
const props = defineProps<{ block: BlockOf<'invitation'>; first?: boolean; anchor?: string }>()
const { settings, couple, day, deadline, words } = await useWedding()
const letter = computed(() => [props.block.greeting, props.block.lead, props.block.text].map((t) => t?.trim()).filter(Boolean).join(' '))
// "Statek / U Staré lípy": the first word on a line of its own, as the day stands over the date.
const venue = computed(() => {
  const [head, ...rest] = (settings.value?.venueName ?? '').trim().split(/\s+/)
  return { head: head ?? '', rest: rest.join(' ') }
})
</script>

<template>
  <section :id="anchor" class="wrap pt-8 lg:pt-10 pb-20 lg:pb-28 text-center">
    <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="text-[clamp(3.9rem,11vw,10rem)] leading-[0.98] tracking-[-0.01em] mt-5 lg:mt-6" data-wordmark>
      <template v-if="couple.second"><span class="block lg:inline">{{ couple.first }}</span> <span class="amp block lg:inline text-[0.62em] lg:text-[0.8em] leading-none lg:mx-[0.08em]">&amp;</span> <span class="block lg:inline">{{ couple.second }}</span></template>
      <template v-else>{{ couple.first }}</template>
    </component>

    <div class="grid lg:grid-cols-[1fr_auto_1fr] items-center gap-y-0 lg:gap-x-16 mt-10 lg:mt-12">
      <div class="order-2 lg:order-1 lg:justify-self-end w-full max-w-[21rem] mx-auto lg:mx-0">
        <div v-if="day" class="rule-pair">
          <p class="label text-quiet">{{ words.when }}</p>
          <p class="font-display text-ink text-[2rem] leading-[1.15] mt-2">{{ day.weekday }}<br><time :datetime="day.iso">{{ tidyText(day.date) }}</time></p>
          <p v-if="day.time" class="mt-2 italic">{{ tidyText(words.ceremonyStarts(day.time)) }}</p>
        </div>
      </div>
      <figure v-if="block.image" class="oval order-1 lg:order-2 w-[15.5rem] sm:w-[18rem] lg:w-[19.5rem] mx-auto mb-10 lg:mb-0">
        <div><CmsImage :media="block.image" eager sizes="26rem" /></div>
      </figure>
      <div class="order-3 lg:justify-self-start w-full max-w-[21rem] mx-auto lg:mx-0">
        <div v-if="settings?.venueName" class="rule-pair" :class="day ? 'max-lg:border-t-0' : ''">
          <p class="label text-quiet">{{ words.where }}</p>
          <p class="font-display text-ink text-[2rem] leading-[1.15] mt-2">{{ venue.head }}<template v-if="venue.rest"><br>{{ tidyText(venue.rest) }}</template></p>
          <p v-if="settings.venueArea" class="mt-2 italic">{{ tidyText(settings.venueArea) }}</p>
        </div>
      </div>
    </div>

    <div class="max-w-[39rem] mx-auto mt-14 lg:mt-20">
      <p v-if="letter" class="text-[1.15rem] leading-[1.85] italic text-ink">{{ tidyText(letter) }}</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-x-9 gap-y-3 mt-9">
        <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn label" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
        <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink label" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
      </div>
      <p v-if="deadline" class="label text-quiet mt-6">{{ words.replyBy(deadline.date) }}</p>
    </div>
  </section>
</template>
