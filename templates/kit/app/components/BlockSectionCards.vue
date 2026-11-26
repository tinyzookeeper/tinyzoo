<script setup lang="ts">
// Block "section_cards" (kitSections()): cards side by side, each with a picture, a title, a text
// and a link, drawn by the kit for every look (KitEntries, as the entries of a site's own types
// are). Nothing at all when the section has nothing in it.
const props = defineProps<{ block: Record<string, any>; index?: number }>()
const plan = computed(() => cardsPlan(props.block))
const look = computed(() => sectionLook(props.block))
const cards = computed(() => (plan.value?.cards ?? []).map((c) => ({ ...c, href: c.href ? siteHref(c.href) : null })))
</script>

<template>
  <KitEntries v-if="plan" :id="String(block.id ?? index ?? '')" anchor="section" :heading="plan.heading" :text="plan.text" layout="cards" :columns="plan.columns" :picture="plan.picture" :cards="cards" full-text :narrow="look.narrow" :close="look.close" />
</template>
