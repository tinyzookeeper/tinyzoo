<script setup lang="ts">
// Modrotisk's gallery: pictures in print frames laid out in a repeating pattern of wide and
// narrow ones (eight, four, four, eight, six columns of twelve), each numbered by what it is
// (V 1 for a visualisation, F 1 for a photograph) with that beside the large ones. The closing
// sentence and the small print fill the last cell.
const props = defineProps<{ block: BlockOf<'gallery'>; first?: boolean; index?: number; anchor?: string }>()
const words = useSiteWords()
const kindWords = { render: 'Vizualizace', photo: 'Fotografie' }
const codes = { render: 'V', photo: 'F' }
// [columns of twelve, wide caption, the size the picture is shown at]
const PATTERN = [
  { span: 'col-span-2 lg:col-span-8', wide: true, sizes: '(min-width: 1024px) 50rem, 100vw' },
  { span: 'lg:col-span-4 flex flex-col', wide: false, sizes: '(min-width: 1024px) 26rem, 50vw' },
  { span: 'lg:col-span-4 flex flex-col', wide: false, sizes: '(min-width: 1024px) 26rem, 50vw' },
  { span: 'col-span-2 lg:col-span-8', wide: true, sizes: '(min-width: 1024px) 50rem, 100vw' },
  { span: 'col-span-2 lg:col-span-6', wide: true, sizes: '(min-width: 1024px) 38rem, 100vw' },
]
const cells = computed(() => {
  const count = { render: 0, photo: 0 }
  return props.block.photos.filter((p) => p.image).map((p, i) => {
    const kind = p.kind ?? 'render'
    count[kind] += 1
    return { ...p, ...PATTERN[i % PATTERN.length]!, code: `${codes[kind]} ${count[kind]}`, kindWord: kindWords[kind] }
  })
})
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 flex flex-wrap items-end justify-between gap-5">
      <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
    </div>
    <div class="mt-10 grid grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6">
      <figure v-for="(c, i) in cells" :key="i" :class="c.span">
        <div class="frame" :class="c.wide ? 'aspect-[3/2]' : 'aspect-[4/5] lg:aspect-auto lg:flex-1 lg:min-h-0'"><CmsImage :media="c.image!" :sizes="c.sizes" /></div>
        <figcaption class="cap"><span>{{ c.code }}<template v-if="c.caption"> · {{ c.caption }}</template></span><span v-if="c.wide">{{ c.kindWord }}</span></figcaption>
      </figure>
      <div v-if="block.text || block.note" class="col-span-2 lg:col-span-6 flex flex-col justify-end pb-9">
        <p v-if="block.text" class="font-display font-light text-[1.7rem] leading-[1.25] tracking-tight max-w-[26rem]">{{ tidyText(block.text) }}</p>
        <p v-if="block.note" class="mt-4 text-quiet max-w-[26rem]">{{ tidyText(block.note) }}</p>
      </div>
    </div>
  </section>
</template>
