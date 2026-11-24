<script setup lang="ts">
// Zápisník's story of one day: a diary page. Prints in two staggered columns, each with its
// time in handwriting.
const props = defineProps<{ block: BlockOf<'story'>; first?: boolean }>()
const ASPECT = { wide: 'aspect-[3/2]', tall: 'aspect-[4/5]', square: 'aspect-square' }
// A print's width follows its shape (a tall one is narrower), its place and turn follow its
// position in the row: six settings, taken in turn.
const WIDTH = { wide: '', tall: 'md:w-[68%]', square: 'md:w-[78%]' }
const PLACE = ['', 'md:mt-28', 'md:ml-auto md:mt-4', 'md:mt-16', 'md:-mt-16', 'md:mt-12']
const TURN = [
  { tape: false, style: { '--r': '-2deg' } },
  { tape: true, style: { '--r': '1.5deg' } },
  { tape: true, style: { '--r': '2deg', '--tr': '4deg' } },
  { tape: false, style: { '--r': '-1.5deg' } },
  { tape: false, style: { '--r': '-1deg' } },
  { tape: true, style: { '--r': '1.5deg', '--tr': '-5deg' } },
]
const photos = computed(() => props.block.photos.filter((p) => p.image).map((p, i) => {
  const { shape } = shapeOf(p.image)
  return { ...p, aspect: ASPECT[shape], li: `${WIDTH[shape]} ${PLACE[i % 6]}`, turn: TURN[i % 6]! }
}))
</script>

<template>
  <section class="wrap pb-20 md:pb-32">
    <div class="max-w-[46rem] mb-10 md:mb-14">
      <p v-if="block.eyebrow" class="hand text-brand text-[1.8rem] md:text-[2rem] -rotate-1 origin-left mb-3">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="text-[2.4rem] md:text-[3.6rem] leading-[1.06]"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.facts.length" class="mt-4 font-bold text-ink">{{ block.facts.map((f) => tidyText(f.value)).join(' · ') }}</p>
      <p v-if="block.text" class="mt-5 max-w-[36rem]">{{ tidyText(block.text) }}</p>
    </div>

    <ol class="grid md:grid-cols-2 gap-x-16 gap-y-12 md:gap-y-4 items-start">
      <li v-for="p in photos" :key="p.id" :class="p.li">
        <figure class="print bare" :class="p.turn.tape ? 'tape' : ''" :style="p.turn.style"><CmsImage :media="p.image" sizes="(min-width: 768px) 34rem, 92vw" :class="p.aspect" /></figure>
        <p class="mt-5 flex gap-4 items-baseline"><span v-if="p.time" class="hand text-brand text-[2.2rem] shrink-0">{{ p.time }}</span><span>{{ tidyText(p.caption) }}</span></p>
      </li>
    </ol>

    <p v-if="block.closing" class="mt-12 md:mt-16 max-w-[36rem]">{{ tidyText(block.closing) }}</p>
    <p v-if="block.buttonLabel && block.buttonUrl" :class="block.closing ? 'mt-6' : 'mt-12 md:mt-16'">
      <NuxtLink class="btn btn-line" :to="siteHref(block.buttonUrl)">{{ block.buttonLabel }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></NuxtLink>
    </p>
  </section>
</template>
