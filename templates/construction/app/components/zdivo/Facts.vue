<script setup lang="ts">
// Zdivo's facts: a wall of bricks in a running bond, a fact on each; a dark brick leads to the
// enquiry. When the facts follow the opening they stand right under its photograph, as the
// opening's own two courses. (A phone's wall has four columns, a desktop's twenty-four: the
// half bricks of one are hidden on the other.)
const props = defineProps<{ block: BlockOf<'facts'>; first?: boolean; afterHero?: boolean }>()
const hasCta = computed(() => !!props.block.ctaLabel && !!props.block.ctaUrl)
const layout = computed(() => bond(props.block.items.length, hasCta.value, true))
</script>

<template>
  <section class="wrap" :class="afterHero ? 'pb-16 lg:pb-24' : 'py-16 lg:py-24'">
    <div v-if="block.heading || block.text" class="mb-8 flex flex-wrap items-end justify-between gap-6">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="h2"><KitMarked :text="block.heading" as="span" /></component>
      <p v-if="block.text" class="max-w-[26em] leading-[1.5]">{{ tidyText(block.text) }}</p>
    </div>
    <div class="wall" :class="afterHero ? 'mt-2' : ''" role="list">
      <template v-for="(cell, i) in layout.cells" :key="i">
        <div v-if="cell.kind === 'item'" class="brick col-span-2 lg:col-span-6" :class="brickTone(cell.index)" role="listitem"><b>{{ block.items[cell.index]!.figure }}</b><span>{{ block.items[cell.index]!.text }}</span></div>
        <NuxtLink v-else-if="cell.kind === 'cta'" :to="siteHref(block.ctaUrl)" class="brick order-last col-span-4 !flex-row items-center !justify-between bg-ink text-plaster transition-colors hover:bg-brand-d lg:order-none lg:col-span-6"><span class="!mt-0 font-display !text-[26px] !font-bold !leading-[1.02] lg:!text-[28px]">{{ block.ctaLabel }}</span><UIcon name="i-lucide-arrow-right" class="size-6" aria-hidden="true" /></NuxtLink>
        <div v-else-if="cell.kind === 'mb'" class="brick t3 col-span-1 lg:hidden" aria-hidden="true" />
        <div v-else-if="cell.kind === 'db'" class="brick t3 hidden lg:col-span-3 lg:flex" aria-hidden="true" />
        <div v-else-if="cell.kind === 'padm'" class="brick t3 col-span-2 lg:hidden" aria-hidden="true" />
        <div v-else class="brick t3 hidden lg:col-span-6 lg:flex" aria-hidden="true" />
      </template>
    </div>
  </section>
</template>
