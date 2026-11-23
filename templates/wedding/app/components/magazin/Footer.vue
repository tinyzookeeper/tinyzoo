<script setup lang="ts">
// Magazín's footer: dark, the names set large, then when, where and where to write.
const { nav } = await useSite()
const { settings, couple, day, words } = await useWedding()
const legal = computed(() => menuLinks(nav.value?.legal))
const when = computed(() => (day.value ? [`${day.value.weekday} ${day.value.date}`, day.value.time ? words.value.ceremonyAt(day.value.time) : ''].filter(Boolean).join(', ') : ''))
const where = computed(() => [settings.value?.venueName, settings.value?.address].filter(Boolean).join(', '))
</script>

<template>
  <footer class="bg-deep text-white/75">
    <div class="wrap pt-20 lg:pt-28 pb-10">
      <p v-if="settings?.closing" class="label text-white/70">{{ settings.closing.replace(/\.$/, '') }}</p>
      <p class="serif display text-white text-[clamp(3.2rem,11vw,9.5rem)] leading-[1] tracking-[-0.02em] mt-5">
        <template v-if="couple.second">{{ couple.first }} <em>{{ words.and }}</em>&nbsp;{{ couple.second }}</template>
        <template v-else>{{ couple.first }}</template>
      </p>
      <div class="grid sm:grid-cols-3 gap-x-10 gap-y-6 mt-14 lg:mt-20 pt-7 border-t border-white/25">
        <p v-if="when"><span class="label text-white/70 block">{{ words.when }}</span><span class="text-white block mt-1.5">{{ tidyText(when) }}</span></p>
        <p v-if="where"><span class="label text-white/70 block">{{ words.where }}</span><span class="text-white block mt-1.5">{{ tidyText(where) }}</span></p>
        <p v-if="settings?.email"><span class="label text-white/70 block">{{ words.writeUs }}</span><a class="text-white inline-flex items-center min-h-[44px] underline underline-offset-4 decoration-white/40 hover:decoration-white transition-colors duration-500 focus-visible:outline-white break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
      </div>
      <p v-if="legal.length" class="label text-white/70 mt-10">
        <template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="hover:text-white" :to="l.url">{{ l.label }}</NuxtLink></template>
      </p>
    </div>
  </footer>
</template>
