<script setup lang="ts">
// The garage's sign: a lacquered hexagon, the short name in bold italic and, under it, a line in
// small type. A logo uploaded in Site settings takes the hexagon's place.
const { settings, shortName } = await useGarage()
// (a longer name steps down, and wraps rather than push the menu or the buttons off the screen)
const size = computed(() => byLength(shortName.value, [[14, 'text-[27px]'], [24, 'text-[22px]']], 'text-[18px]'))
</script>

<template>
  <span class="flex items-center gap-3 min-w-0">
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="shortName" eager sizes="8rem" class="h-11 w-auto max-w-[8rem] object-contain" />
    <svg v-else viewBox="0 0 44 44" class="w-11 h-11" aria-hidden="true"><path d="M22 2.500 38.900 12.250v19.500L22 41.500 5.100 31.750v-19.500z" fill="var(--brand)" /><circle cx="22" cy="22" r="8.500" fill="var(--paper)" /></svg>
    <span class="leading-none min-w-0">
      <span class="block font-display italic font-extrabold " :class="size" data-wordmark>{{ shortName }}</span>
      <span v-if="settings?.tagline" class="block text-[13px] font-medium text-quiet mt-0.5">{{ settings.tagline }}</span>
    </span>
  </span>
</template>
