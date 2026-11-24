<script setup lang="ts">
// Talíř's menu: a huge heading with pill tabs beside it, and a dense ruled table (dish, weight,
// allergens, price) of one section at a time, with one plate that stays in view beside it.
import type { MenuSection } from '../../utils/site'

const props = defineProps<{ block: BlockOf<'menu'>; first?: boolean; anchor?: string; sections: MenuSection[] }>()
const { words, settings } = await useRestaurant()
const w = computed(() => words.value.talir)
const tabs = useMenuTabs(() => props.sections)
// The poster heading is sized for one short word; a longer one gets smaller type and two lines.
const size = computed(() => byLength(props.block.heading, [[8, 'text-[3.4rem] lg:text-[5.6rem]']], 'text-[2.6rem] lg:text-[3.9rem]'))
const valid = computed(() => formatDate(props.block.validFrom))
const price = (n: number | null | undefined) => `${formatPrice(n)} Kč`
const legend = computed(() => settings.value?.allergenLegend ?? '')
</script>

<template>
  <section :id="anchor" class="border-t-2 border-ink scroll-mt-4">
    <div class="wrap py-16 lg:py-24">
      <div class="grid lg:grid-cols-12 gap-x-12 gap-y-8 items-end">
        <component :is="first ? 'h1' : 'h2'" class="lg:col-span-4 wide" :class="size"><KitMarked :text="block.heading" plain /></component>
        <div class="lg:col-span-8 min-w-0">
          <p v-if="block.text || valid" class="max-w-[38rem] mb-5">{{ [tidyText(block.text), valid ? `${words.validFrom(valid)}.` : ''].filter(Boolean).join(' ') }}</p>
          <UCarousel
            v-slot="{ item }" :items="sections" align="start" contain-scroll="trimSnaps" drag-free :breakpoints="{ '(min-width: 1024px)': { active: false } }" :aria-label="words.menuParts" class="-mx-[18px] lg:mx-0"
            :ui="{ viewport: 'px-[18px] lg:px-0 lg:overflow-visible', container: '-ms-2 lg:ms-0 lg:flex-wrap lg:gap-2', item: 'basis-auto ps-2 lg:ps-0' }"
          >
            <button :id="`tab-${item.category.slug}`" class="tab" type="button" :aria-pressed="tabs.active.value === item.category.id" :aria-controls="`panel-${item.category.slug}`" @click="tabs.pick(item.category.id)">{{ item.category.name }}</button>
          </UCarousel>
        </div>
      </div>

      <div class="mt-9 lg:mt-12 grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
        <div class="lg:col-span-4 hidden lg:block lg:sticky lg:top-8">
          <CmsImage v-if="block.plateImage" :media="block.plateImage" sizes="22rem" class="plate max-w-[22rem] shadow-[0_0_0_2px_var(--ink)]" />
          <p v-if="legend" class="cap muted mt-6 max-w-[22rem]">{{ words.allergensTitle }}: {{ legend }}</p>
        </div>

        <div class="lg:col-span-8">
          <div class="hidden lg:grid grid-cols-[1fr_5.5rem_8.5rem_7rem] gap-x-6 pb-2 cap muted"><span>{{ w.head.dish }}</span><span>{{ w.head.weight }}</span><span>{{ w.head.allergens }}</span><span class="text-right">{{ w.head.price }}</span></div>

          <div v-for="s in sections" :id="`panel-${s.category.slug}`" :key="s.category.id" :hidden="tabs.active.value !== s.category.id">
            <ul class="rows">
              <li v-for="d in s.dishes" :key="d.id">
                <div><h4><DishName :name="d.name" :vegetarian="d.vegetarian" mark-class="tag" :mark-text="w.meatless" /></h4><p v-if="d.description" class="desc muted">{{ tidyText(d.description) }}</p></div>
                <div class="meta cap muted"><span>{{ d.amount }}</span><span><template v-if="allergenList(d.allergens)"><span class="lg:hidden">{{ `${words.allergens} ` }}</span>{{ allergenList(d.allergens) }}</template><template v-else>–</template></span></div>
                <span class="num p">{{ price(d.price) }}</span>
              </li>
            </ul>
          </div>

          <p v-if="legend" class="cap muted mt-5 lg:hidden">{{ words.allergensTitle }}: {{ legend }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
