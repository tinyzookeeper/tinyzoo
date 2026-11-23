<script setup lang="ts">
// Hřiště's mark: a round badge in the club colour with a slanted stripe, the club's name in bold
// italics and a small line under it. A crest uploaded in Site settings takes the badge's place.
// `crest` is the badge alone (the footer sets its own name beside it).
defineProps<{ crest?: boolean }>()
const { settings, name } = await useSite()
const words = useSiteWords()
const since = computed(() => words.value.sinceInline(settings.value?.sport ?? '', settings.value?.founded ?? null))
</script>

<template>
  <span class="flex min-w-0 items-center gap-3">
    <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="h-11 w-auto max-w-[8rem] flex-none object-contain" />
    <svg v-else viewBox="0 0 44 44" class="h-11 w-11 flex-none" aria-hidden="true">
      <circle cx="22" cy="22" r="22" fill="var(--brand)" />
      <path d="M19 6h11L22 38H11z" fill="var(--brand-ink)" />
    </svg>
    <span v-if="!crest" class="min-w-0 leading-none">
      <span class="disp block" :class="byLength(name, [[20, 'text-[22px]'], [32, 'text-[18px]']], 'text-[15px]')" data-wordmark>{{ name }}</span>
      <span v-if="since" class="mt-1 block text-[13px] text-quiet">{{ since }}</span>
    </span>
  </span>
</template>
