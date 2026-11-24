<script setup lang="ts">
// Šachovnice's hours and address: one tile a day with today filled and an eighth tile that leads
// to the booking, then the photograph of the house in a black frame beside the address and the
// ways to get there as ruled rows.
defineProps<{ block: BlockOf<'visit'>; first?: boolean; anchor?: string }>()
const { settings, words, days, townName } = await useSalon()
const today = useToday()
</script>

<template>
  <section :id="anchor" class="wrap py-16 md:py-24 scroll-mt-2">
    <component :is="first ? 'h1' : 'h2'" :class="wideHeading(block.heading)">{{ tidyText(block.heading) }}</component>
    <ul class="mt-10 grid grid-cols-4 lg:grid-cols-8 border-l-2 border-t-2 border-ink">
      <li v-for="d in days" :key="d.index" data-hours-day :data-today="d.index === today ? '' : undefined" class="aspect-square border-r-2 border-b-2 border-ink p-2.5 sm:p-4 flex flex-col justify-between" :class="d.from == null ? 'text-soft' : d.index === today ? 'bg-brand text-brand-ink' : ''">
        <span class="font-display font-extrabold text-[22px] sm:text-[34px] leading-none lowercase"><span aria-hidden="true">{{ d.short }}</span><span class="sr-only">{{ d.name }}</span></span>
        <span class="font-extrabold text-[14px] sm:text-[19px] leading-tight whitespace-nowrap"><template v-if="d.from != null">{{ d.fromText }}–{{ d.toText }}</template><template v-else>{{ words.closed }}</template><span v-if="d.index === today" class="tag block mt-1">{{ words.today }}</span></span>
      </li>
      <li class="on-ink aspect-square border-r-2 border-b-2 border-ink bg-ink text-paper">
        <NuxtLink :to="`/#${anchorOf('booking')}`" class="w-full h-full p-2.5 sm:p-4 flex flex-col justify-between hover:bg-brand hover:text-brand-ink transition-colors">
          <UIcon name="i-lucide-arrow-down-right" class="text-[26px] sm:text-[36px]" aria-hidden="true" />
          <span class="font-display font-bold text-[11px] sm:text-[15px] leading-tight">{{ words.book }}</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-if="settings?.hoursNote" class="mt-4 text-[15px] text-soft font-semibold">{{ tidyText(settings.hoursNote) }}</p>

    <div class="mt-14 md:mt-20 grid lg:grid-cols-12 gap-x-10 gap-y-8 items-start">
      <div class="lg:col-span-7 border-2 border-ink aspect-[3/2] overflow-hidden"><CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 720px, 100vw" class="w-full h-full object-cover" /></div>
      <div class="lg:col-span-5 flex flex-col">
        <template v-if="settings?.address">
          <p class="tag">{{ words.sachovnice.address }}</p>
          <p class="mt-3 font-display font-extrabold text-[34px] md:text-[44px] leading-[1.05] tracking-[-0.02em]">{{ settings.address }}<template v-if="townName">,<br>{{ townName }}</template></p>
        </template>
        <dl v-if="block.ways.length" class="mt-8 text-[17px]">
          <div v-for="(w, i) in block.ways" :key="w.id" class="py-4 border-ink grid grid-cols-[6.5rem_1fr] gap-4" :class="i === block.ways.length - 1 ? 'border-y-2' : 'border-t-2'"><dt class="font-extrabold">{{ w.label }}</dt><dd>{{ tidyText(w.text) }}</dd></div>
        </dl>
        <a v-if="settings?.mapUrl" :href="settings.mapUrl" target="_blank" rel="noopener" class="btn btn-paper mt-8 self-start"><UIcon name="i-lucide-map-pin" aria-hidden="true" />{{ words.openMap }}</a>
      </div>
    </div>
  </section>
</template>
