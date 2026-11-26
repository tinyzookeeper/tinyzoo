<script setup lang="ts">
// A page's blocks on the website, each drawn by the site's own component, by name:
// a block of type `hero` → <BlockHero :block="…" />, `text` → <BlockText>, and so on
// (components/blocks/Hero.vue gives BlockHero with Nuxt's default naming). A block
// with no component yet is skipped, with a note in development. Only a type spelled
// the way a definition spells it is drawn (not `Hero`, `_hero`, `-hero`), so a stray
// type never lands on the component of a known one.
//
//   <CmsBlocks :blocks="page.sections" />
//   <CmsBlocks :blocks="page.sections" prefix="Section" />   // → <SectionHero>
import { getCurrentInstance, onBeforeUnmount, onMounted, onUpdated, resolveDynamicComponent, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { CmsBlocksProps } from '../../src/frontend'
import { cmsBuilderMarkers, cmsBuilderOn } from '../builder/state'

const props = withDefaults(defineProps<CmsBlocksProps>(), { prefix: 'Block' })
const pascal = (s: string) => s.replace(/(^|[-_])(\w)/g, (_m, _s, c: string) => c.toUpperCase())
function componentFor(type: string) {
  if (!renderableBlockType(type)) return null
  const name = props.prefix + pascal(type)
  const c = resolveDynamicComponent(name)
  if (typeof c === 'string') {
    if (import.meta.dev) console.warn(`[CmsBlocks] no component "${name}" for block type "${type}" (add components/${props.prefix.toLowerCase()}s/${pascal(type)}.vue and make it global)`)
    return null
  }
  return c
}
const items = computed(() => (props.blocks ?? []).map((block, index) => ({ block, index, is: componentFor(block.type) })).filter((x) => x.is))

// The editor in the preview finds a block's element by these attributes. They are written
// only once the preview has switched the tool on, so a visitor's page never carries them.
// A block whose component has no single element at its root (a fragment) is left unmarked.
const listId = String(getCurrentInstance()?.uid)
const instances = new Map<string, Element | ComponentPublicInstance>()
function keep(id: string, instance: Element | ComponentPublicInstance | null) {
  if (instance) instances.set(id, instance)
  else instances.delete(id)
}
function mark() {
  if (!cmsBuilderOn.value) return
  for (const x of items.value) {
    const instance = instances.get(x.block.id)
    const el = instance && '$el' in instance ? instance.$el : instance
    if (el?.nodeType !== 1) continue
    el.setAttribute('data-cms-block', x.block.id)
    el.setAttribute('data-cms-block-type', x.block.type)
    el.setAttribute('data-cms-block-list', listId)
  }
}
onMounted(() => {
  mark()
  cmsBuilderMarkers.add(mark)
})
onBeforeUnmount(() => cmsBuilderMarkers.delete(mark))
onUpdated(mark)
watch(cmsBuilderOn, mark, { flush: 'post' })
</script>

<template>
  <component :is="x.is" v-for="x in items" :key="x.block.id" :ref="(i: any) => keep(x.block.id, i)" :block="x.block" :index="x.index" />
</template>
