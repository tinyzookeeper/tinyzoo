<script setup lang="ts">
// Vizitka's about: a photograph on the left, the story in a narrow column and a ruled, dated
// list under it.
defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string }>()
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-28">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <figure v-if="block.image" class="lg:col-span-4">
        <div class="ph aspect-[4/5]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 26rem, 100vw" /></div>
        <figcaption v-if="block.imageCaption" class="mt-3 text-[0.9rem] text-quiet">{{ czText(block.imageCaption) }}</figcaption>
      </figure>
      <div :class="block.image ? 'lg:col-span-7 lg:col-start-6' : 'lg:col-span-8 lg:col-start-3'">
        <p v-if="block.eyebrow" class="label text-brand">{{ czText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.1rem] md:text-[2.75rem] leading-[1.12]"><KitMarked :text="block.heading" /></component>
        <div v-if="block.text" class="mt-7 space-y-5 max-w-[38rem]">
          <p v-for="(para, i) in paragraphs(block.text)" :key="i">{{ czText(para) }}</p>
        </div>
        <dl v-if="block.timeline.length" class="mt-10 border-t border-ink">
          <div v-for="(line, i) in block.timeline" :key="i" class="grid grid-cols-[6.5rem_1fr] md:grid-cols-[9rem_1fr] gap-x-4 py-4 border-b" :class="i === block.timeline.length - 1 ? 'border-ink' : 'border-line'">
            <dt class="label text-quiet pt-1">{{ czText(line.when) }}</dt>
            <dd class="text-ink">{{ czText(line.text) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
