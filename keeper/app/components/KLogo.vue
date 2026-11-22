<script setup lang="ts">
import type { LogoRef } from '#keeper/logo'

// A logo in a rounded square tile, the same in light and dark mode (like an app icon):
// - `fill`: a square icon that covers the tile (a site's home-screen icon, already on white);
// - `pad`: a logo with room around it on a white plate, so a dark logo never disappears on charcoal.
// Without a logo, or when it does not load, the slot stands in (an animal, the initials).
// The tile's size and corner come from the caller's classes (`size-7 rounded-lg`).
// Always beside its name, so the picture itself is decorative.
defineOptions({ inheritAttrs: false })
const props = defineProps<{ logo?: LogoRef | null }>()
const failed = ref(false)
watch(() => props.logo?.src, () => { failed.value = false })
</script>

<template>
  <span
    v-if="logo && !failed"
    v-bind="$attrs"
    class="k-logo inline-flex shrink-0 items-center justify-center overflow-hidden"
  >
    <img
      :src="logo.src" alt="" aria-hidden="true" draggable="false" loading="lazy" decoding="async"
      class="block object-contain" :class="logo.fit === 'fill' ? 'size-full object-cover' : 'size-[72%]'"
      @error="failed = true"
    >
  </span>
  <slot v-else />
</template>

