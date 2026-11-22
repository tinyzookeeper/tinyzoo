<script setup lang="ts">
// The website itself, small, in a browser frame: its real home page, loaded without scripts
// (a still picture of what visitors get) and scaled down. Nothing in it can be clicked; the
// whole frame is a link to the site.
const props = defineProps<{ url: string; label: string }>()
const frame = ref<HTMLElement | null>(null)
const scale = ref(0.3)
const WIDTH = 1280
let observer: ResizeObserver | null = null
onMounted(() => {
  const measure = () => { if (frame.value) scale.value = frame.value.clientWidth / WIDTH }
  measure()
  observer = new ResizeObserver(measure)
  if (frame.value) observer.observe(frame.value)
})
onBeforeUnmount(() => observer?.disconnect())
const host = computed(() => hostOf(props.url))
</script>

<template>
  <a :href="url" target="_blank" rel="noopener" class="preview group block" :aria-label="label" data-site-preview>
    <div class="preview__bar">
      <i /><i /><i />
      <span class="preview__address"><b />{{ host }}</span>
      <UIcon name="i-lucide-arrow-up-right" class="ml-2 size-4 shrink-0 text-dimmed transition group-hover:text-highlighted" />
    </div>
    <div ref="frame" class="preview__frame">
      <ClientOnly>
        <iframe :src="url" :title="label" sandbox="" loading="lazy" tabindex="-1" aria-hidden="true" scrolling="no" :style="{ width: `${WIDTH}px`, height: `${WIDTH * 0.625}px`, transform: `scale(${scale})` }" />
      </ClientOnly>
    </div>
  </a>
</template>

<style scoped>
.preview { background: var(--z-paper); border: 1px solid var(--z-paper-line); border-radius: 1rem; box-shadow: var(--z-shadow); overflow: hidden; transition: transform 300ms cubic-bezier(.2,.7,.2,1); }
.preview:hover { transform: translateY(-2px); }
.preview__bar { display: flex; align-items: center; gap: 0.375rem; padding: 0.625rem 0.875rem; border-bottom: 1px solid var(--z-paper-line); background: var(--z-paper-softer); }
.preview__bar > i { width: 0.5625rem; height: 0.5625rem; border-radius: 50%; background: var(--z-paper-line); flex: none; }
.preview__address { margin-left: 0.5rem; flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.5rem; height: 1.625rem; padding: 0 0.75rem; border-radius: 99px; background: var(--z-paper); border: 1px solid var(--z-paper-line); font-family: var(--font-mono); font-size: 0.75rem; color: var(--z-paper-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.preview__address > b { width: 0.4375rem; height: 0.4375rem; border-radius: 50%; background: var(--z-ok); box-shadow: 0 0 0 3px color-mix(in oklab, var(--z-ok) 22%, transparent); flex: none; }
.preview__frame { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: #fff; }
.preview__frame iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; pointer-events: none; }
</style>
