<script setup lang="ts">
// Block "join": who the club takes in, and the form for a trial training (the Trial form of
// cms.config.ts). The applications arrive in the admin. Drawn by components/<look>/Join.vue.
defineProps<{ block: BlockOf<'join'>; index?: number }>()
const [groups, form] = await Promise.all([useAgeGroups(), useSiteForm('trial', DEFAULT_LANGUAGE)])
</script>

<template>
  <LookPart part="Join" :first="index === 0" :block="block" :groups="groups" :form="form" :anchor="anchorOf('join')" />
</template>
