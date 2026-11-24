<script setup lang="ts">
// Celý rok's opening: one photograph across the top (the header sits over it when this block
// opens the page), the heading and a sentence over its lower part, and the short enquiry
// form docked on its lower edge. The form carries the dates to the enquiry below.
const props = defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string }>()
const { words } = await useStay()
const draft = useStayDraft()
const goToEnquiry = useGoToEnquiry()
const quick = reactive({ arrival: '', departure: '', guests: '2' })
function submit() {
  draft.value = { ...draft.value, arrival: quick.arrival, departure: quick.departure, adults: String(Math.min(6, Number(quick.guests) || 2)) }
  goToEnquiry()
}
</script>

<template>
  <section :id="anchor" class="relative" :class="first ? '-mt-[84px]' : ''">
    <div class="relative md:h-[44rem] lg:h-[47rem]">
      <div class="relative h-[25rem] md:absolute md:inset-0 md:h-auto">
        <!-- (a wide photograph fills a tall box by its height: the copy asked for is as wide as that needs) -->
        <CmsImage v-if="block.image" :media="block.image" eager sizes="(min-aspect-ratio: 3/2) 100vw, 150vh" class="absolute inset-0 w-full h-full object-cover" />
        <div class="absolute inset-0" style="background: linear-gradient(180deg, color-mix(in srgb, var(--bg) 72%, transparent) 0%, color-mix(in srgb, var(--bg) 8%, transparent) 21%, color-mix(in srgb, var(--bg) 6%, transparent) 44%, color-mix(in srgb, var(--bg) 62%, transparent) 64%, color-mix(in srgb, var(--bg) 92%, transparent) 83%, var(--bg) 100%)" />
      </div>
      <div class="relative -mt-24 md:mt-0 md:absolute md:inset-x-0 md:bottom-0">
        <div class="wrap pb-8 md:pb-28 grid lg:grid-cols-12 gap-x-10 gap-y-5 items-end">
          <div class="lg:col-span-9">
            <p v-if="block.eyebrow" class="label !text-text">{{ block.eyebrow }}</p>
            <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[clamp(2.5rem,4.6vw,4.15rem)] leading-[1.03]"><KitMarked :text="block.heading" plain /></component>
          </div>
          <p v-if="block.text" class="lg:col-span-3 text-lg leading-relaxed lg:pb-2 max-w-[34ch]">{{ tidyText(block.text) }}</p>
        </div>
      </div>
    </div>

    <!-- Start of the enquiry -->
    <div class="wrap relative z-10 md:-mt-16">
      <form class="bg-surface border border-line p-4 md:p-5 grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 md:gap-4 items-end" @submit.prevent="submit">
        <label class="block">
          <span class="label">{{ words.arrivalLabel }}</span>
          <input v-model="quick.arrival" class="field mt-1.5" name="od" type="text" inputmode="numeric" :placeholder="words.dateExample[0]" :aria-label="words.arrivalAria">
        </label>
        <label class="block">
          <span class="label">{{ words.departureLabel }}</span>
          <input v-model="quick.departure" class="field mt-1.5" name="do" type="text" inputmode="numeric" :placeholder="words.dateExample[1]" :aria-label="words.departureAria">
        </label>
        <label class="block col-span-2 lg:col-span-1">
          <span class="label">{{ words.guestsLabel }}</span>
          <select v-model="quick.guests" class="field mt-1.5" name="osob">
            <option v-for="n in 7" :key="n" :value="String(n)">{{ words.guests(n) }}</option>
          </select>
        </label>
        <button class="btn col-span-2 lg:col-span-1" type="submit">{{ block.quickButton }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></button>
      </form>
      <p v-if="block.quickNote" class="mt-3 text-sm text-quiet">{{ block.quickNote }}</p>
    </div>
  </section>
</template>
