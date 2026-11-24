<script setup lang="ts">
// The shop's name, in cream letters: written out, or the logo from Site settings in its place.
// (The sizes belong to the link around it.)
const { settings, name } = await useShop()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="20rem" class="h-8 w-auto max-w-full object-contain md:h-14 lg:h-[4.5rem]" />
  <span v-else data-wordmark>{{ name }}</span>
</template>
