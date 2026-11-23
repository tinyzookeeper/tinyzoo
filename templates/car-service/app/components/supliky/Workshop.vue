<script setup lang="ts">
// Šuplíky's workshop: two large photographs side by side; the captions follow under them.
defineProps<{ block: BlockOf<'workshop'>; first?: boolean }>()
const span = ['md:col-span-7', 'md:col-span-5', 'md:col-span-5', 'md:col-span-7']
</script>

<template>
  <section class="wrap pb-16 lg:pb-24">
    <div class="grid md:grid-cols-12 gap-4 sm:gap-6">
      <figure v-for="(p, i) in block.photos.filter((x) => x.image)" :key="p.id" :class="span[i % 4]">
        <CmsImage :media="p.image!" sizes="(min-width: 768px) 60vw, 100vw" class="w-full aspect-[3/2] md:aspect-auto md:h-[440px] object-cover rounded-[28px]" />
      </figure>
      <p v-for="(p, i) in block.photos.filter((x) => x.image)" :key="`c${p.id}`" class="text-[16px] text-quiet md:-mt-2" :class="span[i % 4]"><b v-if="p.lead" class="font-semibold text-ink">{{ p.lead }}</b><template v-if="p.lead && p.text">{{ ' ' }}</template>{{ p.text }}</p>
    </div>
  </section>
</template>
