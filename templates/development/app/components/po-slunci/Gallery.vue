<script setup lang="ts">
// Po slunci's gallery: rounded photographs with their captions on a white pill, in a pattern of
// wide and narrow ones (seven, five, five, seven columns of twelve), two to a row on a phone.
const props = defineProps<{ block: BlockOf<'gallery'>; first?: boolean; anchor?: string }>()
const PATTERN = [
  { span: 'col-span-2 lg:col-span-7', shape: 'aspect-[3/2]', sizes: '(min-width: 1024px) 46rem, 100vw' },
  { span: 'lg:col-span-5', shape: 'aspect-[4/5]', sizes: '(min-width: 1024px) 32rem, 50vw' },
  { span: 'lg:col-span-5', shape: 'aspect-[4/5]', sizes: '(min-width: 1024px) 32rem, 50vw' },
  { span: 'col-span-2 lg:col-span-7', shape: 'aspect-[3/2]', sizes: '(min-width: 1024px) 46rem, 100vw' },
]
const cells = computed(() => props.block.photos.filter((p) => p.image).map((p, i) => ({ ...p, ...PATTERN[i % PATTERN.length]! })))
</script>

<template>
  <section :id="anchor" class="wrap sec scroll-mt-4">
    <div class="head">
      <div>
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
      </div>
      <p v-if="block.text" class="lead">{{ tidyText(block.text) }}</p>
    </div>
    <div class="gap-head grid grid-cols-2 lg:grid-cols-12 gap-3 lg:gap-5">
      <figure v-for="(c, i) in cells" :key="i" class="relative lg:aspect-auto lg:h-[30rem]" :class="[c.span, c.shape]">
        <CmsImage :media="c.image!" class="photo" :sizes="c.sizes" /><figcaption v-if="c.caption" class="pill-cap">{{ c.caption }}</figcaption>
      </figure>
    </div>
  </section>
</template>
