<script setup lang="ts">
// Soutisk's practical information: tiles with a round icon in one of the inks and a photograph
// among them, then a petrol panel with the rules in brief, numbered in the display face.
const props = defineProps<{ block: BlockOf<'practical'>; first?: boolean; anchor?: string }>()
const BUBBLE = ['bg-c2', 'bg-c1', 'bg-c3 text-paper', 'bg-ink text-paper']
// (the photograph stands after the second tile, as in the design)
const photoAfter = computed(() => Math.min(1, props.block.items.length - 1))
</script>

<template>
  <section :id="anchor" class="relative bg-paper pt-6 sm:pt-10 pb-16 sm:pb-24" :class="first ? 'mt-14 sm:mt-28' : ''">
    <svg class="hills text-paper" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><use href="#soutisk-hl3" fill="currentColor" /></svg>
    <div class="wrap">
      <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="h2 mt-3 max-w-[18ch]"><KitMarked :text="block.heading" plain /></component>
      <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <template v-for="(card, i) in block.items" :key="card.id">
          <div class="rounded-[28px] bg-paper2 p-6 sm:p-7">
            <span class="inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl" :class="BUBBLE[i % 4]"><UIcon :name="INFO_ICON_NAMES[card.icon ?? 'info'] ?? 'i-lucide-info'" aria-hidden="true" /></span>
            <h3 class="disp text-[1.5rem] mt-5">{{ card.title }}</h3>
            <p class="mt-3">{{ tidyText(card.text) }}</p>
          </div>
          <div v-if="block.image && i === photoAfter" class="relative sm:col-span-2 lg:col-span-1 lg:row-span-2 min-h-[18rem]">
            <CmsImage :media="block.image" sizes="(min-width: 1024px) 26rem, 100vw" class="w-full h-full aspect-[3/2] lg:aspect-auto object-cover rounded-[28px] lg:absolute lg:inset-0" />
          </div>
        </template>
      </div>
      <div v-if="block.rules.length" class="on-dark mt-5 rounded-[28px] bg-c3 text-paper p-6 sm:p-9 grid lg:grid-cols-12 gap-x-8 gap-y-5">
        <div class="lg:col-span-4">
          <h3 class="disp text-[1.9rem] sm:text-[2.3rem] leading-[1.05]">{{ block.rulesTitle }}</h3>
          <NuxtLink v-if="block.rulesLabel && block.rulesUrl" :to="siteHref(block.rulesUrl)" class="ulink mt-3">{{ block.rulesLabel }}</NuxtLink>
        </div>
        <ol class="lg:col-span-8 grid sm:grid-cols-2 gap-x-8 gap-y-5 text-lg">
          <li v-for="(rule, i) in block.rules" :key="rule.id" class="flex gap-4"><span class="disp text-[1.9rem] text-c2 leading-none">{{ i + 1 }}</span><span>{{ tidyText(rule.text) }}</span></li>
        </ol>
      </div>
    </div>
  </section>
</template>
