<script setup lang="ts">
// Block "notices": the notices that are valid today. Without any, the look draws nothing.
// Drawn by components/<look>/Notices.vue.
defineProps<{ block: BlockOf<'notices'>; index?: number }>()
const { valid } = await useValidNotices()
</script>

<template>
  <LookPart part="Notices" :first="index === 0" :block="block" :notices="valid" :anchor="anchorOf('notices')" />
</template>
