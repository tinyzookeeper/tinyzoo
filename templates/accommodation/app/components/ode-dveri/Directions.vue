<script setup lang="ts">
// Ode dveří's way here, on a soft band: the address everything is measured from in a white
// panel, and the ways by car and by train and bus as stops on one thin line, each ending at the door.
defineProps<{ block: BlockOf<'directions'>; first?: boolean; anchor?: string }>()
const { settings, name, words } = await useStay()
</script>

<template>
  <section :id="anchor" class="soft mt-20 md:mt-28 bg-soft">
    <div class="wrap py-16 md:py-24">
      <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
      <div class="mt-8 md:mt-12 grid lg:grid-cols-12 gap-x-12 gap-y-10">
        <!-- Where the distances are counted from -->
        <div class="lg:col-span-4 self-start rounded-[24px] bg-paper p-6 md:p-8">
          <p v-if="block.placeLabel" class="eyebrow">{{ block.placeLabel }}</p>
          <p class="mt-4 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink leading-tight">{{ tidyText(settings?.address).replace(/ (\S+)$/, '\u00A0$1') }}</p>
          <p v-if="settings?.postalTown" class="mt-1 text-quiet">{{ settings.postalTown }}</p>
          <dl class="mt-6 grid grid-cols-2 gap-x-6 num">
            <div v-if="settings?.altitude" class="rule py-3"><dt class="text-sm text-quiet">{{ words.altitude }}</dt><dd class="font-semibold text-ink text-lg">{{ settings.altitude }}</dd></div>
            <div v-for="fact in block.facts" :key="fact.id" class="rule py-3"><dt class="text-sm text-quiet">{{ fact.label }}</dt><dd class="font-semibold text-ink text-lg">{{ fact.value }}</dd></div>
            <div v-if="settings?.coordinates" class="rule py-3 col-span-2"><dt class="text-sm text-quiet">{{ words.coordinates }}</dt><dd class="font-semibold text-ink text-lg">{{ settings.coordinates }}</dd></div>
          </dl>
          <div v-if="settings?.maps?.length" class="mt-3 flex flex-wrap gap-x-6">
            <a v-for="m in settings.maps" :key="m.id" :href="m.url ?? undefined" class="tlink" target="_blank" rel="noopener">{{ m.label }} <UIcon name="i-lucide-arrow-up-right" class="size-[1em]" aria-hidden="true" /></a>
          </div>
        </div>

        <div class="lg:col-span-4">
          <h3 class="text-2xl flex items-center gap-3"><UIcon name="i-lucide-car-front" class="size-[1em] text-brand" aria-hidden="true" />{{ block.carHeading }}</h3>
          <ol class="route mt-6 num">
            <li v-for="r in block.carRoutes" :key="r.id" class="stop"><strong v-bind="cmsField('place', r.id)" class="font-semibold text-ink">{{ r.place }}</strong><span class="font-semibold text-ink">{{ r.distance }}</span><span v-if="r.note || r.time" class="col-span-2 text-quiet">{{ r.note || r.time }}</span></li>
            <li class="stop stop-end !pb-0"><strong class="font-semibold text-ink">{{ name }}</strong><span class="font-semibold text-brand">{{ words.youAreHere }}</span><span v-if="block.carNote" class="col-span-2 text-quiet">{{ tidyText(block.carNote) }}</span></li>
          </ol>
        </div>

        <div class="lg:col-span-4">
          <h3 class="text-2xl flex items-center gap-3"><UIcon name="i-lucide-train-front" class="size-[1em] text-brand" aria-hidden="true" />{{ block.trainHeading }}</h3>
          <ol class="route mt-6 num">
            <li v-for="s in block.trainSteps" :key="s.id" class="stop"><strong v-bind="cmsField('title', s.id)" class="font-semibold text-ink">{{ s.title }}</strong><span class="font-semibold text-ink">{{ s.value }}</span><span v-if="s.note" class="col-span-2 text-quiet">{{ tidyText(s.note) }}</span></li>
            <li class="stop stop-end !pb-0"><strong class="font-semibold text-ink">{{ name }}</strong><span class="font-semibold text-brand">{{ words.youAreHere }}</span><span v-if="block.trainNote" class="col-span-2 text-quiet">{{ tidyText(block.trainNote) }}</span></li>
          </ol>
        </div>
      </div>
    </div>
  </section>
</template>
