<script setup lang="ts">
// Zdivo's opening: the heading and the way to an enquiry on the left, the photograph on the
// right with its caption on a plaster label; the facts that follow stand under it as bricks.
defineProps<{ block: BlockOf<'hero'>; first?: boolean; factsFollow?: boolean }>()
const { settings, tel } = await useFirm()
</script>

<template>
  <section class="wrap pt-6 lg:pt-10" :class="factsFollow ? '' : 'pb-16 lg:pb-24'">
    <div class="grid gap-8 lg:grid-cols-2 lg:gap-2">
      <div class="min-w-0 lg:flex lg:flex-col lg:justify-center lg:pb-10 lg:pr-14">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component
          :is="first ? 'h1' : 'h2'" class="mt-4 font-display font-extrabold text-ink"
          :class="byLength(block.heading, [[60, 'text-[50px] leading-[.94] tracking-[-.02em] sm:text-[68px] xl:text-[84px]']], 'text-[40px] leading-[.96] tracking-[-.015em] sm:text-[52px] xl:text-[64px]')"
        ><KitMarked :text="block.heading" as="span" /></component>
        <p v-if="block.lead" class="mt-6 max-w-[31em] text-[18px] leading-[1.55] text-ink">{{ tidyText(block.lead) }}</p>
        <p v-if="block.text" class="max-w-[31em] text-[18px] leading-[1.55]" :class="block.lead ? 'mt-3' : 'mt-6'">{{ tidyText(block.text) }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn btn-brand">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
          <a v-if="tel && settings?.phone" :href="tel" class="btn btn-line"><UIcon name="i-lucide-phone" class="size-[17px]" aria-hidden="true" />{{ settings.phone }}</a>
        </div>
      </div>
      <figure class="relative min-w-0">
        <div class="relative aspect-[4/3] overflow-hidden rounded-[4px] bg-brand-3 lg:aspect-auto lg:h-full lg:min-h-[480px]">
          <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1280px) 40rem, (min-width: 1024px) 48vw, 100vw" class="absolute inset-0 h-full w-full object-cover" />
        </div>
        <figcaption v-if="block.caption" class="absolute bottom-3 left-3 rounded-[3px] bg-card px-3 py-1.5 text-[14px] font-semibold text-ink">{{ block.caption }}</figcaption>
      </figure>
    </div>
  </section>
</template>
