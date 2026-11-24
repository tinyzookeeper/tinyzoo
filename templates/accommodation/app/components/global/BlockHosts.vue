<script setup lang="ts">
// Block "hosts": who looks after the guests. Drawn by components/<look>/Hosts.vue.
defineProps<{ block: BlockOf<'hosts'>; index?: number }>()
</script>

<template>
  <LookPart part="Hosts" :first="index === 0" :block="block" :anchor="anchorOf('hosts')" />
</template>
