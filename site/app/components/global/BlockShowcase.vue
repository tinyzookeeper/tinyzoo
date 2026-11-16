<script setup lang="ts">
// Video tour: the clips as tabs on the left (arrow keys move between them), the
// chosen one playing on the right in a frame that keeps its shape while loading.
const props = defineProps<{ block: { eyebrow?: string | null; heading: string; text?: string | null; items: { id: string; title: string; text?: string | null; video?: { url: string } | null }[] } }>()
const { t } = useLang()
const uid = useId()
const active = ref(0)
const current = computed(() => props.block.items[active.value] ?? null)
const tabs = ref<HTMLButtonElement[]>([])
function pick(i: number, focus = false) {
  const n = props.block.items.length
  if (!n) return
  active.value = (i + n) % n
  if (focus) nextTick(() => tabs.value[active.value]?.focus())
}
function onKey(e: KeyboardEvent) {
  const map: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
  if (e.key in map) { e.preventDefault(); pick(active.value + map[e.key]!, true) }
  else if (e.key === 'Home') { e.preventDefault(); pick(0, true) }
  else if (e.key === 'End') { e.preventDefault(); pick(props.block.items.length - 1, true) }
}
</script>

<template>
  <section class="section bg-cream">
    <div class="wrap">
      <div class="max-w-2xl">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <h2 class="title mt-4 text-4xl sm:text-5xl">{{ block.heading }}</h2>
        <p v-if="block.text" class="lede mt-5 whitespace-pre-line">{{ block.text }}</p>
      </div>
      <div class="mt-14 grid gap-8 lg:grid-cols-[22rem_1fr] lg:gap-10">
        <div class="grid content-start gap-2" role="tablist" aria-orientation="vertical" :aria-label="block.heading" @keydown="onKey">
          <button
            v-for="(it, i) in block.items" :id="`${uid}-tab-${i}`" :key="it.id" ref="tabs"
            type="button" role="tab" :aria-selected="active === i" :aria-controls="`${uid}-panel`" :tabindex="active === i ? 0 : -1"
            class="clip" :class="active === i ? 'clip--on' : ''"
            @click="pick(i)"
          >
            <span class="clip-num" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="min-w-0">
              <span class="block font-extrabold tracking-[-0.01em]">{{ it.title }}</span>
              <span v-if="it.text" class="clip-text mt-1 block text-sm leading-relaxed text-mute">{{ it.text }}</span>
            </span>
          </button>
        </div>
        <div :id="`${uid}-panel`" class="window self-start" role="tabpanel" :aria-labelledby="`${uid}-tab-${active}`">
          <div class="window-bar" aria-hidden="true"><i /><i /><i /><span>{{ current?.title }}</span></div>
          <div class="clip-screen">
            <ClipVideo v-if="current?.video" :src="current.video.url" :label="current.title" />
            <p v-else class="grid size-full place-items-center text-mute">{{ t('videoPending') }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
.clip { width: 100%; display: flex; gap: 1rem; text-align: left; padding: 1rem 1.125rem; border-radius: 1rem; transition: background-color .2s ease, box-shadow .2s ease; }
.clip:hover { background: rgb(255 255 255 / 0.6); }
.clip--on { background: #fff; box-shadow: 0 0 0 1px rgb(19 19 19 / 0.06), 0 12px 24px -16px rgb(19 19 19 / 0.3); }
.clip-num { font-family: var(--font-mono); font-size: 0.8125rem; padding-top: 0.15rem; color: var(--color-mute); }
.clip--on .clip-num { color: var(--color-ink); }
.clip:not(.clip--on) .clip-text { display: none; }
@media (max-width: 1023px) { .clip-text { display: block !important; } }
.clip-screen { aspect-ratio: 16 / 10; background: #fff; }
</style>
