<script setup lang="ts">
// Šanony's name: one heavy word, the "&" between two names in the brand colour. A logo from Site
// settings takes the place of the name. `large` is the footer's.
defineProps<{ large?: boolean }>()
const { settings, name, partners } = await useOffice()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-[34px] w-auto max-w-48 object-contain" data-wordmark />
  <span v-else data-wordmark>{{ partners[0] }}<template v-if="partners[1]"><span class="text-brand">&amp;</span>{{ partners[1] }}</template></span>
</template>
