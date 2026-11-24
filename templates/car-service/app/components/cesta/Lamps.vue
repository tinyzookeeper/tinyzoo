<script setup lang="ts">
// The warning lights in Cesta's style (the look's own design has none): a tinted panel with a
// round symbol and the name of every group, each leading to its group of the price list.
import type { ServiceGroup } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'lamps'>; first?: boolean; anchor?: string; groups: ServiceGroup[] }>()
const focus = useGroupFocus()
</script>

<template>
  <section class="wrap pb-16 lg:pb-24" :aria-labelledby="anchor">
    <div class="rounded-[28px] bg-tint p-7 sm:p-10 lg:p-12">
      <component :is="first ? 'h1' : 'h2'" :id="anchor" class="font-extrabold text-[34px] sm:text-[44px]">{{ plainEmphasis(block.heading) }}</component>
      <p v-if="block.text" class="mt-4 text-[18px] max-w-[34em]">{{ tidyText(block.text) }}</p>
      <ul class="mt-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-7">
        <li v-for="g in lampGroups(groups)" :key="g.id">
          <a :href="`#g-${g.slug}`" class="flex flex-col items-start gap-3 font-display font-bold text-[18px] leading-tight hover:text-brand transition-colors" @click="focus = { slug: g.slug, at: Date.now() }">
            <span class="disc bg-white"><UIcon :name="GROUP_ICONS[g.icon]" aria-hidden="true" /></span>{{ keepEnd(g.name) }}
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>
