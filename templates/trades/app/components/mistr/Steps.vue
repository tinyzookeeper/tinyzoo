<script setup lang="ts">
// Mistr's steps: numbered columns, each under a heavy rule.
defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-28 scroll-mt-20">
    <div class="max-w-[40rem]">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="serif mt-4">{{ tidyText(block.text) }}</p>
    </div>
    <ol class="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
      <li v-for="(step, i) in block.items" :key="step.id" class="border-t-2 border-ink pt-5">
        <p class="text-brand text-[0.9375rem] font-bold tabular-nums">{{ i + 1 }}</p>
        <h3 class="mt-2 text-[1.25rem] leading-[1.25]">{{ tidyText(step.title) }}</h3>
        <p class="mt-2.5 text-[0.9375rem]">{{ tidyText(step.text) }}</p>
      </li>
    </ol>
  </section>
</template>
