<script setup lang="ts">
// Features: cards, each with its animal on a panel in that animal's colour.
const props = defineProps<{ block: { eyebrow?: string | null; heading: string; text?: string | null; items: { id: string; title: string; text?: string | null; animal?: string | null }[] }; index?: number }>()
const cards = computed(() => props.block.items.map((it, i) => ({ ...it, a: useAnimal(it.animal, i) })))
</script>

<template>
  <section class="section">
    <div class="wrap">
      <div class="max-w-2xl">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <h2 class="title mt-4 text-4xl sm:text-5xl">{{ block.heading }}</h2>
        <p v-if="block.text" class="lede mt-5 whitespace-pre-line">{{ block.text }}</p>
      </div>
      <ul class="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="c in cards" :key="c.id" class="feature group">
          <div class="feature-panel" :style="{ '--tint': c.a.color }" aria-hidden="true">
            <img :src="c.a.src" alt="" class="feature-animal" loading="lazy">
          </div>
          <div class="px-1 pt-5">
            <h3 class="text-xl font-extrabold tracking-[-0.02em]">{{ c.title }}</h3>
            <p v-if="c.text" class="mt-2 leading-relaxed text-mute whitespace-pre-line">{{ c.text }}</p>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style>
.feature-panel { position: relative; height: 11rem; border-radius: 1.25rem; overflow: hidden; background: color-mix(in oklab, var(--tint) 22%, #fff); }
.feature-panel::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(color-mix(in oklab, var(--tint) 45%, transparent) 1.2px, transparent 1.2px); background-size: 16px 16px; opacity: .55; }
.feature-animal { position: absolute; left: 50%; bottom: -14%; height: 78%; width: auto; transform: translateX(-50%); transition: transform .35s cubic-bezier(.2,.9,.25,1.15); }
.feature:hover .feature-animal { transform: translateX(-50%) translateY(-8%) rotate(-2deg); }
@media (prefers-reduced-motion: reduce) { .feature:hover .feature-animal { transform: translateX(-50%); } }
</style>
