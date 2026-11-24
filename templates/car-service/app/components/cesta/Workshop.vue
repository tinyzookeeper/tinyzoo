<script setup lang="ts">
// Cesta's workshop: two large photographs side by side, a caption under each.
defineProps<{ block: BlockOf<'workshop'>; first?: boolean }>()
// (the first photograph is wider than the second, the next pair the other way round)
const span = ['md:col-span-7', 'md:col-span-5', 'md:col-span-5', 'md:col-span-7']
</script>

<template>
  <section class="wrap pb-16 lg:pb-24">
    <div class="grid md:grid-cols-12 gap-5 lg:gap-6">
      <figure v-for="(p, i) in block.photos.filter((x) => x.image)" :key="p.id" :class="span[i % 4]">
        <CmsImage :media="p.image!" sizes="(min-width: 768px) 50vw, 100vw" class="w-full aspect-[3/2] md:aspect-auto md:h-[480px] object-cover rounded-[28px]" />
        <figcaption class="mt-4 text-[17px] text-quiet"><span v-if="p.lead" class="font-display font-bold text-ink">{{ p.lead }}</span><template v-if="p.lead && p.text">{{ ' ' }}</template>{{ p.text }}</figcaption>
      </figure>
    </div>
  </section>
</template>
