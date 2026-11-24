<script setup lang="ts">
// Paragon's menu: a heading and a sentence, tabs that are boxes of a form (the chosen one crossed
// with the red pencil) and one typed sheet with the dishes of the chosen section in two columns.
import type { MenuSection } from '../../utils/site'

const props = defineProps<{ block: BlockOf<'menu'>; first?: boolean; anchor?: string; sections: MenuSection[] }>()
const { words, settings } = await useRestaurant()
const w = computed(() => words.value.paragon)
const tabs = useMenuTabs(() => props.sections)
const valid = computed(() => formatDate(props.block.validFrom))
const price = (n: number | null | undefined) => `${formatPrice(n)} Kč`
// "1 lepek · 3 vejce" → "1 lepek, 3 vejce": a typed line, not a printed one
const legend = computed(() => (settings.value?.allergenLegend ?? '').replace(/\s*·\s*/g, ', '))
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-5 items-end">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-5 h text-[2.7rem] sm:text-[3.6rem] lg:text-[4.4rem]"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text || valid" class="lg:col-span-7 max-w-[34rem] lg:pb-2">{{ [tidyText(block.text), valid ? `${words.validFrom(valid)}.` : ''].filter(Boolean).join(' ') }}</p>
    </div>

    <UCarousel
      v-slot="{ item }" :items="sections" align="start" contain-scroll="trimSnaps" drag-free :breakpoints="{ '(min-width: 1024px)': { active: false } }" :aria-label="words.menuParts" class="mt-7 -mx-[18px] lg:mx-0"
      :ui="{ viewport: 'px-[18px] lg:px-0 lg:overflow-visible', container: '-ms-[22px] lg:ms-0 lg:flex-wrap lg:gap-x-[22px] lg:gap-y-1', item: 'basis-auto ps-[22px] lg:ps-0' }"
    >
      <button :id="`tab-${item.category.slug}`" class="tick" type="button" :aria-pressed="tabs.active.value === item.category.id" :aria-controls="`panel-${item.category.slug}`" @click="tabs.pick(item.category.id)"><span class="box" />{{ item.category.name }}</button>
    </UCarousel>

    <div class="sheet mt-6 px-5 pt-9 pb-7 sm:px-10 sm:pt-12 sm:pb-9">
      <div v-for="s in sections" :id="`panel-${s.category.slug}`" :key="s.category.id" :hidden="tabs.active.value !== s.category.id">
        <h3 class="h text-[1.7rem] pb-4 border-b-[3px] border-double border-ink">{{ s.category.name }}</h3>
        <ul class="typed lg:columns-2 lg:gap-14 !block">
          <li v-for="d in s.dishes" :key="d.id"><span class="name"><DishName :name="d.name" :vegetarian="d.vegetarian" mark-class="veg" mark-text="V" :mark-title="w.meatless" /></span><span class="price">{{ price(d.price) }}</span><span v-if="d.description" class="desc">{{ tidyText(d.description) }}</span><span v-if="metaLine(d.amount, d.allergens, words.allergens)" class="meta dim">{{ metaLine(d.amount, d.allergens, words.allergens) }}</span></li>
        </ul>
      </div>
      <p class="mt-6 text-[.92rem] dim"><span class="veg !ml-0 mr-1">V</span> = {{ [`${w.meatless}.`, legend ? `${words.allergensTitle}: ${legend}.` : '', legend ? words.askStaff : ''].filter(Boolean).join(' ') }}</p>
    </div>
  </section>
</template>
