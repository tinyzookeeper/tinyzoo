<script setup lang="ts">
// The name of the guesthouse in Rethink Sans, tightly set. A logo uploaded in Site settings
// takes its place. `large` is the footer's.
defineProps<{ large?: boolean }>()
const { settings, name } = await useStay()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="large ? 'h-[44px]' : 'h-[34px]'" />
  <span v-else class="font-semibold tracking-[-0.03em] leading-none text-ink" :class="large ? 'text-[1.7rem]' : 'text-[1.55rem]'" data-wordmark>{{ name }}</span>
</template>
