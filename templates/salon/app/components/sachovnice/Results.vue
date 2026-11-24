<script setup lang="ts">
// Šachovnice's results: a real checkerboard, photographs alternating with caption tiles that name
// who did it and what it costs; it stays a checkerboard in two columns on a phone. A click on a
// tile starts booking that service. The last tile leads to Instagram.
import type { Result } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'results'>; first?: boolean; anchor?: string; items: Result[] }>()
const { settings, words } = await useSalon()
const choice = useBookingChoice()
const link = resolveComponent('NuxtLink')
// The tiles take the brand colour and black in turns, two and two.
const dark = (i: number) => i % 4 === 1 || i % 4 === 2
const pair = 'pair group grid grid-cols-2 even:[direction:rtl] lg:even:[direction:ltr] lg:[&:nth-child(4n+3)]:[direction:rtl] lg:[&:nth-child(4n+4)]:[direction:rtl]'
</script>

<template>
  <section :id="anchor" class="scroll-mt-2">
    <div class="wrap pt-16 md:pt-24 pb-10 grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
      <component :is="first ? 'h1' : 'h2'" class="lg:col-span-7" :class="wideHeading(block.heading)">{{ tidyText(block.heading) }}</component>
      <p v-if="block.text" class="lg:col-span-5 max-w-[30rem] text-[18px]">{{ tidyText(block.text) }}</p>
    </div>
    <ul class="grid grid-cols-1 lg:grid-cols-2 border-y-2 border-ink">
      <li v-for="(r, i) in items" :key="r.id" :class="pair">
        <div class="aspect-square overflow-hidden"><CmsImage v-if="r.photo" :media="r.photo" sizes="(min-width: 1024px) 640px, 50vw" class="w-full h-full object-cover transition-transform duration-500" /></div>
        <component
          :is="r.service ? link : 'div'" v-bind="r.service ? { to: `/#${anchorOf('booking')}` } : {}"
          class="aspect-square p-4 sm:p-7 flex flex-col justify-between [direction:ltr]" :class="dark(i) ? 'on-ink bg-ink text-paper' : 'bg-brand text-brand-ink'"
          @click="r.service && (choice.service.value = r.service.name)"
        >
          <span class="tag" :class="dark(i) ? 'text-brand' : ''">{{ firstName(r.person?.name) }}</span>
          <span><span class="block font-display font-bold text-[15px] sm:text-[24px] leading-[1.15]">{{ r.title }}</span><span v-if="r.facts || r.service" class="mt-2 block text-[14px] sm:text-[17px] font-bold">{{ r.facts }}<template v-if="!r.facts && r.service">{{ r.service.priceFrom ? `${words.from} ` : '' }}{{ kc(r.service.price) }} · {{ r.service.minutes }} {{ words.min }}</template></span></span>
        </component>
      </li>
      <li v-if="settings?.instagram" :class="pair">
        <div class="checker aspect-square" style="--sq:12.5%" aria-hidden="true" />
        <a :href="settings.instagram" target="_blank" rel="noopener" class="aspect-square bg-paper text-ink p-4 sm:p-7 flex flex-col justify-between [direction:ltr] hover:bg-ink hover:text-paper transition-colors">
          <UIcon name="i-lucide-instagram" class="text-[26px]" aria-hidden="true" />
          <span><span class="block font-display font-bold text-[15px] sm:text-[24px] leading-[1.15]">{{ words.sachovnice.more }}</span><span class="mt-2 block text-[14px] sm:text-[17px] font-bold">{{ socialHandle(settings.instagram) }} →</span></span>
        </a>
      </li>
    </ul>
  </section>
</template>
