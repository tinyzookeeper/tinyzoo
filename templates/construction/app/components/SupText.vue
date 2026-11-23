<script setup lang="ts">
// A text with "m²" written as m and a raised 2, as a drawing letters it (Výkres's dimension
// lines: the condensed face has no good ² of its own).
const props = defineProps<{ text: string | null | undefined }>()
const parts = computed(() => (props.text ?? '').split('m²'))
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">{{ part }}<template v-if="i < parts.length - 1">m<sup>2</sup></template></template>
</template>
