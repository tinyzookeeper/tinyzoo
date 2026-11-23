<script setup lang="ts">
// The garage's sign: a rounded square with a wrench, the short name and, under it, a line in
// small type. A logo uploaded in Site settings takes the square's place.
const { settings, shortName } = await useGarage()
</script>

<template>
  <span class="flex items-center gap-3">
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="shortName" eager sizes="8rem" class="h-11 w-auto max-w-[8rem] object-contain" />
    <span v-else class="grid place-items-center w-11 h-11 rounded-[12px] bg-brand text-brand-ink" aria-hidden="true"><UIcon name="i-lucide-wrench" class="size-[22px]" /></span>
    <span class="leading-none">
      <span class="block font-display font-extrabold text-[23px] tracking-[-0.02em]" data-wordmark>{{ shortName }}</span>
      <span v-if="settings?.tagline" class="block text-[13.5px] text-quiet mt-1">{{ settings.tagline }}</span>
    </span>
  </span>
</template>
