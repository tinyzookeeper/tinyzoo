<script setup lang="ts">
// An address that leads to an entry (`ENTRY_PAGES` in app/utils/site.ts): the page of one flat
// (/byt/3-02), drawn by the look's own part. It writes the page's title as "Byt 3.02 · Name".
const props = defineProps<{ kind: string; part: string; entry: Record<string, any> }>()
const { name } = await useSite()
const words = useSiteWords()
useHead({ title: () => `${words.value.flat} ${props.entry.number} · ${name.value}` })
</script>

<template>
  <LookPart :part="part" :entry="entry" />
</template>
