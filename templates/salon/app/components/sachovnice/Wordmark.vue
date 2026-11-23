<script setup lang="ts">
// The salon's name in lowercase beside a small checkerboard tile. A logo uploaded in Site
// settings takes the place of the name. `large` is the footer's.
defineProps<{ large?: boolean }>()
const { settings, name } = await useSalon()
</script>

<template>
  <span v-if="large" class="font-display font-extrabold lowercase text-[15vw] lg:text-[168px] leading-[.9] tracking-[-0.04em]">{{ name }}</span>
  <span v-else class="flex items-center gap-3 min-h-11">
    <span class="checker block w-7 h-7 border-2 border-ink" style="--sq:6px" aria-hidden="true" />
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-8 w-auto max-w-[12rem] object-contain" data-wordmark />
    <span v-else class="font-display font-extrabold lowercase text-[22px] leading-none tracking-[-0.03em]" data-wordmark>{{ name }}</span>
  </span>
</template>
