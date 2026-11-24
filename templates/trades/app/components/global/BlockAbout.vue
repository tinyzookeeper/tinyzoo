<script setup lang="ts">
// Block "about": who comes to the customer. Reflex sets the owner's photograph large; it takes
// the block's own or, without one, the page's opening. Drawn by components/<look>/About.vue.
const props = defineProps<{ block: BlockOf<'about'>; index?: number }>()
const sections = await usePageSections()
const owner = computed(() => ownerPhoto(props.block, sections.value))
</script>

<template>
  <LookPart part="About" :first="index === 0" :block="block" :owner="owner" :anchor="anchorOf('about')" />
</template>
