<script setup lang="ts">
// Výkres's opening: the heading and the way to an enquiry on the left, the photograph on the
// right with its caption set as a dimension line under it and, beside it, an upright one.
defineProps<{ block: BlockOf<'hero'>; first?: boolean; factsFollow?: boolean }>()
const { settings, words, tel } = await useFirm()
</script>

<template>
  <section class="wrap pb-14 pt-10 md:pt-16 lg:pb-20">
    <div class="grid gap-10 lg:grid-cols-12 lg:gap-8">
      <div class="min-w-0 lg:col-span-5 lg:pr-4">
        <p v-if="block.eyebrow" class="lab">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-6 font-display text-[38px] font-light leading-[1.08] tracking-[-.025em] text-ink sm:text-[50px] xl:text-[58px]"><KitMarked :text="block.heading" as="span" /></component>
        <p v-if="block.lead" class="mt-7 max-w-[30em] text-[17px] leading-[1.65] text-ink">{{ tidyText(block.lead) }}</p>
        <p v-if="block.text" class="max-w-[30em] text-[17px] leading-[1.65]" :class="block.lead ? 'mt-4' : 'mt-7'">{{ tidyText(block.text) }}</p>
        <div class="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="siteHref(block.primaryUrl)" class="btn btn-ink">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
          <p v-if="tel && settings?.phone" class="text-[15px] leading-snug">{{ words.orCall }} <a :href="tel" class="font-medium text-ink underline decoration-1 underline-offset-4 hover:text-brand">{{ settings.phone }}</a><template v-if="settings.hoursShort"><br><span class="text-quiet">{{ settings.hoursShort }}</span></template></p>
        </div>
      </div>
      <figure class="min-w-0 lg:col-span-7">
        <div class="flex gap-3">
          <div class="min-w-0 flex-1">
            <div class="aspect-[3/2] overflow-hidden bg-tint"><CmsImage v-if="block.image" :media="block.image" eager sizes="(min-width: 1280px) 46rem, (min-width: 1024px) 55vw, 100vw" class="h-full w-full object-cover" /></div>
          </div>
          <div v-if="block.note" class="kota-v" aria-hidden="true"><span>{{ block.note }}</span></div>
        </div>
        <figcaption v-if="block.caption" class="mt-3" :class="block.note ? 'mr-[42px]' : ''"><div class="kota"><span><span :class="block.captionShort ? 'hidden sm:inline' : ''"><SupText :text="block.caption" /></span><span v-if="block.captionShort" class="sm:hidden"><SupText :text="block.captionShort" /></span></span></div></figcaption>
      </figure>
    </div>
  </section>
</template>
