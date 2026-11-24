<script setup lang="ts">
// Šanony's kinds of clients: on the brand colour, a row of columns each under a heavy rule, with
// the starting price of each in heavy type.
const props = defineProps<{ block: BlockOf<'audience'>; first?: boolean; anchor?: string }>()
const COLUMNS = ['', 'xl:grid-cols-1', 'xl:grid-cols-2', 'xl:grid-cols-3', 'xl:grid-cols-4', 'xl:grid-cols-3', 'xl:grid-cols-3']
const columns = computed(() => COLUMNS[props.block.items.length] ?? 'xl:grid-cols-3')
</script>

<template>
  <section :id="anchor" class="on-dark bg-brand text-brand-ink">
    <div class="wrap py-16 lg:py-24">
      <component :is="first ? 'h1' : 'h2'" class="display" :class="displaySize(block.heading)"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-soft' }" /></component>
      <p v-if="block.text" class="mt-6 max-w-[56ch] text-[17px] leading-[1.55]">{{ tidyText(block.text) }}</p>
      <ul class="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:mt-14" :class="columns">
        <li v-for="item in block.items" :key="item.id" class="border-t-4 border-brand-ink pt-5">
          <h3 class="font-display text-[30px] font-bold leading-none tracking-[-0.02em]">{{ tidyText(item.title) }}</h3>
          <p v-if="item.text" class="mt-3 text-[16px] leading-[1.5]">{{ tidyText(item.text) }}</p>
          <p v-if="item.from" class="mt-4 font-display text-[19px] font-bold">{{ tidyText(item.from) }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
