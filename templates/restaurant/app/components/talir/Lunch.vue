<script setup lang="ts">
// Talíř's lunch: the heading and a black date pill beside big numbered rows with large prices,
// ruled in 2 px black; a soup row first.
import type { DailyMenu } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'lunch'>; first?: boolean; anchor?: string; lunch: { menu: DailyMenu; today: boolean } | null }>()
const { words } = await useRestaurant()
const w = computed(() => words.value.talir)
const day = computed(() => dateParts(props.lunch?.menu.date))
const price = (n: number | null | undefined) => `${formatPrice(n)} Kč`
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-9">
      <div class="lg:col-span-4">
        <component :is="first ? 'h1' : 'h2'" class="wide text-[2.9rem] lg:text-[4.4rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="day || block.served" class="mt-5 inline-flex flex-wrap items-center gap-x-3 gap-y-1 bg-ink text-paper rounded-full px-5 py-2.5 cap !text-[1rem]">
          <time v-if="day" :datetime="day.iso">{{ day.weekday }} {{ day.day }}. {{ day.monthNumber }}.</time>
          <span v-if="day && block.served" aria-hidden="true" class="text-pop">●</span>
          <span v-if="block.served">{{ block.served }}</span>
        </p>
        <p v-if="block.text" class="mt-6 max-w-[26rem]">{{ tidyText(block.text) }}</p>
        <CmsImage v-if="block.image" :media="block.image" sizes="15rem" class="plate hidden lg:block mt-10 w-[15rem] shadow-[0_0_0_2px_var(--ink)]" />
      </div>
      <div class="lg:col-span-8">
        <ol v-if="lunch" class="lunch">
          <li v-if="lunch.menu.soupName">
            <span class="n pt-0.5"><UIcon name="i-lucide-soup" :aria-label="words.soup" /></span>
            <div><h3>{{ tidyText(lunch.menu.soupName) }}</h3><p class="cap muted mt-1.5">{{ words.soup }}<template v-if="metaLine(lunch.menu.soupAmount, lunch.menu.soupAllergens, words.allergens)"> · {{ metaLine(lunch.menu.soupAmount, lunch.menu.soupAllergens, words.allergens) }}</template></p></div>
            <span class="num p">{{ price(lunch.menu.soupPrice) }}</span>
          </li>
          <li v-for="(m, i) in lunch.menu.mains" :key="i">
            <span class="num n">{{ i + 1 }}</span>
            <div><h3><DishName :name="m.name" :vegetarian="m.vegetarian" mark-class="tag" :mark-text="w.meatless" /></h3><p v-if="metaLine(m.weight, m.allergens, words.allergens)" class="cap muted mt-1.5">{{ metaLine(m.weight, m.allergens, words.allergens) }}</p></div>
            <span class="num p">{{ price(m.price) }}</span>
          </li>
        </ol>
        <p v-else class="muted">{{ words.noLunch }}</p>
        <p v-if="block.listNote || (block.weekFile && block.weekLabel)" class="mt-5 flex flex-wrap justify-between gap-x-8 gap-y-2">
          <span class="muted">{{ tidyText(block.listNote) }}</span>
          <a v-if="block.weekFile && block.weekLabel" class="ulink font-bold" :href="block.weekFile.url" target="_blank" rel="noopener">{{ block.weekLabel }}</a>
        </p>
      </div>
    </div>
  </section>
</template>
