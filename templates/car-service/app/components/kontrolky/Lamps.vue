<script setup lang="ts">
// Kontrolky's warning lights: six lights on one soft panel, each with the name of its group, each
// leading to its group of the price list and opening it.
import type { ServiceGroup } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'lamps'>; first?: boolean; anchor?: string; groups: ServiceGroup[] }>()
const focus = useGroupFocus()
</script>

<template>
  <section class="wrap pb-16 lg:pb-24" :aria-labelledby="anchor">
    <div class="rounded-[22px] bg-panel px-6 py-8 sm:px-10 sm:py-10 grid lg:grid-cols-12 gap-x-10 gap-y-8 items-center">
      <div class="lg:col-span-3">
        <component :is="first ? 'h1' : 'h2'" :id="anchor" class="text-[28px] sm:text-[30px]">{{ plainEmphasis(block.heading) }}</component>
        <p v-if="block.text" class="mt-2.5 text-[16px] text-quiet">{{ tidyText(block.text) }}</p>
      </div>
      <ul class="lg:col-span-9 grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-8 text-center">
        <li v-for="g in lampGroups(groups)" :key="g.id">
          <a :href="`#g-${g.slug}`" class="flex flex-col items-center gap-3.5 text-[15.5px] leading-tight" :style="{ '--c': LAMP_COLORS[g.lampColor] }" @click="focus = { slug: g.slug, at: Date.now() }">
            <span class="lamp"><LampIcon :path="LAMP_PATHS[g.lamp]" /></span>{{ keepEnd(g.name) }}
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>
