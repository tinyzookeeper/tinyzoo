<script setup lang="ts">
// An older address: Versions across every workspace, or of the only one.
const me = useMe().value
const to = hasEverywhere(me) ? '/home' : scopePath(me, useLastScope().value)
await navigateTo(to ? `${to}/versions` : '/', { replace: true })
</script>

<template>
  <div />
</template>
