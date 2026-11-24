<script setup lang="ts">
// Salon's menu: one large cream card with every section open in two columns, jump links on
// top, and under it a dish shown large with a few words beside it.
import type { MenuSection } from '../../utils/site'

const props = defineProps<{ block: BlockOf<'menu'>; first?: boolean; anchor?: string; sections: MenuSection[] }>()
const { words, settings } = await useRestaurant()
const w = computed(() => words.value.salon)
const valid = computed(() => formatDate(props.block.validFrom))
const price = (n: number | null | undefined) => `${formatPrice(n)} Kč`
const legend = computed(() => settings.value?.allergenLegend ?? '')
</script>

<template>
  <section :id="anchor" class="wrap pb-20 lg:pb-24 scroll-mt-6">
    <div class="sheet px-6 py-12 sm:px-12 sm:py-16 lg:px-24 lg:py-24">
      <header class="text-center">
        <p v-if="valid" class="label ink-muted">{{ words.validFrom(valid) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 font-display font-medium text-[2.8rem] lg:text-[4.2rem] leading-[1.02] tracking-[-.015em]"><KitMarked :text="block.heading" /></component>
        <div class="orn mt-6"><i /></div>
        <nav class="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-1" :aria-label="words.menuParts">
          <a v-for="s in sections" :key="s.category.id" class="navlink !text-[.74rem] hover:!text-[var(--bg)] hover:!border-[var(--bg)]" :href="`#${s.category.slug}`">{{ s.category.name }}</a>
        </nav>
      </header>

      <div class="mt-12 lg:mt-16 lg:columns-2 lg:gap-24">
        <section v-for="s in sections" :id="s.category.slug" :key="s.category.id" class="scroll-mt-8 pb-10 break-inside-avoid">
          <h3 class="cat-title">{{ s.category.name }}</h3>
          <ul class="mt-3">
            <li v-for="d in s.dishes" :key="d.id" class="dish">
              <div class="dish-head"><h4 class="dish-name"><DishName :name="d.name" :vegetarian="d.vegetarian" mark-class="veg" mark-text="V" :mark-title="w.meatless" /></h4><span class="dots" /><span class="dish-price">{{ price(d.price) }}</span></div>
              <p v-if="d.description" class="dish-desc">{{ tidyText(d.description) }}</p>
              <p v-if="metaLine(d.amount, d.allergens, words.allergens)" class="dish-meta ink-muted">{{ metaLine(d.amount, d.allergens, words.allergens) }}</p>
            </li>
          </ul>
        </section>
      </div>

      <footer class="mt-4 pt-7 border-t border-[color-mix(in_srgb,var(--bg)_30%,transparent)] grid md:grid-cols-[auto_1fr] gap-x-12 gap-y-3 text-[.98rem] ink-muted">
        <p><span class="veg !ml-0 mr-1.5">V</span> {{ w.mealLegend }}</p>
        <p v-if="legend" class="md:text-right text-balance">{{ words.allergensTitle }}: {{ legend }}. {{ words.askStaff }}</p>
      </footer>
    </div>

    <figure v-if="block.featureImage" class="mt-14 lg:mt-20 grid lg:grid-cols-12 gap-6 lg:gap-14 items-end">
      <div class="frame lg:col-span-8">
        <CmsImage :media="block.featureImage" sizes="(min-width: 1024px) 66vw, 100vw" class="w-full aspect-[3/2] lg:aspect-[16/9] object-cover" />
      </div>
      <figcaption class="lg:col-span-4 lg:pb-4">
        <p v-if="block.featureLabel" class="label text-brand">{{ block.featureLabel }}</p>
        <p v-if="block.featureTitle" class="mt-4 font-display italic text-[1.6rem] lg:text-[1.9rem] leading-[1.2]">{{ tidyText(block.featureTitle) }}</p>
        <p v-if="block.featureText" class="mt-4 text-quiet">{{ tidyText(block.featureText) }}</p>
      </figcaption>
    </figure>
  </section>
</template>
