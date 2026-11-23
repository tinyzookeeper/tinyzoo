<script setup lang="ts">
// A photograph of an album, opened large over the page: the arrows on the keyboard and a swipe
// lead to the next one, Escape (or a tap beside the picture, or a swipe down) closes it.
//
//   const shown = ref<number | null>(null)
//   <a :href="p.url" @click.prevent="shown = i">…</a>          // the link still opens the file without scripts
//   <PhotoLightbox v-model="shown" :photos="album.photos" />
//
// One component for every look: what it holds and how it behaves is here, how it is drawn is in
// the look's stylesheet (`.lb…` in app/assets/css/<look>.css).
import type { CmsGalleryItem } from '~/lib/cms-content'

const props = defineProps<{ photos: CmsGalleryItem[] }>()
const index = defineModel<number | null>({ default: null })
const words = useSiteWords()

const open = computed(() => index.value !== null && !!props.photos[index.value])
const photo = computed(() => (index.value === null ? null : props.photos[index.value] ?? null))
const many = computed(() => props.photos.length > 1)
const position = computed(() => (index.value === null ? '' : `${String(index.value + 1).padStart(2, '0')} / ${String(props.photos.length).padStart(2, '0')}`))
/** Which way the last step went: the new picture comes in from that side. */
const way = ref<'next' | 'prev'>('next')

function step(by: number) {
  if (index.value === null || !many.value) return
  way.value = by > 0 ? 'next' : 'prev'
  index.value = (index.value + by + props.photos.length) % props.photos.length
}
const close = () => { index.value = null }

// The neighbours are fetched ahead, so a step shows its picture at once.
const neighbours = computed(() => {
  if (index.value === null || !many.value) return []
  const n = props.photos.length
  return [...new Set([(index.value + 1) % n, (index.value - 1 + n) % n])].filter((i) => i !== index.value).map((i) => props.photos[i]!)
})

const dialog = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLElement | null>(null)
let opener: Element | null = null

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
  else if (e.key === 'Home' && many.value) { e.preventDefault(); way.value = 'prev'; index.value = 0 }
  else if (e.key === 'End' && many.value) { e.preventDefault(); way.value = 'next'; index.value = props.photos.length - 1 }
  else if (e.key === 'Tab') {
    // The keyboard stays inside while it is open.
    const items = [...(dialog.value?.querySelectorAll<HTMLElement>('button') ?? [])]
    if (!items.length) return
    const first = items[0]!, last = items.at(-1)!
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
}

watch(open, async (on) => {
  if (!import.meta.client) return
  if (on) {
    opener = document.activeElement
    document.documentElement.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    await nextTick()
    closeButton.value?.focus({ preventScroll: true })
  }
  else {
    document.documentElement.style.overflow = ''
    document.removeEventListener('keydown', onKey)
    if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
    opener = null
  }
})
onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.documentElement.style.overflow = ''
  document.removeEventListener('keydown', onKey)
})
const route = useRoute()
watch(() => route.fullPath, close)

// A swipe: the picture follows the finger; far enough to a side is a step, far enough down closes.
const drag = reactive({ on: false, x: 0, y: 0, startX: 0, startY: 0, axis: '' as '' | 'x' | 'y' })
function onDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  Object.assign(drag, { on: true, x: 0, y: 0, startX: e.clientX, startY: e.clientY, axis: '' })
}
function onMove(e: PointerEvent) {
  if (!drag.on) return
  const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY
  if (!drag.axis && Math.hypot(dx, dy) > 8) drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  if (drag.axis === 'x') drag.x = many.value ? dx : dx / 4
  if (drag.axis === 'y') drag.y = Math.max(0, dy)
}
function onUp() {
  if (!drag.on) return
  const { x, y, axis } = drag
  Object.assign(drag, { on: false, x: 0, y: 0, axis: '' })
  if (axis === 'x' && Math.abs(x) > 56) step(x < 0 ? 1 : -1)
  else if (axis === 'y' && y > 90) close()
  // A press that did not move is a click: a click beside the picture closes (onBackdrop).
  moved = axis !== ''
}
let moved = false
function onBackdrop(e: MouseEvent) {
  if (moved) { moved = false; return }
  if (!(e.target as Element).closest('.lb__frame, button')) close()
}
const dragStyle = computed(() => (drag.on && drag.axis
  ? { transform: `translate(${drag.x}px, ${drag.y}px)`, transition: 'none', opacity: drag.axis === 'y' ? String(Math.max(0.35, 1 - drag.y / 320)) : undefined }
  : undefined))
</script>

<template>
  <Teleport to="body">
    <Transition name="lb">
      <div
        v-if="open && photo" ref="dialog" class="lb site" role="dialog" aria-modal="true" :aria-label="photo.caption || photo.alt || position" data-lightbox
        @click="onBackdrop" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp"
      >
        <p class="lb__count" aria-live="polite" data-lightbox-count>{{ position }}</p>
        <button ref="closeButton" type="button" class="lb__btn lb__close" :aria-label="words.close" data-lightbox-close @click="close">
          <UIcon name="i-lucide-x" class="size-6" aria-hidden="true" />
        </button>
        <button v-if="many" type="button" class="lb__btn lb__prev" :aria-label="words.previousPhoto" data-lightbox-prev @click="step(-1)">
          <UIcon name="i-lucide-arrow-left" class="size-6" aria-hidden="true" />
        </button>
        <button v-if="many" type="button" class="lb__btn lb__next" :aria-label="words.nextPhoto" data-lightbox-next @click="step(1)">
          <UIcon name="i-lucide-arrow-right" class="size-6" aria-hidden="true" />
        </button>

        <div class="lb__stage">
          <Transition :name="`lb-${way}`" mode="out-in">
            <figure :key="photo.id" class="lb__fig" :style="dragStyle">
              <div class="lb__frame">
                <CmsImage :media="photo" eager sizes="100vw" class="lb__img" draggable="false" />
                <figcaption v-if="photo.caption" class="lb__cap">{{ tidyText(photo.caption) }}</figcaption>
              </div>
            </figure>
          </Transition>
        </div>
        <div hidden aria-hidden="true">
          <CmsImage v-for="p in neighbours" :key="p.id" :media="p" eager sizes="100vw" alt="" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* What every look shares: the place of each part. The look's stylesheet draws them. */
.lb { position: fixed; inset: 0; z-index: 100; display: grid; grid-template-rows: minmax(0, 1fr); touch-action: none; user-select: none; -webkit-user-select: none; overscroll-behavior: contain; }
.lb__stage { grid-area: 1 / 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 4rem 0.75rem 1.5rem; }
.lb__fig { margin: 0; max-width: 100%; max-height: 100%; display: flex; align-items: center; justify-content: center; min-height: 0; transition: transform .25s cubic-bezier(.2, .7, .2, 1), opacity .2s; }
.lb__frame { display: flex; flex-direction: column; max-width: 100%; max-height: calc(100dvh - 5.5rem); min-height: 0; }
.lb__img { display: block; width: auto; height: auto; max-width: 100%; min-height: 0; flex: 0 1 auto; max-height: calc(100dvh - 9rem); object-fit: contain; -webkit-user-drag: none; }
.lb__cap { flex: none; }
.lb__count { position: absolute; top: 0; left: 0; z-index: 2; margin: 0; padding: 1.1rem 1.25rem; font-variant-numeric: tabular-nums; }
.lb__btn { position: absolute; z-index: 2; display: inline-flex; align-items: center; justify-content: center; width: 3rem; height: 3rem; cursor: pointer; transition: background .15s, color .15s, transform .15s; }
.lb__close { top: 0.5rem; right: 0.5rem; }
.lb__prev, .lb__next { top: 50%; margin-top: -1.5rem; }
.lb__prev { left: 0.5rem; }
.lb__next { right: 0.5rem; }
@media (min-width: 768px) {
  .lb__stage { padding: 4.5rem 5.5rem 2.5rem; }
  .lb__frame { max-height: calc(100dvh - 7rem); }
  .lb__img { max-height: calc(100dvh - 10.5rem); }
  .lb__close { top: 1rem; right: 1rem; }
  .lb__prev { left: 1.25rem; }
  .lb__next { right: 1.25rem; }
  .lb__count { padding: 1.6rem 2.5rem; }
}
/* On a phone the arrows give way to the swipe: they sit small at the foot. */
@media (max-width: 767px) {
  .lb__prev, .lb__next { top: auto; bottom: 0.75rem; margin-top: 0; }
  .lb__stage { padding-bottom: 4.5rem; }
  .lb__frame { max-height: calc(100dvh - 8.5rem); }
  .lb__img { max-height: calc(100dvh - 12rem); }
}

.lb-enter-active, .lb-leave-active { transition: opacity .22s ease; }
.lb-enter-from, .lb-leave-to { opacity: 0; }
.lb-next-enter-active, .lb-next-leave-active, .lb-prev-enter-active, .lb-prev-leave-active { transition: opacity .16s ease, transform .16s ease; }
.lb-next-enter-from, .lb-prev-leave-to { opacity: 0; transform: translateX(28px); }
.lb-next-leave-to, .lb-prev-enter-from { opacity: 0; transform: translateX(-28px); }
@media (prefers-reduced-motion: reduce) {
  .lb-next-enter-from, .lb-prev-leave-to, .lb-next-leave-to, .lb-prev-enter-from { transform: none; }
}
</style>
