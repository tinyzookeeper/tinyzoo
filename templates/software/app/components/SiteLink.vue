<script setup lang="ts">
// A link as the website writes it: inside the site a NuxtLink, to another site an <a> that opens
// in a new tab. The destination is what an editor typed: "/#cenik", "/novinky", "https://…".
defineOptions({ inheritAttrs: false })
defineProps<{ to: string | null | undefined }>()
</script>

<template>
  <a v-if="isExternal(to)" v-bind="$attrs" :href="to ?? undefined" target="_blank" rel="noopener"><slot /></a>
  <NuxtLink v-else v-bind="$attrs" :to="siteHref(to)"><slot /></NuxtLink>
</template>
