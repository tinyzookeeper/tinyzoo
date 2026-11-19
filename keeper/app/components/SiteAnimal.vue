<script setup lang="ts">
import type { SiteState } from '#shared/types/keeper'

// A site's own animal on a cream tile, with its state as a dot in the corner.
withDefaults(defineProps<{ id: string; state?: SiteState; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
</script>

<template>
  <span class="relative inline-flex">
    <span
      class="k-tile"
      :class="{ 'size-9': size === 'sm', 'size-11': size === 'md', 'size-16': size === 'lg' }"
    >
      <KAnimal :seed="id" :class="{ 'h-5': size === 'sm', 'h-6': size === 'md', 'h-9': size === 'lg' }" class="w-auto" />
    </span>
    <StateDot
      v-if="state"
      :state="state"
      size="sm"
      class="absolute -right-0.5 -bottom-0.5 ring-2 ring-(--k-surface) rounded-full"
    />
  </span>
</template>
