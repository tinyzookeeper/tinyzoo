<script setup lang="ts">
// Block "standards": what is in the price, from the Standards section. Drawn by components/<look>/Standards.vue.
defineProps<{ block: BlockOf<'standards'>; index?: number }>()
const standards = await useStandards()
</script>

<template>
  <LookPart part="Standards" :first="index === 0" :index="index" :block="block" :standards="standards" :anchor="anchorOf('standards')" />
</template>
