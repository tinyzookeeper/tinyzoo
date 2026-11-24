<script setup lang="ts">
// Zvýrazňovač's about: the heading and the story in two columns with a heavy ruled list under
// them, and a black-and-white photograph on the right.
const props = defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string }>()
const size = computed(() => byLength(props.block.heading, [
  [40, 'text-[2.9rem] md:text-[4.5rem] lg:text-[5.2rem]'],
  [64, 'text-[2.5rem] md:text-[3.6rem] lg:text-[4.2rem]'],
], 'text-[2.2rem] md:text-[3rem] lg:text-[3.4rem]'))
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-28">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10 items-start">
      <div :class="block.image ? 'lg:col-span-7' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="mono text-quiet">{{ czText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 tracking-[-0.05em]" :class="size"><KitMarked :text="block.heading" /></component>
        <div v-if="block.text" class="mt-9 grid md:grid-cols-2 gap-x-10 gap-y-5 text-[1.05rem]">
          <p v-for="(para, i) in paragraphs(block.text)" :key="i">{{ czText(para) }}</p>
        </div>
        <dl v-if="block.timeline.length" class="mt-10 border-b-2 border-ink">
          <div v-for="(line, i) in block.timeline" :key="i" class="grid grid-cols-[7rem_1fr] md:grid-cols-[10rem_1fr] gap-x-4 py-4 items-baseline" :class="i ? 'border-t border-ink/25' : 'border-t-2 border-ink'">
            <dt class="mono text-quiet">{{ czText(line.when) }}</dt><dd class="font-semibold">{{ czText(line.text) }}</dd>
          </div>
        </dl>
      </div>
      <figure v-if="block.image" class="lg:col-span-4 lg:col-start-9">
        <div class="bw aspect-[4/5]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 26rem, 100vw" /></div>
        <figcaption v-if="block.imageCaption" class="mono text-quiet mt-3">{{ czText(block.imageCaption) }}</figcaption>
      </figure>
    </div>
  </section>
</template>
