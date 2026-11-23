<script setup lang="ts">
// The practice's mark (a clock) and name. A logo uploaded in Site settings takes the place of the drawn mark.
const { settings, name } = await useMedical()
</script>

<template>
  <CmsImage v-if="settings?.logo" :media="settings.logo" :alt="name" eager sizes="10rem" class="h-[38px] w-auto max-w-[10rem] object-contain shrink-0" />
  <svg v-else class="shrink-0" width="38" height="38" viewBox="0 0 38 38" aria-hidden="true"><circle cx="19" cy="19" r="19" fill="var(--brand)" /><circle cx="19" cy="19" r="12.5" fill="none" stroke="var(--brand-ink)" stroke-width="2.4" /><path d="M19 12.5V19l4.6 3" fill="none" stroke="var(--brand-ink)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
  <span class="disp text-[1.3rem] font-medium leading-none min-w-0" :class="name.length > 26 ? 'max-sm:text-[1.05rem] max-sm:leading-tight' : ''" data-wordmark>{{ tidyText(name) }}</span>
</template>
