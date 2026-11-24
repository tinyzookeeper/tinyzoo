<script setup lang="ts">
// Večer's footer: set over the evening landscape, the monogram, the names in a light italic,
// the day and the place, a closing line and the e-mail.
const { nav } = await useSite()
const { settings, couple, day } = await useWedding()
const legal = computed(() => menuLinks(nav.value?.legal))
const place = computed(() => [settings.value?.venueName, beforeComma(settings.value?.venueArea)].filter(Boolean).join(', '))
</script>

<template>
  <footer class="relative isolate overflow-hidden">
    <CmsImage v-if="settings?.footerImage" :media="settings.footerImage" sizes="(min-width: 640px) 100vw, 220vw" class="absolute inset-0 -z-20 w-full h-full object-cover" />
    <div class="foot-scrim absolute inset-0 -z-10" aria-hidden="true" />
    <div class="wrap pb-16 lg:pb-24 text-center" :class="settings?.footerImage ? 'pt-28 lg:pt-44' : 'pt-16 lg:pt-24 border-t border-line'">
      <span aria-hidden="true"><VecerWordmark large /></span>
      <p class="italic font-light text-ink text-[2.6rem] lg:text-[4rem] leading-none tracking-[-0.02em] mt-8">
        <template v-if="couple.second">{{ couple.first }} <span class="text-brand">&amp;</span> {{ couple.second }}</template>
        <template v-else>{{ couple.first }}</template>
      </p>
      <p v-if="day || place" class="label text-ink mt-6 max-sm:leading-[2]">
        <span v-if="day" class="max-sm:block">{{ day.date }}</span> <span v-if="day && place" class="text-brand mx-1 max-sm:hidden" aria-hidden="true">·</span> <span v-if="place" class="max-sm:block">{{ place }}</span>
      </p>
      <p v-if="settings?.closing" class="italic text-ink text-[1.35rem] mt-7">{{ tidyText(settings.closing) }}</p>
      <p v-if="settings?.email" class="mt-1"><a class="tlink break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
      <p v-if="legal.length" class="label text-quiet mt-9">
        <template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="hover:text-ink" :to="l.url">{{ l.label }}</NuxtLink></template>
      </p>
    </div>
  </footer>
</template>
