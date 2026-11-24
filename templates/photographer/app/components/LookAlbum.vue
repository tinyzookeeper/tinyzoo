<script setup lang="ts">
// One album's page (/album/anna-a-vojta).
import type { Album } from '../lib/cms-content'

defineProps<{ album: Album }>()
</script>

<template>
  <LookPart part="Album" :album="album" />
</template>
