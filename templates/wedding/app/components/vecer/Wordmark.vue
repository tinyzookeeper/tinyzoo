<script setup lang="ts">
// The couple's monogram: the two initials in a champagne ring. A monogram uploaded in Site
// settings takes its place. `large` is the footer's.
defineProps<{ large?: boolean }>()
const { settings, name, couple } = await useWedding()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="w-auto max-w-[8rem] object-contain" :class="large ? 'h-[58px]' : 'h-[46px]'" />
  <span v-else class="monogram" :class="large ? 'w-[58px] h-[58px] text-[1.3rem]' : 'w-[46px] h-[46px] text-[1.05rem]'" data-monogram>{{ couple.initials.join('') }}</span>
</template>
