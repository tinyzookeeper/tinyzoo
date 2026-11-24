<script setup lang="ts">
// The product's mark (a half-filled disc) and its name, written in lower case. A logo uploaded in
// Site settings takes the place of the drawn mark. `footer` is the mark on the dark footer.
defineProps<{ footer?: boolean }>()
const { settings, name } = await useSoftware()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="8rem" class="h-7 w-auto max-w-[8rem] object-contain" />
  <svg v-else viewBox="0 0 20 20" class="h-7 w-7" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="var(--cream)" /><path d="M10 0a10 10 0 0 1 0 20z" :fill="footer ? 'var(--brand)' : 'var(--ink)'" /></svg>
  <span class="font-display text-[28px] font-extrabold lowercase leading-none tracking-[-0.04em]" data-wordmark>{{ name }}</span>
</template>
