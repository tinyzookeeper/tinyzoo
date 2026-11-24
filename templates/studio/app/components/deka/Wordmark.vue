<script setup lang="ts">
// The studio's name with a small mark of five threads in front of it, the colours of the first
// kinds of classes. A logo uploaded in Site settings takes the place of both. `large` is the
// footer's, `plain` leaves the mark out (the phone menu).
defineProps<{ large?: boolean; plain?: boolean }>()
const { settings, name } = await useStudio()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] object-contain" :class="large ? 'h-12' : 'h-9'" data-wordmark />
  <template v-else>
    <span v-if="!plain" class="mark" :class="large ? 'text-[2rem]' : 'text-[1.7rem]'" aria-hidden="true"><i class="bg-k3" /><i class="bg-k1" /><i class="bg-ink" /><i class="bg-k2" /><i class="bg-k5" /></span>
    <span class="font-display font-bold leading-none tracking-[-0.02em]" :class="large ? 'text-[2rem]' : 'text-[1.6rem]'" data-wordmark>{{ name }}</span>
  </template>
</template>
