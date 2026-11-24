<script setup lang="ts">
// Šanony's opening: a kicker, a huge three-sentence heading with the last one in the brand
// colour, a text and a button, and beside them the shelf: every service the spine of a binder
// with its price, the last one leaning. Each spine leads to the price list.
import type { Service, ServiceGroup } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; groups: ServiceGroup[]; services: Service[] }>()
const { words } = await useOffice()
const lines = computed(() => headingLines(props.block.heading))
// The design's size for its own wording; a longer heading steps down.
const size = computed(() => byLength(props.block.heading, [
  [46, 'text-[50px] sm:text-[76px] xl:text-[90px]'],
  [70, 'text-[40px] sm:text-[56px] xl:text-[64px]'],
], 'text-[34px] sm:text-[44px] xl:text-[52px]'))
const shelf = computed(() => shelfOf(groupServices(props.groups, props.services)))
const noteLines = computed(() => (props.block.note ?? '').split('\n').map((l) => l.trim()).filter(Boolean))
</script>

<template>
  <section :id="anchor" class="wrap grid gap-10 pt-6 xl:grid-cols-12 xl:gap-8 xl:pt-10">
    <div class="xl:col-span-7 xl:pb-16">
      <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="display mt-5 xl:mt-7" :class="size">
        <template v-for="(line, i) in lines" :key="i"><template v-if="i">{{ ' ' }}</template><span class="xl:block"><KitMarked :text="line" as="span" :attrs="{ class: 'text-brand' }" /></span></template>
      </component>
      <p v-if="block.text" class="mt-6 max-w-[54ch] text-[18px] leading-[1.55] sm:text-[19px] xl:mt-8">{{ tidyText(block.text) }}</p>
      <div class="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
        <SiteLink v-if="block.primaryLabel && block.primaryUrl" :to="block.primaryUrl" class="btn btn-brand">{{ block.primaryLabel }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></SiteLink>
        <p v-if="noteLines.length" class="text-[15px] font-semibold leading-snug"><template v-for="(line, i) in noteLines" :key="i"><br v-if="i">{{ tidyText(line) }}</template></p>
      </div>
    </div>
    <div v-if="shelf.length" class="self-end xl:col-span-5">
      <ol class="shelf" :aria-label="words.shelfLabel" data-shelf>
        <li v-for="(spine, i) in shelf" :key="spine.service.id" :style="{ '--h': `${SPINE_HEIGHTS[i % SPINE_HEIGHTS.length]}%` }">
          <NuxtLink :to="`/#${anchorOf('services')}`" class="spine" :class="`tone-${spine.tone}`">
            <span class="spine-no">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="spine-label"><span>{{ spine.service.shortName || spine.service.name }}</span></span>
            <span class="spine-hole" />
            <span class="spine-price">{{ spinePrice(spine.service)[0] }}<template v-if="spinePrice(spine.service)[1]"><br>{{ spinePrice(spine.service)[1] }}</template></span>
          </NuxtLink>
        </li>
      </ol>
    </div>
  </section>
</template>
