<script setup lang="ts">
const props = defineProps<{ block: BlockOf<'about'>; first?: boolean }>()
const paras = computed(() => paragraphs(props.block.text))
</script>

<template>
  <section class="wrap py-20 md:py-28">
    <div class="grid md:grid-cols-12 gap-x-10 gap-y-12 items-center">
      <div v-if="block.image" class="md:col-span-5 px-3 md:px-0">
        <figure class="print tape" :class="block.imageCaption ? '' : 'bare'" style="--r:-2.5deg; --tr:3deg">
          <CmsImage :media="block.image" sizes="(min-width: 768px) 28rem, 90vw" class="aspect-[4/5]" />
          <figcaption v-if="block.imageCaption">{{ block.imageCaption }}</figcaption>
        </figure>
      </div>
      <div :class="block.image ? 'md:col-span-6 md:col-start-7' : 'md:col-span-8'">
        <p v-if="block.eyebrow" class="hand text-brand text-[1.8rem] md:text-[2rem] -rotate-1 origin-left mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.3rem] md:text-[3.3rem] leading-[1.08]"><KitMarked :text="block.heading" plain /></component>
        <div v-if="paras.length" class="mt-6 grid gap-4 max-w-[35rem]">
          <p v-for="(p, i) in paras" :key="i">{{ tidyText(p) }}</p>
        </div>
        <ul v-if="block.facts.length" class="mt-8 grid gap-0 max-w-[35rem] border-t-[1.5px] border-dashed border-[var(--edge)]">
          <li v-for="f in block.facts" :key="f.id" class="flex gap-4 items-baseline py-3 border-b-[1.5px] border-dashed border-[var(--edge)]">
            <span class="hand text-brand text-[1.6rem] w-[5.5rem] shrink-0">{{ f.label }}</span><span>{{ tidyText(f.value) }}</span>
          </li>
        </ul>
        <p v-if="block.signature" class="hand text-ink text-[2.4rem] mt-7 -rotate-2 origin-left">{{ block.signature }}</p>
      </div>
    </div>
  </section>
</template>
