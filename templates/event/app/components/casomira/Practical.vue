<script setup lang="ts">
// Časomíra's practical information: four short columns with their titles lit in the colour of
// the diodes, and below them a photograph and the rules in brief, numbered.
const props = defineProps<{ block: BlockOf<'practical'>; first?: boolean; anchor?: string }>()
// (the design has four columns; the rest of a longer list is left to the other looks)
const cards = computed(() => props.block.items.slice(0, 4))
const COLUMN = [
  'py-6 sm:pr-6 border-b border-line lg:border-b-0',
  'py-6 sm:pl-6 lg:px-6 border-b border-line lg:border-b-0 sm:border-l',
  'py-6 sm:pr-6 lg:px-6 border-b border-line sm:border-b-0 lg:border-l',
  'py-6 sm:pl-6 sm:border-l border-line',
]
</script>

<template>
  <section :id="anchor" class="border-t border-line py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : ''">
    <div class="wrap">
      <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
      <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 border-t border-line">
        <div v-for="(card, i) in cards" :key="card.id" :class="COLUMN[i]">
          <h3 class="mono text-led">{{ card.title }}</h3>
          <p class="mt-3">{{ tidyText(card.text) }}</p>
        </div>
      </div>
      <div v-if="block.image || block.rules.length" class="grid lg:grid-cols-12 gap-x-10 gap-y-8 border-t border-line pt-8">
        <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 34rem, 100vw" class="ph lg:col-span-5 w-full aspect-[3/2] object-cover rounded-[6px]" />
        <div v-if="block.rules.length" :class="block.image ? 'lg:col-span-7' : 'lg:col-span-12'">
          <h3 class="text-3xl font-extrabold tracking-[-0.03em]">{{ block.rulesTitle }}</h3>
          <ol class="mt-5 border-t border-line">
            <li v-for="(rule, i) in block.rules" :key="rule.id" class="grid grid-cols-[2.75rem_1fr] py-3.5 border-b border-line"><span class="mono text-led pt-1">{{ String(i + 1).padStart(2, '0') }}</span><span>{{ tidyText(rule.text) }}</span></li>
          </ol>
          <NuxtLink v-if="block.rulesLabel && block.rulesUrl" :to="siteHref(block.rulesUrl)" class="ulink mono mt-3">{{ block.rulesLabel }} <UIcon name="i-lucide-download" aria-hidden="true" /></NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
