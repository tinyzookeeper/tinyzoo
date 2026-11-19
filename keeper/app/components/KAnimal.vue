<script setup lang="ts">
// One of tinyzoo's animals: by name (`name="elephant"`) or picked for a seed (`seed="<site id>"`).
// Decorative, sized by its class like an <img> (`h-20 w-auto`).
const props = defineProps<{ name?: string; seed?: string }>()
const pick = computed(() => (props.seed ? animalFor(props.seed) : animal(props.name ?? 'elephant')))
</script>

<template>
  <img :src="pick.url" alt="" aria-hidden="true" draggable="false" class="select-none" :data-animal="pick.name">
</template>
