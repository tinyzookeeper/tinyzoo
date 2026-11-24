<script setup lang="ts">
const props = defineProps<{ block: BlockOf<'about'>; first?: boolean }>()
const paras = computed(() => paragraphs(props.block.text))
const size = computed(() => byLength(props.block.heading, [
  [32, 'text-[15vw] md:text-[6.6vw] wide:text-[min(6.6vw,6.6rem)] max-w-[12ch]'],
], 'text-[11vw] md:text-[4.8vw] wide:text-[min(4.8vw,4.8rem)] max-w-[17ch]'))
</script>

<template>
  <section class="grid md:grid-cols-12 gap-x-10 pt-14 md:pt-24">
    <figure v-if="block.image" class="md:col-span-5 relative">
      <div class="aspect-[4/5] overflow-hidden bg-panel"><CmsImage :media="block.image" sizes="(min-width: 768px) 42vw, 100vw" class="w-full h-full object-cover" /></div>
      <figcaption v-if="block.imageCaption" class="pad m text-dim pt-2.5">{{ block.imageCaption }}</figcaption>
    </figure>
    <div class="pad md:pl-0 pt-9 md:pt-0 flex flex-col" :class="block.image ? 'md:col-span-7' : 'md:col-span-12 md:pl-10'">
      <p v-if="block.eyebrow" class="m text-brand mb-4">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="d" :class="size"><KitMarked :text="block.heading" plain /></component>
      <div v-if="paras.length" class="mt-7 md:mt-9 grid md:grid-cols-2 gap-x-8 gap-y-4 max-w-[46rem]">
        <p v-for="(p, i) in paras" :key="i">{{ tidyText(p) }}</p>
      </div>
      <p v-if="block.signature" class="m text-dim mt-6">— {{ block.signature }}</p>
      <dl v-if="block.facts.length" class="m mt-9 md:mt-auto md:pt-9 grid grid-cols-[8.5rem_1fr] md:max-w-[34rem]">
        <template v-for="(f, i) in block.facts" :key="f.id">
          <dt class="py-2.5 border-b border-rule text-dim" :class="i === 0 ? 'border-t' : ''">{{ f.label }}</dt>
          <dd class="py-2.5 border-b border-rule" :class="i === 0 ? 'border-t' : ''">{{ f.value }}</dd>
        </template>
      </dl>
    </div>
  </section>
</template>
