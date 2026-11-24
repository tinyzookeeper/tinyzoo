<script setup lang="ts">
// Paragon's lunch: a typed sheet with a "Dnes" stamp, the soup and the numbered main courses in
// typewriter type with their prices; beside it a print of the soup.
import type { DailyMenu } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'lunch'>; first?: boolean; anchor?: string; lunch: { menu: DailyMenu; today: boolean } | null }>()
const { words } = await useRestaurant()
const w = computed(() => words.value.paragon)
const day = computed(() => dateParts(props.lunch?.menu.date))
const price = (n: number | null | undefined) => `${formatPrice(n)} Kč`
// "11:00–14:30" → "Vaříme od 11:00 do 14:30"; a text that is not a range stays as it is.
const cooking = computed(() => {
  const [from, to] = (props.block.served ?? '').split(/\s*[–-]\s*/)
  return from && to ? w.value.cooking(from, to) : props.block.served
})
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-8 items-start">
      <div class="lg:col-span-8 sheet px-5 pt-9 pb-7 sm:px-10 sm:pt-12 sm:pb-9">
        <div class="flex flex-wrap sm:flex-nowrap items-end justify-between gap-x-8 gap-y-3 pb-5 border-b-[3px] border-double border-ink">
          <div>
            <p v-if="cooking" class="print">{{ cooking }}</p>
            <component :is="first ? 'h1' : 'h2'" class="h mt-2 text-[2.5rem] sm:text-[3.4rem]"><KitMarked :text="block.heading" plain /></component>
          </div>
          <div v-if="day" class="flex sm:flex-col-reverse items-center sm:items-end gap-x-5 gap-y-3 sm:shrink-0 sm:pb-1">
            <p class="font-bold text-[1.06rem] leading-snug"><time :datetime="day.iso"><span class="block sm:inline">{{ day.weekday }}</span> {{ day.day }}. {{ day.month }} {{ day.year }}</time></p>
            <p v-if="lunch?.today" class="stamp !text-[1.1rem]">{{ w.today }}</p>
          </div>
        </div>

        <template v-if="lunch">
          <template v-if="lunch.menu.soupName">
            <p class="print mt-6">{{ words.soup }}</p>
            <ul class="typed">
              <li><span class="name">{{ tidyText(lunch.menu.soupName) }}</span><span class="price">{{ price(lunch.menu.soupPrice) }}</span><span v-if="metaLine(lunch.menu.soupAmount, lunch.menu.soupAllergens, words.allergens)" class="meta dim">{{ metaLine(lunch.menu.soupAmount, lunch.menu.soupAllergens, words.allergens) }}</span></li>
            </ul>
          </template>
          <p class="print mt-7">{{ words.mainCourses }}</p>
          <ol class="typed">
            <li v-for="(m, i) in lunch.menu.mains" :key="i"><span class="name">{{ i + 1 }}. <DishName :name="m.name" :vegetarian="m.vegetarian" mark-class="veg" mark-text="V" :mark-title="w.meatless" /></span><span class="price">{{ price(m.price) }}</span><span v-if="metaLine(m.weight, m.allergens, words.allergens)" class="meta dim">{{ metaLine(m.weight, m.allergens, words.allergens) }}</span></li>
          </ol>
        </template>
        <p v-else class="mt-6">{{ words.noLunch }}</p>

        <div class="mt-6 flex flex-wrap justify-between gap-x-8 gap-y-2 text-[.95rem]">
          <p><span class="veg !ml-0 mr-1">V</span> = {{ w.meatless }}. {{ tidyText(block.listNote) }}</p>
          <a v-if="block.weekFile && block.weekLabel" class="tlink font-bold" :href="block.weekFile.url" target="_blank" rel="noopener">{{ block.weekLabel }}</a>
        </div>
      </div>

      <div class="lg:col-span-4 lg:pt-16">
        <figure v-if="block.image" class="photo max-w-[20rem] lg:-ml-7 relative">
          <CmsImage :media="block.image" sizes="20rem" class="w-full aspect-square object-cover" />
          <figcaption v-if="block.imageCaption">{{ w.figure(2, block.imageCaption) }}</figcaption>
        </figure>
        <p v-if="block.sideText" class="mt-7 max-w-[20rem]">{{ tidyText(block.sideText) }}</p>
      </div>
    </div>
  </section>
</template>
