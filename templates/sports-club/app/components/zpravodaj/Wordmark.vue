<script setup lang="ts">
// Zpravodaj's mark: a shield in the club colour with a stripe in its second colour, the club's
// name in the headline face and a small line under it. A crest uploaded in Site settings takes
// the shield's place.
defineProps<{ tagline?: boolean }>()
const { settings, name } = await useSite()
const words = useSiteWords()
const since = computed(() => words.value.sinceBulletin(settings.value?.sport ?? '', settings.value?.founded ?? null))
</script>

<template>
  <span class="flex min-w-0 items-center gap-3.5">
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="h-11 w-auto max-w-[8rem] shrink-0 object-contain" />
    <svg v-else viewBox="0 0 30 36" class="h-11 w-auto shrink-0" aria-hidden="true">
      <defs><clipPath id="crest-shield"><path d="M1 1h28v18c0 8.5-6 13.5-14 16C7 32.500 1 27.500 1 19z" /></clipPath></defs>
      <g clip-path="url(#crest-shield)"><rect width="30" height="36" fill="var(--brand)" /><rect x="11" width="8" height="36" fill="var(--second)" /></g>
      <path d="M1 1h28v18c0 8.5-6 13.5-14 16C7 32.500 1 27.500 1 19z" fill="none" stroke="var(--brand)" stroke-width="2" />
    </svg>
    <span class="min-w-0">
      <span class="block font-display font-extrabold leading-none tracking-tight text-ink" :class="byLength(name, [[20, 'text-[23px]'], [32, 'text-[18px]']], 'text-[15px]')" data-wordmark>{{ name }}</span>
      <span v-if="tagline && since" class="mt-1.5 block text-[11px] font-semibold uppercase leading-none tracking-[.16em] text-quiet">{{ since }}</span>
    </span>
  </span>
</template>
