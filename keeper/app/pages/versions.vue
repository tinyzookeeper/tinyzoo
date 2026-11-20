<script setup lang="ts">
// An older address: the Versions page of the last workspace.
const to = homePath(useMe().value, useLastScope().value)
await navigateTo(to ? `${to}/versions` : '/', { replace: true })
</script>

<template>
  <div />
</template>
