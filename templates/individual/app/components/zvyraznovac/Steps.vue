<script setup lang="ts">
// Zvýrazňovač's steps: a full-bleed photograph printed in the brand colour, then the steps in
// columns, each with its step number and when it happens.
const props = defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
const words = useSiteWords()
const size = computed(() => byLength(props.block.heading, [
  [40, 'text-[2.9rem] md:text-[4.5rem] lg:text-[5.6rem]'],
  [64, 'text-[2.5rem] md:text-[3.6rem] lg:text-[4.4rem]'],
], 'text-[2.2rem] md:text-[3rem] lg:text-[3.6rem]'))
</script>

<template>
  <section :id="anchor">
    <!-- (the wide crop of a landscape photograph: as wide as the screen) -->
    <figure v-if="block.image" class="duo aspect-[4/3] md:aspect-[21/9] lg:max-h-[620px] w-full"><CmsImage :media="block.image" sizes="100vw" class="w-full h-full object-cover" /></figure>
    <div class="wrap py-20 lg:py-28">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
        <component :is="first ? 'h1' : 'h2'" class="lg:col-span-8 tracking-[-0.05em]" :class="size"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="lg:col-span-4 text-[1.1rem] max-w-[26rem] lg:pb-3">{{ czText(block.text) }}</p>
      </div>
      <ol class="mt-12 lg:mt-16 grid sm:grid-cols-2 gap-x-10 gap-y-10" :class="block.items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'">
        <li v-for="(step, i) in block.items" :key="i" class="border-t-2 border-ink pt-5">
          <p class="mono text-quiet">{{ words.stepOf(i + 1) }}<template v-if="step.when"> · {{ czText(step.when) }}</template></p>
          <h3 class="mt-4 text-[1.6rem] font-extrabold tracking-[-0.035em]">{{ czText(step.title) }}</h3>
          <p class="mt-3">{{ czText(step.text) }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>
