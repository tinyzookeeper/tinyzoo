<script setup lang="ts">
// The little compass of a flat: a circle with the sun on the side the flat faces. Drawn from the
// flat's orientation.
import type { Flat } from '~/lib/cms-content'

defineProps<{ orientation: Flat['orientation'] }>()
</script>

<template>
  <span class="cmp" :style="{ '--sx': COMPASS_SPOT[orientation].left, '--sy': COMPASS_SPOT[orientation].top }" aria-hidden="true" />
</template>
