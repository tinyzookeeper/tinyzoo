<script setup lang="ts">
// Ode dveří's opening: a calm heading with three distances from the door beside a large
// rounded photograph of the house (a small second one tucked into its corner on wide
// screens), and the short enquiry form floating below. The form carries the dates to the
// enquiry further down.
defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string }>()
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
  <section :id="anchor" class="wrap pt-4 md:pt-8 pb-16 md:pb-24">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-8 items-center">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[clamp(2.4rem,4.5vw,3.9rem)] leading-[1.05] tracking-[-0.035em]"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'block' }" /></component>
        <p v-if="block.text" class="mt-5 text-lg md:text-xl leading-relaxed text-quiet max-w-[36ch]">{{ tidyText(block.text) }}</p>

        <dl v-if="block.distances.length" class="mt-8 grid max-w-md num" :style="{ gridTemplateColumns: `repeat(${Math.min(3, block.distances.length)}, minmax(0, 1fr))` }" :aria-label="words.distancesLabel">
          <div v-for="(d, i) in block.distances.slice(0, 3)" :key="d.id" :class="i === 0 ? 'pr-4' : i === Math.min(3, block.distances.length) - 1 ? 'pl-4 border-l border-line' : 'px-4 border-l border-line'">
            <dd class="text-[1.45rem] font-semibold tracking-[-0.02em] text-ink leading-tight">{{ d.value }}</dd>
            <dt class="text-sm text-quiet">{{ d.label }}</dt>
          </div>
        </dl>
      </div>

      <div v-if="block.image" class="lg:col-span-7 relative order-first lg:order-none">
        <div class="ph aspect-[4/3] !rounded-[28px]"><CmsImage :media="block.image" eager sizes="(min-width: 1024px) 46rem, 100vw" /></div>
        <div v-if="block.secondImage" class="hidden lg:block absolute -left-10 -bottom-8 w-44 aspect-square ph !rounded-[22px] ring-[8px] ring-paper"><CmsImage :media="block.secondImage" sizes="11rem" /></div>
      </div>
    </div>

    <!-- Start of the enquiry -->
    <form class="mt-8 md:mt-14 bg-paper rounded-[24px] p-4 md:p-5 grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 md:gap-4 items-end shadow-[0_18px_50px_-18px_rgba(23,33,30,0.28),0_0_0_1px_rgba(23,33,30,0.07)]" @submit.prevent="submit">
      <label class="block"><span class="flabel">{{ words.arrivalLabel }}</span><input v-model="quick.arrival" class="field" name="od" type="text" :placeholder="words.dateExample[0]" :aria-label="words.arrivalAria"></label>
      <label class="block"><span class="flabel">{{ words.departureLabel }}</span><input v-model="quick.departure" class="field" name="do" type="text" :placeholder="words.dateExample[1]" :aria-label="words.departureAria"></label>
      <label class="block col-span-2 lg:col-span-1"><span class="flabel">{{ words.guestsLabel }}</span>
        <select v-model="quick.guests" class="field" name="osob"><option v-for="n in 7" :key="n" :value="String(n)">{{ words.guests(n) }}</option></select>
      </label>
      <button class="btn col-span-2 lg:col-span-1" type="submit">{{ block.quickButton }}</button>
    </form>
    <p v-if="block.quickNote" class="mt-4 text-sm text-quiet md:pl-5">{{ block.quickNote }}</p>
  </section>
</template>
