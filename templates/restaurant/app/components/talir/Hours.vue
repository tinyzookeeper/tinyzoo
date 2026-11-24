<script setup lang="ts">
// Talíř's hours and place: two columns. The week as a ruled table with today filled with the
// brand colour; the house, the address and a thick-line plan in a box, and the ways to get there.
const props = defineProps<{ block: BlockOf<'hours'>; first?: boolean; anchor?: string }>()
const { settings, words, week, today } = await useRestaurant()
// The poster headings are sized for one short word ("Kdy", "Kde"); a longer one gets smaller type and two lines.
const size = (text: string | null | undefined) => byLength(text, [[8, 'text-[2.5rem] lg:text-[4.4rem]']], 'text-[2rem] lg:text-[3.1rem]')
const plan = computed(() => !!props.block.planFrom)
const planAria = computed(() => words.value.plan([props.block.planFrom, props.block.planGate, props.block.planSquare, props.block.planStreet].filter(Boolean).join(' – ')))
const note = computed(() => { const n = settings.value?.addressNote?.trim() ?? ''; return n ? `${n[0]!.toUpperCase()}${n.slice(1)}` : '' })
const [from1, from2] = [computed(() => (props.block.planFrom ?? '').split(' ')[0] ?? ''), computed(() => (props.block.planFrom ?? '').split(' ').slice(1).join(' '))]
</script>

<template>
  <section :id="anchor" class="border-t-2 border-ink scroll-mt-4">
    <div class="wrap grid lg:grid-cols-12 lg:gap-x-16">
      <div class="lg:col-span-5 py-16 lg:py-24">
        <component :is="first ? 'h1' : 'h2'" class="wide" :class="size(block.heading)"><KitMarked :text="block.heading" plain /></component>
        <ul class="hours mt-7 num text-[1.5rem] lg:text-[1.6rem] xl:text-[1.8rem] whitespace-nowrap">
          <li v-for="(d, i) in week" :key="i" :data-day="i" :class="i === today ? 'is-today' : ''"><span>{{ words.days[i] }}<span v-if="i === today" class="now">{{ words.today }}</span></span><span>{{ d.open == null ? words.closed : `${d.from}–${d.to}` }}</span></li>
        </ul>
        <p v-if="settings?.hoursNote" class="mt-5 muted max-w-[28rem]">{{ tidyText(settings.hoursNote) }}</p>
      </div>

      <div class="lg:col-span-7 pb-16 lg:py-24">
        <h2 v-if="block.placeLabel" class="wide" :class="size(block.placeLabel)">{{ block.placeLabel }}</h2>
        <div class="mt-7 grid sm:grid-cols-2 gap-6 lg:gap-8 items-start">
          <div>
            <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 24rem, 90vw" class="w-full aspect-[4/3] object-cover" />
            <p class="num mt-5 text-[2rem] lg:text-[2.3rem] !leading-[1.05]">{{ settings?.street }}<br>{{ [settings?.postalCode, settings?.city].filter(Boolean).join(' ') }}</p>
            <p v-if="note" class="mt-3 muted">{{ tidyText(note) }}</p>
          </div>
          <!-- a plan, drawn: no map -->
          <svg v-if="plan" class="plan w-full border-2 border-ink" viewBox="0 0 300 240" role="img" :aria-label="planAria">
            <g fill="none" stroke="var(--ink)" stroke-width="3">
              <rect x="16" y="58" width="74" height="76" />
              <rect x="90" y="82" width="18" height="28" fill="var(--ink)" />
              <rect x="132" y="64" width="62" height="64" stroke-dasharray="6 5" />
              <path d="M108 96h24M194 96h106M228 96v144" />
            </g>
            <circle cx="264" cy="96" r="15" fill="var(--brand)" stroke="var(--ink)" stroke-width="3" />
            <text x="16" y="34">{{ from1 }}</text>
            <text x="16" y="50">{{ from2 }}</text>
            <text v-if="block.planGate" x="99" y="154" text-anchor="middle">{{ block.planGate }}</text>
            <text x="156" y="103" style="font-size:20px">P</text>
            <text v-if="block.planSquare" x="132" y="54">{{ block.planSquare }}</text>
            <text x="244" y="66" style="font-size:17px">{{ settings?.siteName }}</text>
            <text v-if="block.planStreet" x="244" y="130">{{ block.planStreet }}</text>
            <text v-if="block.planBus" x="216" y="206" text-anchor="end">{{ block.planBus }}</text>
            <text v-if="block.planTrain" x="216" y="224" text-anchor="end">{{ block.planTrain }}</text>
          </svg>
        </div>
        <dl v-if="block.ways.length" class="mt-8 grid sm:grid-cols-3 border-t-2 border-ink sm:divide-x-2 divide-ink max-sm:divide-y-2 border-b-2">
          <div v-for="(w, i) in block.ways" :key="i" class="py-4" :class="i === 0 ? 'sm:pr-5' : i === block.ways.length - 1 ? 'sm:pl-5' : 'sm:px-5'">
            <dt class="cap">{{ w.label }}</dt>
            <dd class="mt-1.5 text-[.98rem]">{{ tidyText(w.text) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
