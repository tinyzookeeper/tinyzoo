<script setup lang="ts">
// The salon's name in lowercase beside a small checkerboard tile. A logo uploaded in Site
// settings takes the place of the name. `large` is the footer's.
defineProps<{ large?: boolean }>()
const { settings, name } = await useSalon()
</script>

<template>
  <span v-if="large" class="font-display font-extrabold lowercase leading-[.9] tracking-[-0.04em]" :class="byLength(name, [[12, 'text-[15vw] lg:text-[168px]']], 'text-[8vw] lg:text-[72px]')">{{ name }}</span>
  <span v-else class="flex min-w-0 items-center gap-3 min-h-11">
    <span class="checker block w-7 h-7 border-2 border-ink" style="--sq:6px" aria-hidden="true" />
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-8 w-auto max-w-[12rem] object-contain" data-wordmark />
    <span v-else class="font-display font-extrabold lowercase leading-none tracking-[-0.03em]" :class="byLength(name, [[14, 'text-[22px]']], 'text-[15px] sm:text-[18px]')" data-wordmark>{{ name }}</span>
  </span>
</template>
