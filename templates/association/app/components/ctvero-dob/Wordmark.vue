<script setup lang="ts">
// The association's mark: a drawn pear and the name in Vollkorn. A logo uploaded in Site
// settings takes the place of both.
const { settings, name } = await useAssociation()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-9 w-auto max-w-[12rem] object-contain" data-wordmark />
  <template v-else>
    <svg viewBox="0 0 24 28" class="h-9 w-[1.9rem] flex-none" aria-hidden="true"><path d="M12 6.5c-2.6 0-3 3-3.5 5.400-.5 2.500-4 4-4 8.500 0 4.300 3.400 6.900 7.500 6.900s7.500-2.600 7.500-6.900c0-4.500-3.500-6-4-8.500-.5-2.400-.9-5.400-3.500-5.400z" fill="currentColor" /><path d="M12 6.500c0-2.200.9-3.900 2.600-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
    <span class="serif text-[1.6rem] font-bold leading-none tracking-[-0.01em]" data-wordmark>{{ name }}</span>
  </template>
</template>
