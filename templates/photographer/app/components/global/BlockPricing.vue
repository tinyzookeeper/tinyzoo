<script setup lang="ts">
// Block "pricing": the packages (the Packages collection), with the block's texts around them.
// Drawn by components/<look>/Pricing.vue.
defineProps<{ block: BlockOf<'pricing'>; index?: number }>()
const packs = await usePacks()
</script>

<template>
  <LookPart part="Pricing" :first="index === 0" :block="block" :packs="packs" />
</template>
