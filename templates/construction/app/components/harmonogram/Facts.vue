<script setup lang="ts">
// Harmonogram's facts: one light slab on the graphite page, "black on white": a large figure
// and a few words in each cell of a ruled grid.
defineProps<{ block: BlockOf<'facts'>; first?: boolean; afterHero?: boolean }>()
</script>

<template>
  <section class="mt-20 bg-paper py-16 text-ink lg:mt-28 lg:py-24" :aria-labelledby="block.heading ? 'facts-heading' : undefined">
    <div class="wrap">
      <div v-if="block.heading || block.text" class="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
        <component
          :is="first ? 'h1' : 'h2'" v-if="block.heading" id="facts-heading" class="font-extrabold lg:col-span-7"
          :class="byLength(block.heading, [[18, 'text-[48px] leading-[.92] tracking-[-.045em] sm:text-[84px]']], 'text-[40px] leading-[.95] tracking-[-.04em] sm:text-[64px]')"
        ><KitMarked :text="block.heading" as="span" /></component>
        <p v-if="block.text" class="max-w-[30em] text-[17px] leading-[1.6] lg:col-span-5">{{ tidyText(block.text) }}</p>
      </div>
      <dl class="grid border-l border-t border-ink sm:grid-cols-2 lg:grid-cols-3" :class="block.heading || block.text ? 'mt-12' : ''">
        <div v-for="(item, i) in block.items" :key="i" class="border-b border-r border-ink p-6 sm:p-8">
          <dt class="font-mono text-[12.5px] font-medium uppercase tracking-[.06em]">{{ item.label }}</dt>
          <dd class="mt-4"><span class="block text-[52px] font-extrabold leading-none tracking-[-.045em] sm:text-[64px]" :class="item.figure.length > 8 ? 'whitespace-nowrap sm:tracking-[-.06em] lg:tracking-[-.045em]' : ''">{{ item.figure }}</span><span class="mt-4 block leading-[1.55]">{{ tidyText(item.text) }}</span></dd>
        </div>
      </dl>
    </div>
  </section>
</template>
