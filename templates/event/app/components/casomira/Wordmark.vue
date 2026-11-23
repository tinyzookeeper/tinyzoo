<script setup lang="ts">
// The name of the event: a lit diode and the name in heavy type. A logo uploaded in Site
// settings takes the name's place. `large` is the footer's.
defineProps<{ large?: boolean }>()
const { settings, name } = await useEvent()
</script>

<template>
  <span class="flex items-center gap-2.5">
    <span class="w-2.5 h-2.5 rounded-full bg-led" aria-hidden="true" />
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="large ? 'h-9' : 'h-7'" data-wordmark />
    <span v-else class="font-black tracking-[-0.03em] leading-none" :class="large ? 'text-2xl' : 'text-[1.35rem]'" data-wordmark>{{ name }}</span>
  </span>
</template>
