<script setup lang="ts">
const props = defineProps<{ block: BlockOf<'about'>; first?: boolean }>()
const paras = computed(() => paragraphs(props.block.text))
</script>

<template>
  <section class="wrap pb-20 md:pb-32">
    <div class="grid md:grid-cols-12 gap-x-10 gap-y-9 items-end border-t border-line pt-10 md:pt-16">
      <figure v-if="block.image" class="md:col-span-5">
        <div class="ph aspect-[4/5]"><CmsImage :media="block.image" sizes="(min-width: 768px) 40vw, 100vw" /></div>
        <figcaption v-if="block.imageCaption" class="pt-3 label text-quiet">{{ block.imageCaption }}</figcaption>
      </figure>
      <div class="md:col-span-6 md:col-start-7 md:pb-10">
        <p v-if="block.eyebrow" class="label text-quiet mb-4">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.2rem] md:text-[3.1rem] leading-[1.08]"><KitMarked :text="block.heading" /></component>
        <div v-if="paras.length" class="mt-7 grid gap-4 max-w-[36rem]">
          <p v-for="(p, i) in paras" :key="i">{{ tidyText(p) }}</p>
        </div>
        <dl v-if="block.facts.length" class="mt-8 max-w-[36rem] border-t border-line">
          <div v-for="f in block.facts" :key="f.id" class="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-4 py-3 border-b border-line">
            <dt class="label text-quiet">{{ f.label }}</dt>
            <dd>{{ tidyText(f.value) }}</dd>
          </div>
        </dl>
        <p v-if="block.signature" class="mt-7 font-display italic text-ink text-[2rem] leading-none">{{ block.signature }}</p>
      </div>
    </div>
  </section>
</template>
