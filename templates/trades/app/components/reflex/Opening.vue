<script setup lang="ts">
// Reflex's opening: a field of the signal colour with the headline as large as the screen, and
// under it the phone number as the largest thing on the page, on a black slab that is a link.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean }>()
const { settings, phone, words } = await useTrades()
// The design's own words are huge; a longer headline steps down so it still fits the screen.
const size = computed(() => byLength(props.block.heading, [[26, 'lg:text-[9.6vw]'], [50, 'lg:text-[6.4vw]']], 'lg:text-[4.4vw]'))
</script>

<template>
  <div class="on-brand bg-brand text-brand-ink">
    <section class="wrap pt-6 md:pt-8 pb-8 md:pb-10">
      <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" :class="size" class="mt-4 md:mt-5 text-[4.4rem] sm:text-[6rem] leading-[0.88] tracking-[-0.05em] font-black"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'block lg:inline' }" /></component>
      <div class="mt-6 md:mt-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <p v-if="block.text" class="max-w-[38rem] text-[1.1875rem] md:text-[1.375rem] leading-[1.35] font-medium">{{ tidyText(block.text) }}</p>
        <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="siteHref(block.secondaryUrl)" class="btn btn-line shrink-0 !min-h-[60px] md:!px-7">{{ block.secondaryLabel }} <UIcon name="i-lucide-arrow-down-right" class="size-[22px]" aria-hidden="true" /></NuxtLink>
      </div>
      <!-- A photograph of the owner, when the block has one: wide, with its caption on a black label -->
      <figure v-if="block.image" class="relative mt-8 md:mt-10">
        <div class="ph aspect-[4/3] sm:aspect-[2/1] lg:aspect-[21/9]"><CmsImage :media="block.image" eager sizes="100vw" /></div>
        <figcaption v-if="block.imageCaption" class="absolute left-0 bottom-0 bg-ink text-white label !text-[0.9375rem] px-5 py-2.5">{{ block.imageCaption }}</figcaption>
      </figure>
    </section>
  </div>

  <a v-if="phone" :href="phone.href" class="on-dark group block bg-ink text-brand-lit hover:bg-coal transition-colors" :aria-label="words.callNumber(phone.text)">
    <span class="wrap flex flex-col lg:flex-row lg:items-end lg:justify-between gap-x-10 gap-y-3 pt-6 pb-5 md:pt-8 md:pb-6">
      <span class="font-cond font-black text-[17.2vw] lg:text-[15.4vw] leading-[0.8] tracking-[-0.015em] tabular-nums whitespace-nowrap">{{ phone.text }}</span>
      <span class="flex lg:flex-col items-center lg:items-end justify-between gap-4 text-white lg:pb-2 lg:text-right">
        <span class="hidden lg:inline-flex items-center justify-center w-16 h-16 bg-brand text-brand-ink transition-transform group-hover:-translate-y-1"><UIcon name="i-lucide-phone-call" class="size-[30px]" aria-hidden="true" /></span>
        <span v-if="settings?.hoursLine || settings?.emergency" class="label !text-[1rem] md:!text-[1.0625rem] leading-[1.35]"><template v-if="settings?.hoursLine">{{ words.answeringShort }} {{ settings.hoursLine }}</template><br v-if="settings?.hoursLine && settings?.emergency"><span v-if="settings?.emergency" class="text-brand-lit">{{ words.emergency }} {{ settings.emergency }}</span></span>
        <span class="lg:hidden inline-flex items-center justify-center w-12 h-12 shrink-0 bg-brand text-brand-ink"><UIcon name="i-lucide-phone-call" class="size-6" aria-hidden="true" /></span>
      </span>
    </span>
  </a>
</template>
