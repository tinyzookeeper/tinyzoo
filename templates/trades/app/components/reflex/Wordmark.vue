<script setup lang="ts">
// The business's name in heavy type, with what it does beside it in condensed capitals (the
// header's; its separators are slashes). A logo uploaded in Site settings takes the place of both.
const { settings, name, long } = await useTrades()
// A longer name steps down so that it fits on two lines beside the menu's button.
const size = computed(() => byLength(name.value, [[20, 'text-[1.75rem] md:text-[2rem]'], [32, 'text-[1.4rem] md:text-[1.6rem]']], 'text-[1.15rem] md:text-[1.4rem]'))
const trade = computed(() => (settings.value?.trade ?? '').replaceAll(' · ', ' / '))
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="w-auto max-w-[12rem] h-[40px] object-contain object-left" />
  <span v-else class="flex items-center gap-3 min-w-0">
    <span data-wordmark class="font-black tracking-[-0.045em] leading-[1.05]" :class="size">{{ name }}</span>
    <span v-if="trade && !long" class="hidden sm:inline label !text-[0.9375rem] leading-none pt-1">{{ trade }}</span>
  </span>
</template>
