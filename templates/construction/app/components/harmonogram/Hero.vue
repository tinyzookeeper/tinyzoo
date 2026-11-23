<script setup lang="ts">
// Harmonogram's opening: a very large heading, the laser line under it and the promise in a
// larger sentence; the photograph runs to the edge of the screen with a vertical laser across it.
defineProps<{ block: BlockOf<'hero'>; first?: boolean; factsFollow?: boolean }>()
const { settings, tel } = await useFirm()
</script>

<template>
  <section class="relative overflow-x-clip">
    <div class="wrap grid gap-10 pb-14 pt-10 lg:grid-cols-12 lg:gap-8 lg:pb-0 lg:pt-14">
      <div class="relative z-10 min-w-0 lg:col-span-7 lg:pb-16">
        <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
        <!-- (the heading is set as large as the design's words allow; a longer one steps down) -->
        <component
          :is="first ? 'h1' : 'h2'" class="mt-6 font-extrabold text-text"
          :class="byLength(block.heading, [[18, 'text-[64px] leading-[.9] tracking-[-.045em] sm:text-[96px] xl:text-[128px]'], [32, 'text-[44px] leading-[.95] tracking-[-.04em] sm:text-[64px] xl:text-[84px]']], 'text-[36px] leading-[1] tracking-[-.035em] sm:text-[52px] xl:text-[64px]')"
        ><KitMarked :text="block.heading" as="span" :attrs="{ class: 'whitespace-nowrap text-brand' }" /></component>
        <div class="laser-h mt-8 lg:mt-10" aria-hidden="true" />
        <p v-if="block.lead" class="mt-8 max-w-[21em] text-[24px] font-semibold leading-[1.25] tracking-[-.02em] text-text sm:text-[30px] lg:mt-10">{{ tidyText(block.lead) }}</p>
        <p v-if="block.text" class="max-w-[34em] text-[17px] leading-[1.6] text-quiet" :class="block.lead ? 'mt-5' : 'mt-8 lg:mt-10'">{{ tidyText(block.text) }}</p>
        <div class="mt-9 flex flex-wrap items-center gap-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn btn-brand">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
          <a v-if="tel && settings?.phone" :href="tel" class="btn btn-ghost num"><UIcon name="i-lucide-phone" class="size-4" aria-hidden="true" /> {{ settings.phone }}</a>
        </div>
      </div>
      <figure class="relative -mx-5 min-w-0 md:-mx-10 lg:col-span-5 lg:mx-0 lg:-mr-[max(40px,calc((100vw-1320px)/2+40px))]">
        <div class="relative aspect-[3/2] h-full w-full overflow-hidden bg-surface lg:aspect-auto lg:min-h-[560px]">
          <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1024px) 48vw, 100vw" class="absolute inset-0 h-full w-full object-cover" />
          <span class="laser-v left-[34%]" aria-hidden="true" />
          <span class="absolute left-0 right-0 top-[46%] h-[2px] bg-brand shadow-[0_0_14px_1px_color-mix(in_srgb,var(--brand)_55%,transparent)] lg:hidden" aria-hidden="true" />
        </div>
        <figcaption v-if="block.caption" class="mono absolute bottom-0 left-0 bg-bg px-3 py-2">{{ block.caption }}</figcaption>
      </figure>
    </div>
  </section>
</template>
