<script setup lang="ts">
// The shop's name in heavy letters, beside the logo from Site settings when there is one.
const { settings, name } = await useShop()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="mr-3 inline-block h-9 w-auto max-w-[10rem] object-contain align-middle md:h-10" />
  <span data-wordmark>{{ name }}</span>
</template>
