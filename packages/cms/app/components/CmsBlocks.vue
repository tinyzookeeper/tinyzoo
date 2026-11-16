<script setup lang="ts">
// A page's blocks on the website, each drawn by the site's own component, by name:
// a block of type `hero` → <BlockHero :block="…" />, `text` → <BlockText>, and so on
// (components/blocks/Hero.vue gives BlockHero with Nuxt's default naming). A block
// with no component yet is skipped, with a note in development.
//
//   <CmsBlocks :blocks="page.sections" />
//   <CmsBlocks :blocks="page.sections" prefix="Section" />   // → <SectionHero>
import { resolveDynamicComponent } from 'vue'

const props = withDefaults(defineProps<{ blocks: { id: string; type: string; [k: string]: unknown }[] | null | undefined; prefix?: string }>(), { prefix: 'Block' })
const pascal = (s: string) => s.replace(/(^|[-_])(\w)/g, (_m, _s, c: string) => c.toUpperCase())
function componentFor(type: string) {
  const name = props.prefix + pascal(type)
  const c = resolveDynamicComponent(name)
  if (typeof c === 'string') {
    if (import.meta.dev) console.warn(`[CmsBlocks] no component "${name}" for block type "${type}" (add components/${props.prefix.toLowerCase()}s/${pascal(type)}.vue and make it global)`)
    return null
  }
  return c
}
const items = computed(() => (props.blocks ?? []).map((block, index) => ({ block, index, is: componentFor(block.type) })).filter((x) => x.is))
</script>

<template>
  <component :is="x.is" v-for="x in items" :key="x.block.id" :block="x.block" :index="x.index" />
</template>
