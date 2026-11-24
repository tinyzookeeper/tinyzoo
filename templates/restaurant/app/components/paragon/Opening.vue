<script setup lang="ts">
// Paragon's opening: a question beside a print of the room, with the waiter's slip laid over
// its corner: a stamp (open or shut), where, the price of the menu, the phone, tally marks.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; from?: number | null }>()
const { address, phone, tel, words, state, now, openText } = await useRestaurant()
const w = computed(() => words.value.paragon)
const open = computed(() => openText(w.value.open))
const headline = computed(() => props.block.heading.replace(/\*/g, '').trim())
// "po 23. 11.": the day on the slip
const day = computed(() => {
  const [, m, d] = clockOf(now.value).date.split('-').map(Number)
  return `${words.value.shortDays[clockOf(now.value).weekday]!.toLowerCase()} ${d}. ${m}.`
})
const to = (section: 'hours' | 'lunch') => `/#${anchorOf(section)}`
</script>

<template>
  <section :id="anchor" class="wrap pt-9 lg:pt-14 pb-16 lg:pb-24">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
      <div class="lg:col-span-7 lg:pt-6">
        <p v-if="block.eyebrow" class="print">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h mt-5 text-[3.25rem] sm:text-[4.4rem] lg:text-[6rem] !leading-[.96]">{{ tidyText(headline) }}</component>
        <p v-if="block.text" class="mt-7 max-w-[33rem] text-[1.06rem]">{{ tidyText(block.text) }}</p>
        <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink font-bold py-3" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }} -&gt;</NuxtLink>
        </div>
      </div>

      <div class="lg:col-span-5 relative flex flex-col-reverse gap-6 lg:block lg:pb-28">
        <figure v-if="block.image" class="photo">
          <CmsImage :media="block.image" eager sizes="(min-width: 1024px) 28rem, 90vw" class="w-full aspect-[4/3] lg:aspect-[5/4] object-cover" />
          <figcaption v-if="block.imageCaption" class="lg:text-right">{{ w.figure(1, block.imageCaption) }}</figcaption>
        </figure>
        <!-- the waiter's slip: open now, where, how to book -->
        <div class="slip-wrap relative z-10 mx-3 lg:mx-0 lg:absolute lg:-left-24 lg:bottom-0 lg:w-[19.5rem] -rotate-1 lg:-rotate-3">
          <div class="slip px-5 pt-7 pb-5">
            <div class="flex items-start justify-between gap-3">
              <p class="print pt-1">{{ w.today }}<br><span class="font-sans text-[1rem] normal-case tracking-normal font-bold text-type">{{ day }}</span></p>
              <p v-if="open" class="stamp" data-open :data-state="state?.open ? 'open' : 'closed'">{{ state?.open ? w.stampOpen : w.stampClosed }}</p>
            </div>
            <p v-if="open" class="mt-2 font-bold" data-open :data-state="state?.open ? 'open' : 'closed'"><span data-open-text>{{ open }}</span></p>
            <dl class="mt-3 border-t rule text-[.98rem]">
              <div v-if="address" class="flex justify-between gap-3 py-2 border-b rule"><dt>{{ w.slip.where }}</dt><dd class="font-bold text-right"><NuxtLink class="tlink" :to="to('hours')">{{ address }}</NuxtLink></dd></div>
              <div v-if="from != null" class="flex justify-between gap-3 py-2 border-b rule"><dt>{{ w.slip.menu }}</dt><dd class="font-bold text-right"><NuxtLink class="tlink" :to="to('lunch')">{{ words.fromPrice(formatPrice(from)) }}</NuxtLink></dd></div>
              <div v-if="phone" class="flex justify-between gap-3 py-2 border-b rule"><dt>{{ w.slip.table }}</dt><dd class="font-bold text-right"><a class="tlink" :href="tel">{{ phone }}</a></dd></div>
            </dl>
            <svg class="mt-4 h-7 text-ink" viewBox="0 0 150 30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              <path d="M6 4l-1 22M14 3l0 23M22 5l-1 21M30 4l1 22M1 20L35 8M50 4l-1 22M58 3l0 23M66 5l-1 21M74 4l1 22M45 21L79 8M94 4l-1 22M102 3l1 23" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
