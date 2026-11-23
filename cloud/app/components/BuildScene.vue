<script setup lang="ts">
import type { SiteView } from '#shared/api'
import { STEP_IDS, stepDuration, type StepId, type StepState } from '#shared/steps'

// The screen someone watches while their website is made. The four steps are the real ones
// with their real state (the page polls the server); the picture follows them: the page's
// plan appears, the address lights up, the content arrives (the site's own template and
// look), the name is written on it, and an animal climbs onto the window for every step.
//
// A site is made in a few seconds, faster than a person can read. So the screen walks through
// the states it is shown no faster than a calm pace: never ahead of the server, at most a
// moment behind it. When all is done it holds the finished picture briefly, then says so.
const props = defineProps<{ site: SiteView; busy?: boolean }>()
const emit = defineEmits<{ finished: []; retry: [] }>()
const t = useT()
const { locale } = useLocale()

const ANIMALS: Record<StepId, string> = { database: 'elephant', start: 'fox', content: 'owl', account: 'panda' }

/** How far the server is, in half-steps: 2i = step i waits, 2i+1 = it runs (or failed), 8 = all done. */
const real = computed(() => {
  const done = props.site.steps.findIndex((s) => s.state !== 'done')
  if (done === -1) return STEP_IDS.length * 2
  const at = props.site.steps[done]!
  return done * 2 + (at.state === 'running' || at.state === 'failed' ? 1 : 0)
})
const failed = computed(() => props.site.status === 'failed')
const waiting = computed(() => props.site.status === 'waiting')

// What the screen shows: it starts where a failed site stopped, otherwise at the beginning.
const shown = ref(props.site.status === 'failed' ? real.value : 0)
let last = 0
let timer: ReturnType<typeof setInterval> | null = null
let finish: ReturnType<typeof setTimeout> | null = null

function tick() {
  const now = Date.now()
  if (shown.value > real.value) { shown.value = real.value; last = now; return }
  if (shown.value === real.value) return
  // Starting a step is quick to show; finishing one is given time to be seen.
  const dwell = shown.value % 2 === 1 ? 900 : 420
  if (now - last < dwell) return
  shown.value++
  last = now
}
onMounted(() => {
  last = Date.now() - 200
  timer = setInterval(tick, 80)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer); if (finish) clearTimeout(finish) })

const allShown = computed(() => shown.value >= STEP_IDS.length * 2)
watch([allShown, () => props.site.status], ([all, status]) => {
  if (all && status === 'ready' && !finish) finish = setTimeout(() => emit('finished'), 1900)
}, { immediate: true })

const caughtUp = computed(() => shown.value === real.value)
function stateOf(i: number): StepState {
  if (shown.value >= i * 2 + 2) return 'done'
  if (shown.value === i * 2 + 1) return failed.value && caughtUp.value ? 'failed' : 'running'
  return 'pending'
}
const rows = computed(() => STEP_IDS.map((id, i) => {
  const state = stateOf(i)
  const step = props.site.steps[i]
  return { id, state, animal: ANIMALS[id], took: state === 'done' && step ? formatDuration(stepDuration(step), locale.value) : '', code: state === 'failed' ? step?.message ?? 'unexpected' : null }
}))
// The step being worked on; between two steps, the one that comes next.
const current = computed(() => rows.value.find((r) => r.state === 'running' || r.state === 'failed') ?? rows.value.find((r) => r.state === 'pending') ?? null)
const failedRow = computed(() => rows.value.find((r) => r.state === 'failed') ?? null)

const peekers = computed(() => STEP_IDS.map((id, i) => ({ animal: ANIMALS[id], up: !waiting.value && shown.value >= i * 2 + 1, busy: stateOf(i) === 'running' })))
const failText = computed(() => {
  const code = failedRow.value?.code
  if (!code) return ''
  const key = `fail.${code}`
  const text = t(key as any)
  return text === key ? t('fail.unexpected') : text
})
</script>

<template>
  <div class="build z-moment" :data-build="allShown ? 'done' : failedRow ? 'failed' : waiting ? 'waiting' : 'running'">
    <div class="build__grid">
      <div class="build__picture">
        <MiniSite
          :name="site.name"
          :address="hostOf(site.publicUrl) || `${site.slug}…`"
          :page="shown >= 2"
          :live="shown >= 4"
          :content="shown >= 6"
          :named="shown >= 8"
          :peekers="peekers"
          :template="site.template"
          :look="site.look"
        />
      </div>

      <div class="build__text" aria-live="polite">
        <template v-if="waiting">
          <h1 class="z-display text-[1.75rem] leading-tight text-balance text-highlighted sm:text-4xl">{{ t('build.waitingTitle') }}</h1>
          <p class="z-moment-text mt-3 text-pretty sm:text-lg">{{ t('build.waitingText') }}</p>
          <div class="mt-5"><slot name="waiting" /></div>
        </template>
        <template v-else-if="failedRow">
          <h1 class="z-display text-[1.75rem] leading-tight text-balance text-highlighted sm:text-4xl">{{ t('build.failedTitle') }}</h1>
          <p class="z-moment-text mt-3 text-pretty sm:text-lg" data-fail-text>{{ failText }}</p>
        </template>
        <template v-else-if="allShown">
          <h1 class="z-display z-rise text-[1.75rem] leading-tight text-balance text-highlighted sm:text-4xl lg:text-5xl">{{ t('build.doneTitle') }}</h1>
          <p class="z-moment-text z-rise z-rise-1 mt-3 text-pretty sm:text-lg">{{ t('build.doneText', { name: site.name }) }}</p>
        </template>
        <template v-else>
          <h1 class="z-display text-[1.75rem] leading-tight text-balance text-highlighted sm:text-4xl lg:text-5xl">{{ t('build.title') }}</h1>
          <p class="z-moment-text mt-3 min-h-[1.75em] text-pretty sm:text-lg">
            <Transition name="line" mode="out-in">
              <span :key="current?.id ?? 'start'" class="inline-block">{{ current ? t(`build.doing.${current.id}` as any) : t('build.starting') }}</span>
            </Transition>
          </p>
        </template>

        <ol v-if="!waiting" class="build__steps mt-7">
          <li v-for="r in rows" :key="r.id" class="build__step" :class="`is-${r.state}`" :data-step="r.id" :data-state="r.state">
            <span class="build__tile z-tile"><ZAnimal :name="r.animal" /></span>
            <span class="build__label">{{ t(`build.step.${r.id}` as any) }}</span>
            <span class="build__state">
              <template v-if="r.state === 'done'"><UIcon name="i-lucide-check" class="size-4 text-(--z-ok)" /><span class="tabular">{{ r.took }}</span></template>
              <template v-else-if="r.state === 'running'"><span class="build__pulse" />{{ t('build.now') }}</template>
              <template v-else-if="r.state === 'failed'"><UIcon name="i-lucide-circle-alert" class="size-4" />{{ t('build.failed') }}</template>
              <template v-else>{{ t('build.waits') }}</template>
            </span>
          </li>
        </ol>

        <div v-if="failedRow" class="mt-6 flex flex-wrap items-center gap-3">
          <UButton :label="t('build.retry')" size="lg" icon="i-lucide-rotate-cw" :loading="busy" data-retry @click="emit('retry')" />
          <span class="z-moment-text text-sm">{{ t('build.retryNote') }}</span>
        </div>
        <details v-if="failedRow && site.errorDetail" class="mt-4 text-sm">
          <summary class="z-moment-text">{{ t('build.detail') }}</summary>
          <pre class="mt-2 max-h-56 overflow-auto rounded-lg bg-(--z-surface) p-3 font-mono text-xs whitespace-pre-wrap text-toned">{{ site.errorDetail }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<style scoped>
.build { padding: 1.5rem 1.25rem 2rem; display: flex; align-items: center; }
.build__grid { display: grid; gap: 1.75rem; align-items: center; width: 100%; }
.build__picture { width: 100%; max-width: 26rem; margin-inline: auto; }
@media (min-width: 64rem) {
  /* The stage fills the screen under the top bar: this is the moment of the product. */
  .build { padding: 3rem 4.5rem 3.5rem; min-height: min(46rem, calc(100dvh - 11rem)); }
  .build__grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 5rem; }
  .build__picture { max-width: none; order: 2; }
}

.build__steps { display: flex; flex-direction: column; gap: 0.375rem; }
.build__step { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.875rem; padding: 0.5rem 0.875rem 0.5rem 0.5rem; border-radius: 0.875rem; transition: background 400ms, opacity 400ms; }
.build__tile { width: 2.75rem; height: 2.75rem; background: var(--z-moment-strong); padding-top: 0.5rem; transition: background 400ms; }
.build__tile :deep(img) { width: 2rem; height: auto; transform: translateY(1px); transition: transform 500ms cubic-bezier(.2,.9,.25,1.05), opacity 400ms; }
.build__label { font-weight: 600; color: var(--ui-text-highlighted); }
.build__state { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; color: var(--z-moment-text); white-space: nowrap; }

.build__step.is-pending { opacity: 0.55; }
.build__step.is-pending .build__tile :deep(img) { transform: translateY(70%); opacity: .6; }
.build__step.is-running { background: var(--z-surface); box-shadow: 0 1px 0 var(--z-moment-line), 0 10px 24px -18px rgb(60 45 20 / 0.5); }
.build__step.is-running .build__state { color: var(--ui-text-highlighted); font-weight: 500; }
.build__step.is-running .build__tile :deep(img) { animation: build-nod 2.6s ease-in-out infinite; transform-origin: 50% 100%; }
.build__step.is-failed { background: color-mix(in oklab, var(--ui-error) 9%, var(--z-surface)); }
.build__step.is-failed .build__state { color: var(--ui-error); font-weight: 500; }

/* "Right now": a dot that breathes, not a spinner. */
.build__pulse { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--z-warm); animation: build-pulse 1.8s ease-in-out infinite; }

.line-enter-active, .line-leave-active { transition: opacity 260ms, transform 260ms; }
.line-enter-from { opacity: 0; transform: translateY(0.35rem); }
.line-leave-to { opacity: 0; transform: translateY(-0.35rem); }

@keyframes build-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--z-warm) 45%, transparent); }
  50% { box-shadow: 0 0 0 0.45rem color-mix(in oklab, var(--z-warm) 0%, transparent); }
}
@keyframes build-nod {
  0%, 100% { transform: translateY(1px) rotate(0); }
  25% { transform: translateY(3px) rotate(-4deg); }
  75% { transform: translateY(3px) rotate(4deg); }
}
</style>
