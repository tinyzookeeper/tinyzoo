<script setup lang="ts">
// The shop's name beside its sign (two crossed keys, or the logo from Site settings in its place).
const { settings, name } = await useShop()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="6rem" class="size-8 object-contain" />
  <NaHackuKeys v-else class="size-8 text-brand" />
  <span class="disp text-[1.4rem] font-extrabold leading-none tracking-[-0.02em] md:text-[1.55rem]" data-wordmark>{{ name }}</span>
</template>
