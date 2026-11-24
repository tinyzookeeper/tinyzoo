<script setup lang="ts">
// The warning lights in Šuplíky's style (the look's own design has none): a row of labelled
// drawer tags, one for each group of the price list, each leading to its group and opening it.
import type { ServiceGroup } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'lamps'>; first?: boolean; anchor?: string; groups: ServiceGroup[] }>()
const focus = useGroupFocus()
</script>

<template>
  <section class="wrap pb-14 lg:pb-20" :aria-labelledby="anchor">
    <div class="rounded-[32px] bg-tint p-5 sm:p-8 lg:p-10">
      <component :is="first ? 'h1' : 'h2'" :id="anchor" class="text-[34px] sm:text-[44px]">{{ plainEmphasis(block.heading) }}</component>
      <p v-if="block.text" class="mt-3 text-[16.5px] leading-[1.5] max-w-[36em]">{{ tidyText(block.text) }}</p>
      <ul class="mt-6 flex flex-wrap gap-x-4 gap-y-5">
        <li v-for="g in lampGroups(groups)" :key="g.id">
          <a :href="`#g-${g.slug}`" class="tag inline-flex items-center gap-2.5 px-4 py-2.5 font-display italic font-bold text-[20px] leading-none hover:text-brand transition-colors" @click="focus = { slug: g.slug, at: Date.now() }">
            <UIcon :name="GROUP_ICONS[g.icon]" class="size-5" aria-hidden="true" />{{ g.name }}
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>
