<script setup lang="ts">
defineProps<{ block: BlockOf<'steps'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-20 md:py-28">
    <div class="mb-10 md:mb-14">
      <p v-if="block.eyebrow" class="label text-quiet mb-3">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="text-[2.4rem] md:text-[3.4rem] leading-none"><KitMarked :text="block.heading" /></component>
    </div>
    <ol class="grid sm:grid-cols-2 gap-x-8 gap-y-9" :class="block.items.length === 3 ? 'lg:grid-cols-3' : block.items.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'">
      <li v-for="(s, i) in block.items" :key="s.id" class="border-t border-ink pt-5">
        <span class="font-display italic text-brand text-[2.4rem] leading-none">{{ i + 1 }}</span>
        <h3 class="text-[1.5rem] leading-tight mt-3 !font-normal">{{ tidyText(s.title) }}</h3>
        <p v-if="s.text" class="mt-2">{{ tidyText(s.text) }}</p>
      </li>
    </ol>
  </section>
</template>
