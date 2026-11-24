<script setup lang="ts">
// The agency's name after a small window in the lamp colour, and the small word after it. A
// logo from Site settings takes the place of all of it. `plain` is the phone menu's: the name alone.
defineProps<{ plain?: boolean }>()
const { settings, name } = await useOffice()
// A long name steps down in size and may take two lines.
const size = computed(() => byLength(name.value, [[14, 'text-[1.7rem]'], [24, 'text-[1.4rem]']], 'text-[1.05rem] sm:text-[1.15rem]'))
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-9 w-auto max-w-[12rem] object-contain" />
  <template v-else-if="plain">
    <span class="serif min-w-0 font-bold leading-[1.05]" :class="size">{{ name }}</span>
  </template>
  <template v-else>
    <svg class="w-8 h-9 shrink-0" viewBox="0 0 32 36" aria-hidden="true"><path d="M2 14C2 6.5 8 2 16 2s14 4.5 14 12v20H2z" fill="var(--accent)" /><path d="M16 2v32M2 19h28" stroke="var(--bg)" stroke-width="2.4" /></svg>
    <span class="serif min-w-0 font-bold tracking-[-0.02em]" :class="[size, size === 'text-[1.7rem]' ? 'leading-none' : 'leading-[1.05]']" data-wordmark>{{ name }}</span>
    <span v-if="settings?.descriptor && name.length <= 24" class="text-quiet text-[0.9rem] mt-1.5">{{ settings.descriptor }}</span>
  </template>
</template>
