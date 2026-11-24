<script setup lang="ts">
// Salon's lunch: the heading and the date beside a cream card with the soup and the main
// courses of the day, dotted leaders between each name and its price.
import type { DailyMenu } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'lunch'>; first?: boolean; anchor?: string; lunch: { menu: DailyMenu; today: boolean } | null }>()
const { words } = await useRestaurant()
const w = computed(() => words.value.salon)
const day = computed(() => dateParts(props.lunch?.menu.date))
const price = (n: number | null | undefined) => `${formatPrice(n)} Kč`
</script>

<template>
  <section :id="anchor" class="wrap py-20 lg:py-24 scroll-mt-6">
    <div class="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
      <div class="lg:col-span-4 lg:pt-6">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 font-display text-[2.5rem] lg:text-[3.3rem] leading-[1.05] tracking-[-.01em]"><KitMarked :text="block.heading" /></component>
        <p v-if="day" class="mt-3 font-display italic text-[1.6rem] lg:text-[1.9rem] leading-tight text-brand"><time :datetime="day.iso">{{ day.weekday }} {{ day.day }}. {{ day.month }}</time></p>
        <p v-if="block.text" class="mt-6 text-quiet max-w-[26rem]">{{ tidyText(block.text) }}</p>
        <figure v-if="block.image" class="frame mt-10 hidden lg:block max-w-[19rem]">
          <CmsImage :media="block.image" sizes="19rem" class="w-full aspect-square object-cover" />
        </figure>
      </div>

      <div class="lg:col-span-8 sheet px-6 py-9 sm:px-12 sm:py-14 lg:px-16">
        <template v-if="lunch">
          <template v-if="lunch.menu.soupName">
            <p class="label ink-muted">{{ words.soup }}</p>
            <ul class="mt-1">
              <li class="dish">
                <div class="dish-head"><h3 class="dish-name">{{ tidyText(lunch.menu.soupName) }}</h3><span class="dots" /><span class="dish-price">{{ price(lunch.menu.soupPrice) }}</span></div>
                <p v-if="metaLine(lunch.menu.soupAmount, lunch.menu.soupAllergens, words.allergens)" class="dish-meta ink-muted">{{ metaLine(lunch.menu.soupAmount, lunch.menu.soupAllergens, words.allergens) }}</p>
              </li>
            </ul>
            <div class="orn my-6"><i /></div>
          </template>
          <p class="label ink-muted">{{ words.mainCourses }}</p>
          <ol class="mt-1">
            <li v-for="(m, i) in lunch.menu.mains" :key="i" class="dish">
              <div class="dish-head"><h3 class="dish-name"><DishName :name="m.name" :vegetarian="m.vegetarian" mark-class="veg" mark-text="V" :mark-title="w.meatless" /></h3><span class="dots" /><span class="dish-price">{{ price(m.price) }}</span></div>
              <p v-if="metaLine(m.weight, m.allergens, words.allergens)" class="dish-meta ink-muted">{{ metaLine(m.weight, m.allergens, words.allergens) }}</p>
            </li>
          </ol>
        </template>
        <p v-else class="ink-muted">{{ words.noLunch }}</p>
        <p class="mt-7 pt-5 border-t border-[color-mix(in_srgb,var(--bg)_30%,transparent)] text-[.98rem] ink-muted flex flex-wrap gap-x-6 gap-y-1 justify-between">
          <span><span class="veg !ml-0 mr-1.5">V</span> {{ w.mealLegend }}</span>
          <a v-if="block.weekFile && block.weekLabel" class="link" :href="block.weekFile.url" target="_blank" rel="noopener">{{ block.weekLabel }}</a>
        </p>
      </div>
    </div>
  </section>
</template>
