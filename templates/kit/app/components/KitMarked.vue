<script setup lang="ts">
// A text with its *marked* part drawn the look's way:
//
//   <KitMarked :text="block.heading" />                    // the marked part in <em>
//   <KitMarked :text="block.heading" plain />              // no marking at all
//   <KitMarked :text="words.consent" as="a" :attrs="{ href: '/ochrana-udaju', class: 'underline' }" />
const props = withDefaults(defineProps<{ text?: string | null; as?: string; attrs?: Record<string, unknown>; plain?: boolean }>(), { as: 'em' })
const parts = computed(() => emphasisParts(props.text).map((p) => ({ ...p, text: tidyText(p.text) })))
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <component :is="as" v-if="part.marked && !plain" v-bind="attrs">{{ part.text }}</component>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
