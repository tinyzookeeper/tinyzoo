<script setup lang="ts">
// Kontrolky's workshop: two large photographs, the first wider, a caption under each.
defineProps<{ block: BlockOf<'workshop'>; first?: boolean }>()
const span = ['md:col-span-8', 'md:col-span-4', 'md:col-span-4', 'md:col-span-8']
</script>

<template>
  <section class="wrap py-16 lg:py-24">
    <div class="grid md:grid-cols-12 gap-5 lg:gap-6">
      <figure v-for="(p, i) in block.photos.filter((x) => x.image)" :key="p.id" :class="span[i % 4]">
        <CmsImage :media="p.image!" sizes="(min-width: 768px) 60vw, 100vw" class="w-full aspect-[3/2] md:aspect-auto md:h-[460px] object-cover rounded-[22px]" />
        <figcaption class="mt-4 text-[16px] text-quiet"><span v-if="p.lead" class="text-text font-medium">{{ p.lead }}</span><template v-if="p.lead && p.text">{{ ' ' }}</template>{{ p.text }}</figcaption>
      </figure>
    </div>
  </section>
</template>
