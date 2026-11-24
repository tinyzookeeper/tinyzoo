<script setup lang="ts">
// Vizitka's steps: a numbered, ruled list on the right and the heading with one photograph
// on the left.
defineProps<{ block: BlockOf<'steps'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-28">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-12">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label text-brand">{{ czText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.1rem] md:text-[2.75rem] leading-[1.12]"><KitMarked :text="block.heading" /></component>
        <figure v-if="block.image" class="mt-9">
          <div class="ph aspect-[4/3]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 34rem, 100vw" /></div>
          <figcaption v-if="block.imageCaption" class="mt-3 text-[0.9rem] text-quiet">{{ czText(block.imageCaption) }}</figcaption>
        </figure>
      </div>
      <ol class="lg:col-span-6 lg:col-start-7 border-t border-ink">
        <li v-for="(step, i) in block.items" :key="i" class="grid grid-cols-[3.25rem_1fr] md:grid-cols-[5rem_1fr] gap-x-4 py-7 lg:py-8 border-b" :class="i === block.items.length - 1 ? 'border-ink' : 'border-line'">
          <span class="serif text-brand text-[2.5rem] md:text-[3rem] leading-[0.9] font-normal" aria-hidden="true">{{ i + 1 }}</span>
          <div>
            <h3 class="text-[1.4rem] leading-[1.2]">{{ czText(step.title) }}</h3>
            <p class="mt-2">{{ czText(step.text) }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
