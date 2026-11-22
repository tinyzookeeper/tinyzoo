<script setup lang="ts">
// A little website drawn in a browser window, with tinyzoo's animals looking over its top
// edge. It is the product's picture: finished on the start page, following what is typed in
// the wizard, and coming together piece by piece while a site is being made.
//
// Everything is sized from the component's own width (container units), so it is the same
// drawing at 280 px and at 560 px.
export interface Peeker {
  animal: string
  /** Standing on the window's edge (otherwise hidden behind it). */
  up: boolean
  /** At work: a slow nod. */
  busy?: boolean
}

withDefaults(defineProps<{
  /** The site's name, in its header. */
  name?: string
  /** What the address bar shows. */
  address?: string
  /** The page inside the window is there. */
  page?: boolean
  /** The site answers: the address bar lights up. */
  live?: boolean
  /** The demo content is in. */
  content?: boolean
  /** The name is written in the header. */
  named?: boolean
  peekers?: Peeker[]
}>(), { name: '', address: '', page: true, live: true, content: true, named: true, peekers: () => [] })
</script>

<template>
  <div class="mini" aria-hidden="true">
    <div class="mini__stage">
      <div class="mini__peekers">
        <span v-for="(p, i) in peekers" :key="p.animal" class="mini__peeker" :class="{ 'is-up': p.up, 'is-busy': p.busy }" :style="{ '--i': i, '--n': peekers.length }">
          <ZAnimal :name="p.animal" />
        </span>
      </div>
      <div class="mini__window">
        <div class="mini__bar">
          <i /><i /><i />
          <span class="mini__address" :class="{ 'is-live': live }">
            <b />
            <span>{{ address }}</span>
          </span>
        </div>
        <div class="mini__page" :class="{ 'is-on': page, 'has-content': content }">
          <div class="mini__header">
            <span class="mini__name" :class="{ 'is-on': named && name }">{{ name || ' ' }}</span>
            <span class="mini__nav"><i /><i /><i /></span>
          </div>
          <div class="mini__hero">
            <div class="mini__copy"><i class="h" /><i class="h h--short" /><i class="p" /><i class="p p--short" /><i class="btn" /></div>
            <div class="mini__pic"><b /><u /></div>
          </div>
          <div class="mini__cards"><div><b /><i /><i /></div><div><b /><i /><i /></div><div><b /><i /><i /></div></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mini { container-type: inline-size; width: 100%; }
.mini__stage { position: relative; padding-top: 15cqw; }

/* The animals stand on the window's top edge; hidden, they wait behind the window. */
.mini__peekers { position: absolute; inset: 0 6cqw auto 6cqw; height: 15cqw; display: flex; justify-content: space-around; align-items: flex-end; z-index: 0; }
.mini__peeker { display: block; width: 17cqw; transform: translateY(105%); transition: transform 700ms cubic-bezier(.2,.9,.25,1.05); transform-origin: 50% 100%; }
.mini__peeker :deep(img) { display: block; width: 100%; height: auto; transform-origin: 50% 100%; }
.mini__peeker.is-up { transform: translateY(4%); }
.mini__peeker.is-busy :deep(img) { animation: mini-nod 2.6s ease-in-out infinite; }
.mini__peeker.is-up:not(.is-busy) :deep(img) { animation: mini-breathe 5.2s ease-in-out infinite; animation-delay: calc(var(--i) * -1.3s); }

.mini__window { position: relative; z-index: 1; background: var(--z-paper); border: 1px solid var(--z-paper-line); border-radius: 3.2cqw; box-shadow: var(--z-shadow); overflow: hidden; }
.mini__bar { display: flex; align-items: center; gap: 1.3cqw; padding: 2.4cqw 3cqw; border-bottom: 1px solid var(--z-paper-line); background: var(--z-paper-softer); }
.mini__bar > i { width: 1.9cqw; height: 1.9cqw; border-radius: 50%; background: var(--z-paper-line); flex: none; }
.mini__address { margin-left: 2cqw; flex: 1; min-width: 0; display: flex; align-items: center; gap: 1.4cqw; height: 5.4cqw; padding: 0 2.2cqw; border-radius: 99px; background: var(--z-paper); border: 1px solid var(--z-paper-line); font-family: var(--font-mono); font-size: max(2.5cqw, 9px); color: var(--ui-text-dimmed); transition: color 500ms; }
.mini__address > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini__address > b { width: 1.5cqw; height: 1.5cqw; border-radius: 50%; background: var(--z-paper-line); flex: none; transition: background 500ms, box-shadow 500ms; }
.mini__address.is-live { color: var(--z-paper-ink); }
.mini__address.is-live > b { background: var(--z-ok); box-shadow: 0 0 0 0.8cqw color-mix(in oklab, var(--z-ok) 22%, transparent); }

.mini__page { aspect-ratio: 16 / 10.2; padding: 3cqw 3.6cqw 0; display: flex; flex-direction: column; gap: 2.8cqw; opacity: 0; transition: opacity 700ms; }
.mini__page.is-on { opacity: 1; }

.mini__header { display: flex; align-items: center; justify-content: space-between; gap: 3cqw; }
.mini__name { min-width: 0; font-family: var(--font-display); font-weight: 800; letter-spacing: -0.02em; font-size: max(3.3cqw, 11px); line-height: 1.2; color: var(--z-paper-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0; transform: translateY(0.8cqw); transition: opacity 500ms, transform 500ms; }
.mini__name.is-on { opacity: 1; transform: none; }
.mini__nav { display: flex; gap: 1.8cqw; flex: none; }
.mini__nav i { width: 5.5cqw; height: 1.3cqw; border-radius: 99px; background: var(--z-paper-soft); }

/* The pieces of the content arrive one after another. */
.mini__hero, .mini__cards > div { opacity: 0; transform: translateY(1.6cqw); transition: opacity 600ms, transform 600ms cubic-bezier(.2,.7,.2,1); }
.mini__nav { opacity: 0; transition: opacity 500ms; }
.has-content .mini__nav { opacity: 1; }
.has-content .mini__hero, .has-content .mini__cards > div { opacity: 1; transform: none; }
.has-content .mini__hero { transition-delay: 120ms; }
.has-content .mini__cards > div:nth-child(1) { transition-delay: 420ms; }
.has-content .mini__cards > div:nth-child(2) { transition-delay: 560ms; }
.has-content .mini__cards > div:nth-child(3) { transition-delay: 700ms; }

.mini__hero { display: grid; grid-template-columns: 1.1fr 1fr; gap: 3cqw; align-items: stretch; }
.mini__copy { display: flex; flex-direction: column; justify-content: center; gap: 1.5cqw; }
.mini__copy i { display: block; border-radius: 99px; }
.mini__copy .h { height: 2.9cqw; width: 92%; background: var(--z-paper-ink); opacity: .9; }
.mini__copy .h--short { width: 60%; }
.mini__copy .p { height: 1.3cqw; width: 84%; background: var(--z-paper-soft); margin-top: .5cqw; }
.mini__copy .p--short { width: 55%; margin-top: 0; }
.mini__copy .btn { height: 4.4cqw; width: 17cqw; margin-top: 1.2cqw; background: var(--z-paper-ink); border-radius: 1.2cqw; }
.mini__pic { position: relative; aspect-ratio: 4 / 3; border-radius: 2cqw; background: var(--z-warm-soft); overflow: hidden; }
.mini__pic b { position: absolute; left: 14%; top: 16%; width: 18%; aspect-ratio: 1; border-radius: 50%; background: var(--z-warm); opacity: .85; }
.mini__pic u { position: absolute; left: -8%; right: -8%; bottom: -46%; height: 86%; border-radius: 50% 50% 0 0; background: color-mix(in oklab, var(--z-warm) 55%, var(--z-warm-soft)); }

.mini__cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.4cqw; flex: 1; min-height: 0; }
.mini__cards > div { display: flex; flex-direction: column; gap: 1.2cqw; padding: 1.8cqw 1.8cqw 0; border: 1px solid var(--z-paper-line); border-bottom: 0; border-radius: 1.8cqw 1.8cqw 0 0; }
.mini__cards b { display: block; height: 5.5cqw; border-radius: 1cqw; background: var(--z-paper-softer); }
.mini__cards i { display: block; height: 1.2cqw; width: 80%; border-radius: 99px; background: var(--z-paper-soft); }
.mini__cards i + i { width: 50%; }

@keyframes mini-nod {
  0%, 100% { transform: translateY(0) rotate(0); }
  25% { transform: translateY(6%) rotate(-3deg); }
  50% { transform: translateY(1%) rotate(0); }
  75% { transform: translateY(6%) rotate(3deg); }
}
@keyframes mini-breathe {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(5%); }
}
</style>
