<script setup lang="ts">
defineProps<{ block: BlockOf<'steps'>; first?: boolean }>()
</script>

<template>
  <section class="wrap py-20 md:py-28">
    <p v-if="block.eyebrow" class="hand text-brand text-[1.8rem] md:text-[2rem] -rotate-1 origin-left mb-3">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="text-[2.3rem] md:text-[3.3rem] leading-[1.08] mb-10 md:mb-14"><KitMarked :text="block.heading" plain /></component>
    <ol class="grid sm:grid-cols-2 gap-x-8 gap-y-10" :class="block.items.length === 3 ? 'lg:grid-cols-3' : block.items.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'">
      <li v-for="(s, i) in block.items" :key="s.id">
        <div class="flex items-center gap-4">
          <span class="hand text-brand text-[4rem] leading-[0.8]">{{ i + 1 }}</span>
          <span v-if="i < block.items.length - 1" class="hidden lg:block flex-1 border-t-2 border-dashed border-[var(--edge)]" />
        </div>
        <h3 class="text-[1.45rem] leading-tight mt-4">{{ tidyText(s.title) }}</h3>
        <p v-if="s.text" class="mt-2">{{ tidyText(s.text) }}</p>
      </li>
    </ol>
  </section>
</template>
