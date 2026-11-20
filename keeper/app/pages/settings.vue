<script setup lang="ts">
// An older address (/settings, /settings#about): the settings of the last workspace.
const route = useRoute()
const to = homePath(useMe().value, useLastScope().value)
await navigateTo(to ? `${to}/settings/${route.hash === '#about' ? 'about' : 'general'}` : '/', { replace: true })
</script>

<template>
  <div />
</template>
