<script setup lang="ts">
// A short looping clip with our own quiet controls instead of the browser's:
// a round play/pause button in the corner and a thin progress line along the bottom.
// It plays only while on screen, and starts paused when the visitor asked their
// system for reduced motion. Clicking the picture also pauses or plays it.
const props = defineProps<{
  src: string
  /** What the clip shows, for the button's label. */
  label: string
  preload?: 'auto' | 'metadata' | 'none'
}>()

const { t } = useLang()
const video = ref<HTMLVideoElement>()
const playing = ref(false)
// The file could not be loaded (e.g. it was replaced): no button that cannot do anything.
const failed = ref(false)
const progress = ref(0)
let userPaused = false
let visible = false
let frame = 0
let observer: IntersectionObserver | undefined

function tick() {
  const v = video.value
  if (v && v.duration) progress.value = v.currentTime / v.duration
  frame = requestAnimationFrame(tick)
}
function play() { video.value?.play().catch(() => {}) }
function toggle() {
  const v = video.value
  if (!v) return
  if (v.paused) { userPaused = false; play() }
  else { userPaused = true; v.pause() }
}

onMounted(() => {
  userPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  observer = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting
    if (visible && !userPaused) play()
    else if (!visible) video.value?.pause()
  }, { threshold: 0.25 })
  if (video.value) observer.observe(video.value)
})
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame) })
// A new clip in the same player (the showcase tabs): start it if the last one was playing.
watch(() => props.src, () => { progress.value = 0; failed.value = false; nextTick(() => { if (visible && !userPaused) play() }) })

function onPlay() { playing.value = true; cancelAnimationFrame(frame); frame = requestAnimationFrame(tick) }
function onPause() { playing.value = false; cancelAnimationFrame(frame) }
</script>

<template>
  <div class="clipv">
    <video
      ref="video" :src="src" muted loop playsinline :preload="preload ?? 'metadata'"
      aria-hidden="true" tabindex="-1"
      @click="toggle" @play="onPlay" @pause="onPause" @error="failed = true"
    />
    <button v-if="!failed" type="button" class="clipv-btn" :aria-label="`${playing ? t('videoPause') : t('videoPlay')}: ${label}`" @click="toggle">
      <svg v-if="playing" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="3.5" height="14" rx="1.2" /><rect x="14" y="5" width="3.5" height="14" rx="1.2" /></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.1-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6Z" /></svg>
    </button>
    <div v-if="!failed" class="clipv-bar" aria-hidden="true"><i :style="{ transform: `scaleX(${progress})` }" /></div>
  </div>
</template>

<style>
.clipv { position: relative; width: 100%; height: 100%; }
.clipv video { display: block; width: 100%; height: 100%; object-fit: contain; cursor: pointer; }
.clipv-btn {
  position: absolute; right: 0.875rem; bottom: 0.875rem; display: grid; place-items: center;
  width: 2.5rem; height: 2.5rem; border-radius: 999px; color: var(--color-cream);
  background: rgb(19 19 19 / 0.72); backdrop-filter: blur(6px);
  box-shadow: 0 6px 16px -8px rgb(0 0 0 / 0.5); transition: transform .15s ease, background-color .15s ease;
}
.clipv-btn:hover { background: rgb(19 19 19 / 0.88); transform: scale(1.06); }
.clipv-btn:focus-visible { outline: 2px solid var(--color-ink); outline-offset: 3px; }
.clipv-btn svg { width: 1.05rem; height: 1.05rem; fill: currentColor; }
.clipv-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgb(19 19 19 / 0.08); }
.clipv-bar i { display: block; height: 100%; background: var(--color-octopus); transform-origin: left; }
</style>
