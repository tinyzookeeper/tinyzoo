<script setup lang="ts">
// Lhůty's kinds of clients: on a tinted band, a row of cells divided by rules, each with a large
// mono figure (how many clients of that kind), a name and a line.
const props = defineProps<{ block: BlockOf<'audience'>; first?: boolean; anchor?: string }>()
const COLUMNS = ['', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-3', 'lg:grid-cols-3']
const columns = computed(() => COLUMNS[props.block.items.length] ?? 'lg:grid-cols-3')
// A cell's rules and padding by its place in the row.
const cell = (i: number, n: number) => (i === 0 ? 'border-b border-line py-6 sm:pr-8 lg:border-b-0 lg:border-r lg:py-7' : i === n - 1 ? 'py-6 lg:py-7 lg:pl-8' : 'border-b border-line py-6 sm:pr-8 lg:border-b-0 lg:border-r lg:px-8 lg:py-7')
</script>

<template>
  <section :id="anchor" class="bg-tint">
    <div class="wrap py-14 lg:py-20">
      <div class="grid gap-6 lg:grid-cols-12 lg:gap-12">
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[30px] leading-[1.15] sm:text-[38px] lg:col-span-5"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="max-w-[56ch] self-end text-[16.5px] leading-[1.6] text-ink/85 lg:col-span-7">{{ tidyText(block.text) }}</p>
      </div>
      <ul class="mt-10 grid border-t border-ink sm:grid-cols-2" :class="columns">
        <li v-for="(item, i) in block.items" :key="item.id" :class="cell(i, block.items.length)">
          <p v-if="item.count" class="num text-[44px] leading-none">{{ item.count }}</p>
          <h3 class="text-[18px] font-semibold" :class="item.count ? 'mt-3' : ''">{{ tidyText(item.title) }}</h3>
          <p v-if="item.text" class="mt-2 text-[15px] leading-[1.55] text-ink/85">{{ tidyText(item.text) }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
