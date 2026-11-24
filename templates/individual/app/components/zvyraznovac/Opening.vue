<script setup lang="ts">
// Zvýrazňovač's opening: the brand colour as a field and the headline as the picture. The
// cliché the heading replaces stands struck through above it, the heading is set so large
// that a long one has to be scaled to its length, the facts are a ruled list beside the
// button, and the portrait is printed in the brand colour.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string }>()
// The design's headline is a short one; a longer one gets a smaller size so it still fits in a few lines.
const size = computed(() => byLength(props.block.heading, [
  [40, 'text-[3.3rem] sm:text-[4.5rem] md:text-[5.6rem] lg:text-[8.2vw] 2xl:text-[7.6rem]'],
  [70, 'text-[2.6rem] sm:text-[3.6rem] md:text-[4.4rem] lg:text-[5.6vw] 2xl:text-[5.4rem]'],
], 'text-[2.2rem] sm:text-[3rem] md:text-[3.6rem] lg:text-[4.4vw] 2xl:text-[4.2rem]'))
// Three facts fit beside the button: the last three.
const facts = computed(() => props.block.facts.slice(-3))
</script>

<template>
  <section :id="anchor" class="bg-brand text-brand-ink on-brand">
    <div class="wrap pt-8 lg:pt-12">
      <div class="grid lg:grid-cols-12 gap-x-10 items-end">
        <div :class="block.image ? 'lg:col-span-8' : 'lg:col-span-12'">
          <p v-if="block.strike" class="strike font-medium text-[1.3rem] md:text-[2rem] lg:text-[2.3rem] tracking-[-0.03em] leading-tight" aria-hidden="true">{{ czText(block.strike) }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-3 lg:mt-4 leading-[0.92] tracking-[-0.05em]" :class="size" data-opening-heading><KitMarked :text="block.heading" /></component>
          <div class="mt-10 lg:mt-12 grid lg:grid-cols-8 gap-x-10 gap-y-10 items-start pb-10 lg:pb-16">
            <div class="lg:col-span-5">
              <p v-if="block.text" class="text-[1.2rem] lg:text-[1.3rem] leading-[1.4] font-medium max-w-[32rem]">{{ czText(block.text) }}</p>
              <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
                <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></NuxtLink>
                <span v-if="block.note" class="mono">{{ czText(block.note) }}</span>
              </div>
            </div>
            <dl v-if="facts.length" class="lg:col-span-3 mono grid grid-cols-2 lg:grid-cols-1 gap-x-6">
              <div v-for="(fact, i) in facts" :key="i" class="py-3 border-t-2 border-ink" :class="i === 2 && facts.length === 3 ? 'col-span-2 lg:col-span-1' : ''">
                <dt class="opacity-75">{{ fact.label }}</dt>
                <dd class="font-display normal-case tracking-[-0.02em] text-[1.25rem] font-extrabold mt-1">{{ czText(fact.value) }}</dd>
              </div>
            </dl>
          </div>
        </div>
        <figure v-if="block.image" class="lg:col-span-4">
          <div class="duo aspect-[4/5]"><CmsImage :media="block.image" eager sizes="(min-width: 1024px) 30rem, 100vw" /></div>
        </figure>
      </div>
    </div>
  </section>
</template>
