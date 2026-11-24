<script setup lang="ts">
// Lhůty's opening: a ruler-mark line, the heading, a text and one button, beside a framed
// photograph of a consultation with a two-part caption.
import type { Service, ServiceGroup } from '../../lib/cms-content'

// (the shelf of services is Šanony's)
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; groups: ServiceGroup[]; services: Service[] }>()
// The heading steps down when an owner's sentence is much longer than the design's.
const size = computed(() => byLength(props.block.heading, [
  [70, 'text-[38px] leading-[1.1] sm:text-[48px] xl:text-[58px] xl:leading-[1.08]'],
  [110, 'text-[34px] leading-[1.12] sm:text-[40px] xl:text-[46px] xl:leading-[1.1]'],
], 'text-[30px] leading-[1.15] sm:text-[34px] xl:text-[38px]'))
const noteLines = computed(() => (props.block.note ?? '').split('\n').map((l) => l.trim()).filter(Boolean))
</script>

<template>
  <section :id="anchor" class="wrap grid gap-10 pt-10 pb-12 lg:grid-cols-12 lg:gap-12 lg:pt-11 lg:pb-11">
    <div class="lg:col-span-7">
      <p v-if="block.eyebrow" class="label text-quiet"><span class="ticks" />{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-6 font-display tracking-[-0.01em]" :class="size"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="mt-6 max-w-[58ch] text-[18px] leading-[1.6] text-ink/85">{{ tidyText(block.text) }}</p>
      <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
        <SiteLink v-if="block.primaryLabel && block.primaryUrl" :to="block.primaryUrl" class="btn btn-brand">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></SiteLink>
        <p v-if="noteLines.length" class="text-[14.5px] leading-[1.45] text-quiet"><template v-for="(line, i) in noteLines" :key="i"><br v-if="i">{{ tidyText(line) }}</template></p>
      </div>
    </div>
    <figure v-if="block.image" class="lg:col-span-5">
      <CmsImage :media="block.image" eager sizes="(min-width: 1280px) 31rem, (min-width: 1024px) 40vw, 100vw" class="aspect-[4/3] w-full object-cover" />
      <figcaption v-if="block.imageCaption || block.imageCaptionNote" class="mt-3 flex items-baseline justify-between gap-4 font-mono text-[12px] text-quiet"><span>{{ block.imageCaption }}</span><span>{{ block.imageCaptionNote }}</span></figcaption>
    </figure>
  </section>
</template>
