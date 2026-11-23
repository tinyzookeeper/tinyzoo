<script setup lang="ts">
// The salon's name in the display face. A logo uploaded in Site settings takes its place.
// `large` is the footer's.
defineProps<{ large?: boolean }>()
const { settings, name } = await useSalon()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="large ? 'h-16 md:h-20' : 'h-9'" :data-wordmark="large ? undefined : ''" />
  <span v-else class="font-display leading-none" :class="large ? 'text-[56px] md:text-[72px]' : 'text-[28px] text-ink'" :data-wordmark="large ? undefined : ''">{{ name }}</span>
</template>
