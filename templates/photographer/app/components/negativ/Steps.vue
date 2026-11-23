<script setup lang="ts">
defineProps<{ block: BlockOf<'steps'>; first?: boolean }>()
const no = (i: number) => String(i + 1).padStart(2, '0')
</script>

<template>
  <section class="pad pt-14 md:pt-24 pb-14 md:pb-24">
    <div class="flex items-baseline justify-between gap-6 m text-dim mb-4">
      <component :is="first ? 'h1' : 'h2'"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.eyebrow">{{ block.eyebrow }}</p>
    </div>
    <ol class="cells grid sm:grid-cols-2 border-t border-rule" :class="block.items.length === 3 ? 'wide:grid-cols-3' : block.items.length >= 5 ? 'wide:grid-cols-5' : 'wide:grid-cols-4'">
      <li v-for="(s, i) in block.items" :key="s.id">
        <span class="m text-brand">{{ no(i) }}</span>
        <h3 class="d text-[2.6rem] md:text-[3rem] mt-3">{{ s.title }}</h3>
        <p v-if="s.text" class="mt-3 text-dim max-w-[22rem]">{{ tidyText(s.text) }}</p>
      </li>
    </ol>
  </section>
</template>
