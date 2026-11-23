<script setup lang="ts">
// Výloha's hours and address: the hours as a plate on the door (days and times joined by dotted
// leaders), the photograph of the house in a frame with a house-number plate over its corner, and
// three ways to get there.
defineProps<{ block: BlockOf<'visit'>; first?: boolean; anchor?: string }>()
const { settings, words, days, street, townName } = await useSalon()
const today = useToday()
const inMaps = computed(() => (settings.value?.address ? words.value.vyloha.inMaps([settings.value.address, settings.value.town].filter(Boolean).join(', ')) : ''))
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-5 lg:self-start panel px-6 py-10 md:px-10 md:py-12" style="--r:22px">
        <component :is="first ? 'h1' : 'h2'" class="caps text-brass text-center">{{ tidyText(block.heading) }}</component>
        <ul class="mt-8">
          <li v-for="d in days" :key="d.index" data-hours-day :data-today="d.index === today ? '' : undefined" class="flex items-baseline gap-3 py-2.5" :class="d.index === today ? 'text-cream' : ''">
            <span class="font-display text-[21px]" :class="d.index === today ? 'text-brass' : 'text-cream'">{{ d.name }}</span><span v-if="d.index === today" class="caps !text-[10px] text-brass">{{ words.today }}</span>
            <span class="leader" />
            <span class="font-display text-[21px] whitespace-nowrap" :class="d.from != null ? (d.index === today ? 'text-brass' : 'text-cream') : ''"><template v-if="d.from != null">{{ d.fromText }}–{{ d.toText }} h</template><template v-else>{{ words.closed }}</template></span>
          </li>
        </ul>
        <p v-if="settings?.hoursNote" class="mt-8 text-[15px] text-center">{{ tidyText(settings.hoursNote) }}</p>
      </div>
      <div class="lg:col-span-7">
        <div class="relative">
          <div class="frame"><div class="aspect-[3/2] overflow-hidden"><CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 720px, 100vw" class="w-full h-full object-cover" /></div></div>
          <!-- the house plate -->
          <div v-if="street[0]" class="on-cream plate absolute left-4 bottom-4 md:left-8 md:bottom-8 text-glass text-center px-6 py-4 md:px-8 md:py-5" style="--pr:12px">
            <p class="caps !text-[11px]">{{ street[0] }}</p>
            <p v-if="street[1]" class="font-display text-[52px] md:text-[68px] leading-[.95]">{{ street[1] }}</p>
            <p v-if="townName" class="caps !text-[10px]">{{ townName }}</p>
          </div>
        </div>
        <dl v-if="block.ways.length" class="mt-8 grid sm:grid-cols-3 gap-x-8 gap-y-6 text-[16px]">
          <div v-for="w in block.ways" :key="w.id"><dt class="caps !text-[12px] text-brass">{{ w.label }}</dt><dd class="mt-2">{{ tidyText(w.text) }}</dd></div>
        </dl>
        <a v-if="settings?.mapUrl && inMaps" :href="settings.mapUrl" target="_blank" rel="noopener" class="mt-6 inline-flex items-center gap-2 min-h-11 text-cream underline decoration-brass underline-offset-[6px] hover:text-brass"><UIcon name="i-lucide-map-pin" class="text-brass" aria-hidden="true" />{{ inMaps }}</a>
      </div>
    </div>
  </section>
</template>
