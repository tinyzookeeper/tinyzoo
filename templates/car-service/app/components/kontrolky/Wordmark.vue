<script setup lang="ts">
// The garage's sign: a small gauge, the short name and, under it, a line in small type. A logo
// uploaded in Site settings takes the gauge's place.
const { settings, shortName } = await useGarage()
// (a longer name steps down, and wraps rather than push the menu or the buttons off the screen)
const size = computed(() => byLength(shortName.value, [[14, 'text-[23px]'], [24, 'text-[20px]']], 'text-[17px]'))
</script>

<template>
  <span class="flex items-center gap-3 min-w-0">
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="shortName" eager sizes="8rem" class="h-10 w-auto max-w-[8rem] object-contain" />
    <svg v-else viewBox="0 0 40 40" class="w-10 h-10 text-brand" aria-hidden="true"><path d="M7.5 29A15 15 0 1 1 32.5 29" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /><path d="M20 21 L28 11" stroke="#fff" stroke-width="3" stroke-linecap="round" /><circle cx="20" cy="21" r="3" fill="#fff" /></svg>
    <span class="leading-none min-w-0">
      <span class="block font-display font-bold " :class="size" data-wordmark>{{ shortName }}</span>
      <span v-if="settings?.tagline" class="block text-[13px] text-quiet mt-1">{{ settings.tagline }}</span>
    </span>
  </span>
</template>
