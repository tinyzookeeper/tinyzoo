<script setup lang="ts">
// Celý rok's way here: the address as a typographic panel with the altitude and the
// coordinates, the way by car as rows, and the way by train and bus as numbered steps.
defineProps<{ block: BlockOf<'directions'>; first?: boolean; anchor?: string }>()
const { settings, words } = await useStay()
const MAP_ICONS = ['i-lucide-map-pin', 'i-lucide-navigation']
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-24">
    <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
    <div class="mt-10 md:mt-14 grid lg:grid-cols-12 gap-x-10 gap-y-12">
      <div class="lg:col-span-5 border border-line p-7 md:p-9 flex flex-col">
        <p v-if="block.placeLabel" class="label">{{ block.placeLabel }}</p>
        <p class="mt-5 font-display text-[2rem] md:text-[2.4rem] leading-[1.1]">{{ settings?.address }}</p>
        <p v-if="settings?.postalTown" class="mt-2 text-quiet">{{ settings.postalTown }}</p>
        <dl class="mt-8 grid grid-cols-2 gap-x-6 num">
          <div v-if="settings?.altitude" class="rule py-4"><dt class="text-sm text-quiet">{{ words.altitude }}</dt><dd class="font-display text-2xl">{{ settings.altitude }}</dd></div>
          <div v-for="fact in block.facts" :key="fact.id" class="rule py-4"><dt class="text-sm text-quiet">{{ fact.label }}</dt><dd class="font-display text-2xl">{{ fact.value }}</dd></div>
          <div v-if="settings?.coordinates" class="rule py-4 col-span-2"><dt class="text-sm text-quiet">{{ words.coordinates }}</dt><dd class="font-display text-2xl">{{ settings.coordinates }}</dd></div>
        </dl>
        <div v-if="settings?.maps?.length" class="mt-auto pt-6 flex flex-wrap gap-3">
          <a v-for="(m, i) in settings.maps" :key="m.id" :href="m.url ?? undefined" class="btn btn-line" target="_blank" rel="noopener"><UIcon :name="MAP_ICONS[i % MAP_ICONS.length]!" class="size-[1em]" aria-hidden="true" />{{ m.label }}</a>
        </div>
      </div>
      <div class="lg:col-span-3 lg:col-start-7">
        <h3 class="text-2xl">{{ block.carHeading }}</h3>
        <dl class="mt-5 num">
          <div v-for="r in block.carRoutes" :key="r.id" class="rule py-3 flex justify-between gap-4"><dt>{{ r.place }}</dt><dd class="text-quiet whitespace-nowrap">{{ [r.distance, r.time].filter(Boolean).join(' · ') }}</dd></div>
        </dl>
        <p v-if="block.carNote" class="mt-5 text-quiet">{{ tidyText(block.carNote) }}</p>
      </div>
      <div class="lg:col-span-3 lg:col-start-10">
        <h3 class="text-2xl">{{ block.trainHeading }}</h3>
        <ol class="mt-5">
          <li v-for="s in block.trainSteps" :key="s.id" class="rule py-3"><strong class="font-semibold">{{ s.title }}</strong><span v-if="s.value" class="text-quiet"> · {{ s.value }}</span><span v-if="s.note" class="block text-quiet">{{ tidyText(s.note) }}</span></li>
        </ol>
      </div>
    </div>
  </section>
</template>
