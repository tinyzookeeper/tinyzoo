<script setup lang="ts">
// Výkres's facts: set like the title block of a drawing, one framed cell per fact between
// heavy rules.
const props = defineProps<{ block: BlockOf<'facts'>; first?: boolean; afterHero?: boolean }>()
// (whole class names, so the stylesheet finds them)
const COLUMNS: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7', 8: 'lg:grid-cols-4' }
const columns = computed(() => COLUMNS[props.block.items.length] ?? 'lg:grid-cols-5')
</script>

<template>
  <section class="wrap">
    <div v-if="block.heading || block.text" class="mb-8 grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-8">
      <component :is="first ? 'h1' : 'h2'" v-if="block.heading" class="font-display text-[32px] font-light leading-tight tracking-[-.02em] text-ink sm:text-[42px] lg:col-span-5"><KitMarked :text="block.heading" as="span" /></component>
      <p v-if="block.text" class="max-w-[36em] leading-[1.65] lg:col-span-6 lg:col-start-7">{{ tidyText(block.text) }}</p>
    </div>
    <dl class="grid grid-cols-2 gap-px border-2 border-ink bg-ink" :class="columns">
      <div v-for="(item, i) in block.items" :key="i" class="bg-card p-4 sm:p-5" :class="block.items.length % 2 === 1 && i === block.items.length - 1 ? 'col-span-2 lg:col-span-1' : ''">
        <dt class="lab">{{ item.label }}</dt>
        <dd class="mt-3"><span class="block whitespace-nowrap font-display text-[24px] font-light leading-none tracking-[-.02em] text-ink sm:text-[30px]">{{ item.figure }}</span><span class="mt-3 block text-sm leading-relaxed">{{ tidyText(item.text) }}</span></dd>
      </div>
    </dl>
  </section>
</template>
