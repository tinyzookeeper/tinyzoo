<script setup lang="ts">
// Block "opening": the heading, the photograph of the house and the short form that starts an
// enquiry. Drawn by components/<look>/Opening.vue.
defineProps<{ block: BlockOf<'opening'>; index?: number }>()
</script>

<template>
  <LookPart part="Opening" :first="index === 0" :block="block" :anchor="anchorOf('opening')" />
</template>
