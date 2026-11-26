<script setup lang="ts">
// The editor in the preview (experimental, NUXT_CMS_BUILDER=on): the form, or the selected block alone
// (CmsBuilderPanel) in its place. Only while the preview is beside the form (the editor sets the bridge's
// `panel`); else, and with the switch off, the form as it always is. The form is hidden, not removed, so
// coming back finds it as it was, at the place it was scrolled to.
const props = defineProps<{ entity: string; readOnly?: boolean }>()
const builder = useCmsBuilder()
const focused = computed(() => !!builder.value?.focused.value)
const at = computed(() => builder.value?.selectedPath.value?.join('/') ?? '')
const root = ref<HTMLElement | null>(null)

/** What scrolls the form: the nearest element around it that scrolls, else the page. */
let scrolling: HTMLElement | null = null
function scroller(): HTMLElement {
  if (scrolling?.isConnected && scrolling.contains(root.value)) return scrolling
  for (let el = root.value?.parentElement; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === 'auto' || overflowY === 'scroll') return (scrolling = el)
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}
/** Show the panel from its start: the form was scrolled for the list (or for another block). */
function showTop(el: HTMLElement) {
  const panel = root.value?.querySelector<HTMLElement>('.cms-focus')
  if (!panel) return
  const page = el === document.scrollingElement || el === document.documentElement
  const top = panel.getBoundingClientRect().top - (page ? 0 : el.getBoundingClientRect().top) + el.scrollTop - 24
  el.scrollTop = Math.max(0, top)
}
let listScroll: number | null = null
// The element that scrolls is found while the form is still there: a short panel may not scroll it at all.
watch(focused, async (now, was) => {
  if (!import.meta.client) return
  const el = scroller()
  if (now && !was) listScroll = el.scrollTop
  await nextTick()
  if (now) showTop(el)
  else if (listScroll !== null) {
    el.scrollTop = listScroll
    listScroll = null
  }
}, { flush: 'pre' })
watch(at, async () => {
  if (!focused.value || !import.meta.client) return
  const el = scroller()
  await nextTick()
  showTop(el)
}, { flush: 'pre' })
</script>

<template>
  <slot v-if="!builder" />
  <div v-else ref="root">
    <Transition name="cms-focus-list">
      <div v-show="!focused"><slot /></div>
    </Transition>
    <Transition name="cms-focus-panel">
      <CmsBuilderPanel v-if="focused" :key="at" :entity="entity" :read-only="readOnly" />
    </Transition>
  </div>
</template>

<style scoped>
/* A short slide: in from the right to the selected block, back from the left to the form. Leaving is at once. */
.cms-focus-panel-enter-active, .cms-focus-list-enter-active { transition: opacity 200ms cubic-bezier(.2,.7,.2,1), transform 200ms cubic-bezier(.2,.7,.2,1); }
.cms-focus-panel-enter-from { opacity: 0; transform: translateX(12px); }
.cms-focus-list-enter-from { opacity: 0; transform: translateX(-12px); }
@media (prefers-reduced-motion: reduce) {
  .cms-focus-panel-enter-active, .cms-focus-list-enter-active { transition: none; }
}
</style>
