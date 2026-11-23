<script setup lang="ts">
// The firm's mark and its name: seven bricks in a running bond (a logo uploaded in Site settings
// takes their place) and the name in the blocky slab.
const { settings, name } = await useFirm()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" alt="" eager sizes="8rem" class="h-[26px] shrink-0 w-auto max-w-[8rem] object-contain" />
  <svg v-else viewBox="0 0 34 26" class="h-[26px] w-[34px] shrink-0" aria-hidden="true"><g fill="var(--brand)"><rect x="0" y="0" width="16" height="7" rx="1" /><rect x="18" y="0" width="16" height="7" rx="1" /><rect x="0" y="9.5" width="7" height="7" rx="1" /><rect x="9" y="9.5" width="16" height="7" rx="1" /><rect x="27" y="9.5" width="7" height="7" rx="1" /><rect x="0" y="19" width="16" height="7" rx="1" /><rect x="18" y="19" width="16" height="7" rx="1" /></g></svg>
  <span class="min-w-0 font-display font-extrabold tracking-[-.01em]" :class="byLength(name, [[18, 'text-[27px] leading-none'], [32, 'text-[19px] leading-[1.05]']], 'text-[16px] leading-[1.05]')" data-wordmark>{{ name }}</span>
</template>
