<script setup lang="ts">
import type { TrafficDrop } from '#keeper/types/traffic'

// A drop in visitors, as a calm note on cream: what happened in words, the usual causes, and
// something to do. Someone who can check the site checks it from here; a guest opens the site.
const props = defineProps<{ drop: TrafficDrop; canCheck?: boolean; checking?: boolean; siteUrl?: string }>()
const emit = defineEmits<{ check: [] }>()
const now = useNow()
const fmt = (n: number) => n.toLocaleString('en-GB')
const since = computed(() => dropSince(props.drop.day, now.value))
</script>

<template>
  <div class="k-note flex gap-3 p-3.5 sm:p-4" role="note">
    <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-(--k-moment-line) bg-(--k-surface)" aria-hidden="true">
      <UIcon name="i-lucide-trending-down" class="size-4 text-warning" />
    </span>
    <div class="min-w-0">
      <p class="font-display text-sm font-bold text-highlighted">Fewer visitors than usual since {{ since }}</p>
      <p class="mt-0.5 text-[0.8125rem] text-(--k-moment-text)">
        About {{ fmt(drop.perDay) }} a day, when it’s usually around {{ fmt(drop.baselinePerDay) }}. This often follows an update that broke a page, or counting that got switched off.
      </p>
      <div class="mt-2.5 flex flex-wrap gap-2">
        <UButton v-if="canCheck" label="Check the site now" icon="i-lucide-refresh-cw" size="xs" :loading="checking" @click="emit('check')" />
        <UButton v-else-if="siteUrl" :to="siteUrl" target="_blank" rel="noopener" label="Open the site" trailing-icon="i-lucide-arrow-up-right" size="xs" />
      </div>
    </div>
  </div>
</template>
