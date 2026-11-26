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
import { Fragment, getCurrentInstance, onBeforeUnmount, onMounted, onUpdated, resolveDynamicComponent, shallowRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { CmsBlocksProps } from '../../src/frontend'
import { cmsBuilderMarkers, cmsBuilderOn, cmsBuilderWords } from '../builder/state'

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
// A block whose component has several elements at its root (a fragment) has each of them
// marked, and the tool draws around them together. One that draws no element at all (a list of a
// site's entries with nothing to show) gets a calm placeholder with its name while the tool is on, so
// it can be selected, moved and deleted; a visitor never sees it.
const listId = String(getCurrentInstance()?.uid)
const instances = new Map<string, Element | ComponentPublicInstance>()
function keep(id: string, instance: Element | ComponentPublicInstance | null) {
  if (instance) instances.set(id, instance)
  else instances.delete(id)
}
/** The elements a block's component draws at its root: its one element, or those of its fragment. */
function rootElements(instance: Element | ComponentPublicInstance | undefined): Element[] {
  if (!instance) return []
  if (!('$el' in instance)) return instance.nodeType === 1 ? [instance] : []
  const el = instance.$el as Node | null
  if (el?.nodeType === 1) return [el as Element]
  // A fragment: Vue keeps the nodes between its start and its end anchor.
  const tree = (instance.$ as { subTree?: { type: unknown; el: Node | null; anchor: Node | null } }).subTree
  if (!tree || tree.type !== Fragment || !tree.el || !tree.anchor) return []
  const out: Element[] = []
  for (let n = tree.el.nextSibling; n && n !== tree.anchor; n = n.nextSibling) if (n.nodeType === 1) out.push(n as Element)
  return out
}
/** The blocks that draw nothing, while the tool is on. */
const blank = shallowRef<ReadonlySet<string>>(new Set())
function mark() {
  if (!cmsBuilderOn.value) return
  const none = new Set<string>()
  for (const x of items.value) {
    const els = rootElements(instances.get(x.block.id))
    if (!els.length && instances.has(x.block.id)) none.add(x.block.id)
    for (const el of els) {
      el.setAttribute('data-cms-block', x.block.id)
      el.setAttribute('data-cms-block-type', x.block.type)
      el.setAttribute('data-cms-block-list', listId)
    }
  }
  if (none.size !== blank.value.size || [...none].some((id) => !blank.value.has(id))) blank.value = none
}
const BLANK = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.2rem;box-sizing:border-box;min-height:5rem;width:min(100% - 2rem, 72rem);margin:1.5rem auto;padding:1rem;border:1.5px dashed color-mix(in srgb, currentColor 26%, transparent);border-radius:10px;text-align:center;font:500 0.875rem/1.4 system-ui,sans-serif;color:inherit'
onMounted(() => {
  mark()
  cmsBuilderMarkers.add(mark)
})
onBeforeUnmount(() => cmsBuilderMarkers.delete(mark))
onUpdated(mark)
watch(cmsBuilderOn, mark, { flush: 'post' })
</script>

<template>
  <template v-for="x in items" :key="x.block.id">
    <component :is="x.is" :ref="(i: any) => keep(x.block.id, i)" :block="x.block" :index="x.index" />
    <div
      v-if="cmsBuilderOn && blank.has(x.block.id)" :style="BLANK" aria-hidden="true"
      :data-cms-block="x.block.id" :data-cms-block-type="x.block.type" :data-cms-block-list="listId"
    >
      <span style="opacity:0.75">{{ cmsBuilderWords.names[x.block.type] ?? x.block.type }}</span>
      <span v-if="cmsBuilderWords.blank" style="font-size:0.8125rem;opacity:0.5">{{ cmsBuilderWords.blank }}</span>
    </div>
  </template>
</template>
