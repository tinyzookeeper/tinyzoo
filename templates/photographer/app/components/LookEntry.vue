<script setup lang="ts">
// An address that leads to an entry (`ENTRY_PAGES` in app/utils/site.ts): a category of the
// gallery (/galerie/svatby) or one album (/album/anna-a-vojta).
defineProps<{ kind: string; part: string; entry: Record<string, any> }>()
</script>

<template>
  <LookCategory v-if="kind === 'category'" :category="(entry as any)" />
  <LookAlbum v-else :album="(entry as any)" />
</template>
