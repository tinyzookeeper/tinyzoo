<script setup lang="ts">
// Hero: a big heading and two buttons on cream, and the product itself in a window
// (a silent looping video, or a picture). The animals peek over the window's edge.
const { t } = useLang()
defineProps<{ block: {
  eyebrow?: string | null; heading: string; text?: string | null
  primaryLabel?: string | null; primaryUrl?: string | null; secondaryLabel?: string | null; secondaryUrl?: string | null
  video?: { url: string; width?: number | null; height?: number | null } | null; image?: any
} }>()
const parade = ['bunny', 'bird', 'fox', 'frog', 'octopus', 'elephant']
</script>

<template>
  <section class="hero relative -mt-16 overflow-hidden bg-cream pt-16 sm:-mt-[4.5rem] sm:pt-[4.5rem]">
    <div class="hero-dots" aria-hidden="true" />
    <div class="wrap relative grid items-center gap-14 pt-14 pb-20 lg:grid-cols-[1fr_1.15fr] lg:gap-12 lg:pt-20 lg:pb-28">
      <div class="max-w-xl">
        <p v-if="block.eyebrow" class="eyebrow rise">{{ block.eyebrow }}</p>
        <h1 class="display mt-5 text-[2.75rem] sm:text-6xl lg:text-[clamp(3rem,4.6vw,4.25rem)]">{{ block.heading }}</h1>
        <p v-if="block.text" class="lede mt-6 whitespace-pre-line">{{ block.text }}</p>
        <div class="btn-row rise rise-3 mt-9 flex flex-wrap gap-3">
          <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="block.primaryUrl" class="btn btn-dark">
            {{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" />
          </NuxtLink>
          <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="block.secondaryUrl" class="btn btn-light">{{ block.secondaryLabel }}</NuxtLink>
        </div>
      </div>

      <div v-if="block.video || block.image" class="rise rise-2 relative pt-12 sm:pt-16">
        <div class="hero-parade" aria-hidden="true">
          <img v-for="(a, i) in parade" :key="a" :src="`/animals/${a}.svg`" alt="" class="peek" :style="{ animationDelay: `${0.45 + i * 0.07}s` }">
        </div>
        <div class="window relative z-10">
          <div class="window-bar"><i /><i /><i /><span>/admin</span></div>
          <!-- The frame keeps its shape before the video loads (no layout shift). -->
          <div class="hero-screen">
            <ClipVideo v-if="block.video" :src="block.video.url" :label="t('heroVideo')" preload="auto" />
            <CmsImage v-else :media="block.image" eager class="size-full object-cover object-top" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
.hero-dots { position: absolute; inset: 0; background-image: radial-gradient(rgb(19 19 19 / 0.07) 1px, transparent 1px); background-size: 22px 22px; mask-image: radial-gradient(ellipse 70% 60% at 75% 40%, #000 30%, transparent 75%); }
/* The animals stand side by side as one group, centred over the window, and scale with its width (cqi), so all six always fit. */
.hero-parade { position: absolute; left: 6%; right: 6%; top: 0; height: 4.5rem; display: flex; justify-content: center; gap: 0; align-items: flex-end; z-index: 0; container-type: inline-size; }
.hero-parade img { --h: min(4.5rem, 12.5cqi); height: var(--h); width: auto; transform-origin: bottom center; }
.hero-parade img:nth-child(odd) { height: calc(var(--h) * 0.82); }
.hero-screen { aspect-ratio: 16 / 10; background: #fff; }
.hero-screen .clipv video { object-fit: cover; object-position: top; }
.peek { animation: peek .7s cubic-bezier(.2,.9,.25,1.2) both; }
@media (max-width: 639px) { .hero-parade { height: 3rem; left: 5%; right: 5%; } .hero-parade img { --h: min(3rem, 12.5cqi); } }
</style>
