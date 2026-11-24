<script setup lang="ts">
// Šanony's price list: the binders lie in a pile, each a coloured row with its price, grouped
// under heavy rules. A group's rows share one colour; the three groups use three.
import type { Service, ServiceGroup } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; groups: ServiceGroup[]; services: Service[] }>()
const grouped = computed(() => groupServices(props.groups, props.services))
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-28">
    <div class="grid items-end gap-6 lg:grid-cols-12 lg:gap-8">
      <component :is="first ? 'h1' : 'h2'" class="display lg:col-span-8" :class="displaySize(block.heading)"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-brand' }" /></component>
      <p v-if="block.text" class="max-w-[46ch] text-[17px] leading-[1.55] lg:col-span-4">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-12 space-y-12 lg:mt-16">
      <div v-for="g in grouped" :key="g.group.id">
        <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-4 border-ink pb-3">
          <h3 class="font-display text-[26px] font-bold tracking-[-0.02em] sm:text-[30px]">{{ tidyText(g.group.name) }}</h3>
          <p v-if="g.group.note" class="text-[15px] font-semibold">{{ tidyText(g.group.note) }}</p>
        </div>
        <ul class="pile mt-3 space-y-1.5">
          <li v-for="s in g.items" :key="s.id" class="binder" :class="`tone-${toneOf(g.index)}`">
            <span class="binder-hole" aria-hidden="true" />
            <div>
              <h4 class="font-display text-[23px] font-bold leading-tight tracking-[-0.015em] sm:text-[27px]">{{ tidyText(s.name) }}</h4>
              <p v-if="s.text" class="mt-1.5 max-w-[62ch] text-[15.5px] leading-[1.5]">{{ tidyText(s.text) }}</p>
            </div>
            <p class="binder-price">{{ tidyText(s.price) }}<small v-if="s.priceNote">{{ tidyText(s.priceNote) }}</small></p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
