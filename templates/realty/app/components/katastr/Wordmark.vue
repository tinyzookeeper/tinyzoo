<script setup lang="ts">
// The agency's name in the look's type, after a small drawing of a threshold (Práh) and before
// the small word ("reality"). A logo from Site settings takes the place of all of it. `plain`
// is the phone menu's: the name and the word, without the drawing.
defineProps<{ plain?: boolean }>()
const { settings, name } = await useOffice()
// A long name steps down in size and may take two lines.
const size = computed(() => byLength(name.value, [[14, 'text-[1.6rem]'], [24, 'text-[1.35rem]']], 'text-[1.1rem] sm:text-[1.25rem]'))
const tight = computed(() => size.value === 'text-[1.6rem]' ? 'leading-none' : 'leading-[1.1]')
const hasWord = computed(() => settings.value?.descriptor && name.value.length <= 24)
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="12rem" class="h-8 w-auto max-w-[12rem] object-contain" />
  <template v-else-if="plain">
    <span class="serif text-ink min-w-0" :class="[size, tight]">{{ name }}<span v-if="settings?.descriptor" class="label text-quiet ml-2">{{ settings.descriptor }}</span></span>
  </template>
  <template v-else>
    <svg class="w-6 h-6 shrink-0 text-brand self-center" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3.5 21.5V3.5h17v18" /><path d="M1 21.5h22" /><path d="M8.5 21.5v-13h7v13" /></svg>
    <span class="serif text-ink min-w-0 tracking-[-0.01em]" :class="[size, tight]" data-wordmark>{{ name }}</span>
    <span v-if="hasWord" class="label text-quiet">{{ settings?.descriptor }}</span>
  </template>
</template>
