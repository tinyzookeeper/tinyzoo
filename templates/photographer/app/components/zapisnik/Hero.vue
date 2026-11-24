<script setup lang="ts">
// Zápisník's opening: the heading on the left, a few prints laid on the table on the right
// (above the heading on a phone).
const props = defineProps<{ block: BlockOf<'hero'> }>()
const { settings } = await useSite()
const ASPECT = { wide: 'aspect-[3/2]', tall: 'aspect-[4/5]', square: 'aspect-square' }
const prints = computed(() => props.block.images.filter((i) => i.image).slice(0, 3).map((i) => ({ ...i, aspect: ASPECT[shapeOf(i.image).shape] })))
// Where each print lies, by how many there are. With others on top of it the big one has no
// caption: they would cover it.
const LAYOUT: Record<number, Array<{ cls: string; style: Record<string, string> }>> = {
  1: [{ cls: 'tape relative w-[88%] mx-auto', style: { '--r': '2deg', '--tr': '-4deg' } }],
  2: [
    { cls: 'bare tape absolute top-0 right-0 w-[82%]', style: { '--r': '2.5deg', '--tr': '-4deg' } },
    { cls: 'absolute left-0 top-[40%] w-[45%] z-10', style: { '--r': '-4deg' } },
  ],
  3: [
    { cls: 'bare tape absolute top-0 right-0 w-[82%]', style: { '--r': '2.5deg', '--tr': '-4deg' } },
    { cls: 'absolute left-0 top-[40%] w-[45%] z-10', style: { '--r': '-4deg' } },
    { cls: 'tape absolute right-[3%] top-[55%] w-[38%]', style: { '--r': '3.5deg', '--tr': '5deg' } },
  ],
}
const layout = computed(() => LAYOUT[prints.value.length] ?? [])
</script>

<template>
  <section class="wrap grid md:grid-cols-12 gap-x-10 gap-y-9 items-center pt-6 md:pt-8 pb-20 md:pb-28">
    <div :class="prints.length ? 'md:col-span-6' : 'md:col-span-9'">
      <p v-if="block.eyebrow" class="hand text-brand text-[1.9rem] md:text-[2.2rem] -rotate-2 origin-left mb-4">{{ block.eyebrow }}</p>
      <h1 class="text-[2.75rem] md:text-[4.3rem] leading-[1.05]"><KitMarked :text="block.heading" plain /></h1>
      <p v-if="block.text" class="mt-6 text-[1.18rem] max-w-[31rem]">{{ tidyText(block.text) }}</p>
      <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
        <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
        <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="ulink inline-flex items-center min-h-[44px]" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
      </div>
      <p v-if="settings?.availability" class="mt-9 flex items-start gap-3 max-w-[27rem]">
        <svg class="shrink-0 mt-1 text-brand" width="46" height="30" viewBox="0 0 46 30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4c9 16 22 21 40 16" /><path d="M34 13l8 7-10 5" /></svg>
        <span class="hand text-ink text-[1.65rem] leading-[1.05]">{{ tidyText(settings.availability) }}</span>
      </p>
    </div>

    <div v-if="prints.length" class="md:col-span-6 relative md:ml-4 order-first md:order-none mt-3 md:mt-0" :class="prints.length > 1 ? 'aspect-[1/1.04]' : ''">
      <figure v-for="(p, i) in prints" :key="p.id" class="print" :class="layout[i]?.cls" :style="layout[i]?.style">
        <CmsImage :media="p.image" :eager="i === 0" :sizes="i === 0 ? '(min-width: 768px) 34rem, 80vw' : '(min-width: 768px) 16rem, 45vw'" :class="p.aspect" />
        <figcaption v-if="p.caption && !(i === 0 && prints.length > 1)">{{ p.caption }}</figcaption>
      </figure>
    </div>
  </section>
</template>
