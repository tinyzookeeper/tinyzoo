<script setup lang="ts">
// The name of a dish in a heading, with the mark of a meatless one ("V", "bez masa") glued to
// the last word so the mark never stands alone on a line. Each look draws the mark its own way
// (`markClass`) and says what it stands for (`markTitle`).
defineProps<{ name: string; vegetarian?: boolean | null; markClass: string; markText: string; markTitle?: string }>()
const split = (name: string): [string, string] => {
  const text = tidyText(name).trim()
  const at = text.search(/\S+$/)
  return [text.slice(0, at), text.slice(at)]
}
</script>

<template>
  <template v-if="vegetarian">{{ split(name)[0] }}<span class="whitespace-nowrap">{{ split(name)[1] }} <span :class="markClass" :title="markTitle">{{ markText }}</span></span></template>
  <template v-else>{{ tidyText(name) }}</template>
</template>
