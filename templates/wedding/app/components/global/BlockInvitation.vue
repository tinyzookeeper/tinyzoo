<script setup lang="ts">
// Block "invitation" (cms.config.ts), drawn by the site's look: components/<look>/Invitation.vue.
defineProps<{ block: BlockOf<'invitation'>; index?: number }>()
</script>

<template>
  <LookPart part="Invitation" :first="index === 0" :block="block" :anchor="anchorOf('invitation')" />
</template>
