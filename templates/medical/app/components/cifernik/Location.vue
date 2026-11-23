<script setup lang="ts">
// Ciferník's location: an arched photograph of the house, minute rings instead of a map (a full
// ring is ten minutes on foot) and the other facts as white panels.
defineProps<{ block: BlockOf<'location'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useMedical()
</script>

<template>
  <section :id="anchor" class="wrap pt-16 lg:pt-24 pb-16 lg:pb-24">
    <div class="grid gap-10 lg:grid-cols-[.85fr_1fr] lg:gap-16 items-center">
      <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 30rem, 100vw" class="arch w-full max-w-[30rem] aspect-[4/5] max-lg:aspect-[5/4] max-lg:max-w-none object-cover" />
      <div>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] sm:text-[3.2rem] lg:text-[3.6rem]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-4 text-[1.12rem]">{{ tidyText(block.text) }}</p>

        <ul v-if="block.walks.length" class="mt-8 grid gap-5 sm:grid-cols-3">
          <li v-for="w in block.walks" :key="w.id" class="flex sm:block items-center gap-4">
            <MinuteRing v-if="w.minutes" :minutes="w.minutes" :label="words.minutesLabel(w.minutes)" class="shrink-0" />
            <p class="sm:mt-3 leading-snug"><strong class="text-ink block">{{ w.place }}</strong>{{ w.how }}</p>
          </li>
        </ul>

        <ul v-if="factsForRows(block.facts).length" class="mt-8 grid gap-3">
          <li v-for="f in factsForRows(block.facts)" :key="f.id" class="panel px-5 py-4 flex gap-4 items-start">
            <span class="grid place-items-center size-11 rounded-full bg-soft text-ink shrink-0"><UIcon :name="FACT_ICONS[f.icon ?? 'info']!" class="ic size-[22px]" aria-hidden="true" /></span>
            <p><strong class="text-ink">{{ tidyText(f.title) }}.</strong> {{ tidyText(f.text) }}</p>
          </li>
        </ul>
        <a v-if="settings?.mapUrl" :href="settings.mapUrl" class="btn btn-line mt-7" target="_blank" rel="noopener">{{ words.openMap }} <UIcon name="i-lucide-arrow-up-right" class="ic" aria-hidden="true" /></a>
      </div>
    </div>
  </section>
</template>
