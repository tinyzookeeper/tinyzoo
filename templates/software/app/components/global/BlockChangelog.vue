<script setup lang="ts">
// Block "changelog": the newest releases (as many as the block says; 0 is all of them), drawn by
// components/<look>/Changelog.vue.
const props = defineProps<{ block: BlockOf<'changelog'>; index?: number }>()
const all = await useReleases()
const items = computed(() => (props.block.count ? all.value.slice(0, props.block.count) : all.value))
</script>

<template>
  <LookPart part="Changelog" :first="index === 0" :block="block" :items="items" :anchor="anchorOf('changelog')" />
</template>
