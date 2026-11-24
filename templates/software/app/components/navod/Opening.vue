<script setup lang="ts">
// Návod's opening: the heading, the text and the button beside the first figure, a screen of the
// product with numbered pins and the notes that explain them.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string }>()
const words = useSiteWords()
const hasFigure = computed(() => !!props.block.image || props.block.screen !== 'none')
</script>

<template>
  <section :id="anchor" class="wrap grid gap-10 pb-16 pt-10 lg:grid-cols-12 lg:gap-12 lg:pb-24 lg:pt-16">
    <div :class="hasFigure ? 'lg:col-span-5' : 'lg:col-span-8'">
      <p v-if="block.eyebrow" class="label text-quiet">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[52px] lg:text-[58px]"><KitMarked :text="block.heading" /></component>
      <p v-if="block.text" class="mt-6 max-w-[34rem] text-[18px] leading-[1.6]"><KitMarked :text="block.text" as="b" :attrs="{ class: 'font-semibold text-ink' }" /></p>
      <div v-if="(block.primaryLabel && block.primaryUrl) || (block.secondaryLabel && block.secondaryUrl)" class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <SiteLink v-if="block.primaryLabel && block.primaryUrl" class="btn btn-main" :to="block.primaryUrl">{{ tidyText(block.primaryLabel) }} <UIcon name="i-lucide-arrow-right" class="size-[18px]" aria-hidden="true" /></SiteLink>
        <SiteLink v-if="block.secondaryLabel && block.secondaryUrl" class="link text-[16px] font-medium text-ink" :to="block.secondaryUrl">{{ tidyText(block.secondaryLabel) }}</SiteLink>
      </div>
      <p v-if="block.note" class="mt-4 text-[15px] text-quiet">{{ tidyText(block.note) }}</p>
      <dl v-if="block.facts.length" class="mt-10 grid grid-cols-3 border-t border-ink/15 text-[14px] leading-snug">
        <div v-for="(fact, i) in block.facts" :key="i" class="py-4" :class="[i < block.facts.length - 1 ? 'border-r border-ink/15' : '', i === 0 ? 'pr-3' : i === block.facts.length - 1 ? 'pl-3' : 'px-3']">
          <dt class="label !text-[11px] text-quiet">{{ fact.label }}</dt><dd class="mt-1.5 font-medium text-ink">{{ tidyText(fact.value) }}</dd>
        </div>
      </dl>
    </div>

    <figure v-if="hasFigure" class="lg:col-span-7">
      <NavodScreen :kind="block.screen" :image="block.image" />
      <figcaption v-if="block.caption" class="mt-3 font-mono text-[12px] text-quiet"><span class="text-ink">{{ words.figure }} 1</span> &nbsp;{{ tidyText(block.caption) }}</figcaption>
      <ol v-if="block.notes.length" class="mt-5 grid gap-x-8 gap-y-3 text-[15px] leading-snug text-ink sm:grid-cols-2">
        <li v-for="(note, i) in block.notes" :key="i" class="flex gap-3"><span class="co mt-px">{{ i + 1 }}</span><span><b class="font-semibold">{{ tidyText(note.title) }}</b> {{ tidyText(note.text) }}</span></li>
      </ol>
    </figure>
  </section>
</template>
