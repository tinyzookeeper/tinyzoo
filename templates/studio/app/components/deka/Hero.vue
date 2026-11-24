<script setup lang="ts">
// Deka's opening: the heading and the buttons on the left; on the right the photograph of the
// hall beside a strip of blanket, a second photograph laid over its corner and a round sticker
// for the free first class. A strip of the blanket closes the opening.
const props = defineProps<{ block: BlockOf<'hero'>; first?: boolean; slots: Slot[] }>()
const photos = computed(() => heroPhotos(props.block, 'deka'))
// The heading's size steps down for a longer one; the design's own wording is the first step.
const size = computed(() => byLength(props.block.heading, [[56, 'text-[clamp(2.5rem,5.1vw,4.4rem)]'], [90, 'text-[clamp(2.2rem,4.4vw,3.6rem)]']], 'text-[clamp(1.9rem,3.6vw,3rem)]'))
</script>

<template>
  <div>
    <section class="wrap pt-4 pb-14 md:pt-8 md:pb-20">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-12 items-center">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-5 leading-[1.04]" :class="size"><KitMarked :text="block.heading" :attrs="{ class: 'font-medium lg:block' }" /></component>
          <p v-if="block.text" class="mt-6 max-w-[33rem] text-[1.15rem] leading-[1.6]">{{ tidyText(block.text) }}</p>
          <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
            <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
            <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="tlink" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }} <UIcon name="i-lucide-arrow-down" class="size-[1em]" aria-hidden="true" /></NuxtLink>
          </div>
        </div>
        <div v-if="photos.main" class="lg:col-span-5">
          <div class="relative pb-[26%]">
            <div class="blanket absolute right-0 top-[8%] bottom-[9%] w-[34%] rounded-md" aria-hidden="true" />
            <div class="ph relative aspect-[5/4] w-[88%] shadow-[0_0_0_6px_var(--paper)]">
              <CmsImage :media="photos.main" eager sizes="(min-width: 1024px) 34rem, 88vw" class="object-[66%_50%]" />
            </div>
            <div v-if="photos.small" class="ph absolute right-[6%] bottom-0 w-[42%] aspect-square shadow-[0_0_0_6px_var(--paper)]">
              <CmsImage :media="photos.small" sizes="(min-width: 1024px) 16rem, 42vw" class="object-[70%_60%]" />
            </div>
            <p v-if="block.badgeTop || block.badgeBottom" class="absolute left-[5%] bottom-[3%] flex flex-col items-center justify-center w-[7.25rem] h-[7.25rem] sm:w-[8.25rem] sm:h-[8.25rem] rounded-full bg-brand text-brand-ink text-center -rotate-[8deg] shadow-[0_0_0_6px_var(--paper)]">
              <span class="font-display font-bold text-[1.5rem] sm:text-[1.75rem] leading-none">{{ block.badgeTop }}</span>
              <span class="mt-1 font-semibold text-[0.95rem] sm:text-[1.05rem] leading-none">{{ block.badgeBottom }}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
    <div class="stripes" aria-hidden="true" />
  </div>
</template>
