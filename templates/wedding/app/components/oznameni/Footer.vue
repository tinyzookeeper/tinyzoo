<script setup lang="ts">
// Oznámení's footer: the names once more, the day and the place, a closing line, the e-mail.
const { nav } = await useSite()
const { settings, couple, day, words } = await useWedding()
const legal = computed(() => menuLinks(nav.value?.legal))
const line = computed(() => [day.value?.date, [settings.value?.venueName, beforeComma(settings.value?.venueArea)].filter(Boolean).join(', ')].filter(Boolean).join(' · '))
</script>

<template>
  <footer class="border-t border-line">
    <div class="wrap py-14 text-center">
      <p class="font-display text-ink text-[2.4rem] leading-none">
        <template v-if="couple.second">{{ couple.first }} <span class="amp text-[0.85em]">&amp;</span> {{ couple.second }}</template>
        <template v-else>{{ couple.first }}</template>
      </p>
      <p v-if="line" class="label text-quiet mt-5">{{ line }}</p>
      <p v-if="settings?.closing" class="italic mt-5">{{ tidyText(settings.closing) }}</p>
      <p v-if="settings?.email" class="mt-2"><a class="tlink break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></p>
      <p v-if="legal.length" class="label text-quiet mt-8">
        <template v-for="(l, i) in legal" :key="l.id"><template v-if="i"> · </template><NuxtLink class="hover:text-ink" :to="l.url">{{ l.label }}</NuxtLink></template>
      </p>
      <span class="sr-only">{{ words.contact }}</span>
    </div>
  </footer>
</template>
