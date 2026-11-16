<script setup lang="ts">
// A dark card with one animal and up to two buttons.
const props = defineProps<{ block: { heading: string; text?: string | null; primaryLabel?: string | null; primaryUrl?: string | null; secondaryLabel?: string | null; secondaryUrl?: string | null; animal?: string | null } }>()
const a = computed(() => useAnimal(props.block.animal, 4))
</script>

<template>
  <section class="py-16 sm:py-24">
    <div class="wrap">
      <div class="cta relative overflow-hidden rounded-[2rem] bg-charcoal px-7 py-14 text-cream sm:px-14 sm:py-20">
        <img :src="a.src" alt="" class="cta-animal" aria-hidden="true">
        <div class="cta-text relative">
          <h2 class="title text-4xl sm:text-5xl">{{ block.heading }}</h2>
          <p v-if="block.text" class="lede mt-5 !text-cream/70 whitespace-pre-line">{{ block.text }}</p>
          <div class="btn-row mt-9 flex flex-wrap gap-3">
            <NuxtLink v-if="block.primaryLabel && block.primaryUrl" :to="block.primaryUrl" class="btn btn-cream">
              {{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-4" />
            </NuxtLink>
            <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" :to="block.secondaryUrl" class="btn btn-ghost-night">{{ block.secondaryLabel }}</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
/* The animal sits in the bottom-right corner. Wide: the text column stops before it.
   Phones: it gets its own space under the buttons. */
.cta { container-type: inline-size; --cta-animal: clamp(10rem, 26cqi, 20rem); }
.cta-animal { position: absolute; right: -2%; bottom: calc(var(--cta-animal) * -0.2); width: var(--cta-animal); height: auto; opacity: .95; }
.cta-text { max-width: min(42rem, calc(100% - var(--cta-animal) + 1rem)); }
@media (max-width: 767px) {
  .cta { padding-bottom: 7.5rem; }
  .cta-animal { width: auto; height: 7rem; right: -1rem; bottom: -1.5rem; opacity: .9; }
  .cta-text { max-width: none; }
}
</style>
