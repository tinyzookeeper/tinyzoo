<script setup lang="ts">
// Magazín's opening: a split cover. The names set large on the white half, the invitation and
// a three-part "when / where / reply" line under them, the couple's portrait bleeding off the
// other half (the header lies over the cover's first row when this block opens the page).
const props = defineProps<{ block: BlockOf<'invitation'>; first?: boolean; anchor?: string }>()
const { settings, couple, day, deadline, words } = await useWedding()
const photo = computed(() => invitationPhoto(props.block, 'magazin'))
const letter = computed(() => [props.block.greeting, props.block.lead, props.block.text].map((t) => t?.trim()).filter(Boolean).join(' '))
</script>

<template>
  <div :id="anchor" class="cover" :class="first ? '-mt-[68px] lg:-mt-[92px]' : ''">
    <div class="cover-nav" :class="first ? 'h-[68px] lg:h-[92px]' : 'h-10 lg:h-16'" aria-hidden="true" />

    <div class="cover-head pad pt-6 pb-8 lg:pt-0 lg:pb-9">
      <p v-if="block.eyebrow" class="label text-brand rise">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="rise rise-2 text-[clamp(4rem,19vw,6.5rem)] lg:text-[clamp(5rem,8.3vw,8.6rem)] leading-[1.08] tracking-[-0.02em] mt-3 lg:mt-4 display" data-wordmark>
        <template v-if="couple.second">{{ couple.first }}<br><em class="text-brand font-normal">{{ words.and }}</em> {{ couple.second }}</template>
        <template v-else>{{ couple.first }}</template>
      </component>
    </div>

    <figure class="cover-photo relative aspect-[4/5] sm:aspect-[3/2] lg:aspect-auto bg-tint">
      <CmsImage v-if="photo" :media="photo" eager sizes="(min-width: 1024px) 52vw, 100vw" class="absolute inset-0 w-full h-full object-cover" />
    </figure>

    <div class="cover-intro pad pt-9 lg:pt-0 rise rise-3">
      <p v-if="letter" class="max-w-[31rem] text-[1.1rem] leading-[1.7]">{{ tidyText(letter) }}</p>
      <div class="flex flex-wrap items-center gap-x-8 gap-y-2 mt-8">
        <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn label max-sm:w-full" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
        <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink label" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
      </div>
    </div>

    <div class="cover-meta pad mt-12 lg:mt-0">
      <dl class="grid grid-cols-1 sm:grid-cols-3 gap-x-6 border-t border-line sm:py-6 lg:py-7">
        <div v-if="day" class="max-sm:py-4 max-sm:border-b max-sm:border-line max-sm:grid max-sm:grid-cols-[5.5rem_1fr] max-sm:items-baseline">
          <dt class="label text-quiet">{{ words.when }}</dt>
          <dd class="serif text-ink text-[1.25rem] leading-[1.3] sm:mt-2"><time :datetime="day.iso">{{ tidyText(day.date) }}</time><span class="block font-sans text-[0.9rem] tracking-normal text-body mt-0.5">{{ [day.weekday, day.time ? tidyText(words.ceremonyAt(day.time)) : ''].filter(Boolean).join(', ') }}</span></dd>
        </div>
        <div v-if="settings?.venueName" class="max-sm:py-4 max-sm:border-b max-sm:border-line max-sm:grid max-sm:grid-cols-[5.5rem_1fr] max-sm:items-baseline">
          <dt class="label text-quiet">{{ words.where }}</dt>
          <dd class="serif text-ink text-[1.25rem] leading-[1.3] sm:mt-2">{{ tidyText(settings.venueName) }}<span v-if="settings.venueArea" class="block font-sans text-[0.9rem] tracking-normal text-body mt-0.5">{{ tidyText(beforeComma(settings.venueArea)) }}</span></dd>
        </div>
        <div v-if="deadline" class="max-sm:py-4 max-sm:grid max-sm:grid-cols-[5.5rem_1fr] max-sm:items-baseline">
          <dt class="label text-quiet">{{ words.reply }}</dt>
          <dd class="serif text-ink text-[1.25rem] leading-[1.3] sm:mt-2">{{ tidyText(words.until(deadline.date)) }}<span class="block font-sans text-[0.9rem] tracking-normal text-body mt-0.5">{{ words.byFormBelow }}</span></dd>
        </div>
      </dl>
    </div>
  </div>
</template>
