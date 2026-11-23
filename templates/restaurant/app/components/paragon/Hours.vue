<script setup lang="ts">
// Paragon's hours and place: the week on a sheet with today circled in red pencil, and beside it
// the address large, a plan drawn by pen, a print of the house and the ways to get there.
const props = defineProps<{ block: BlockOf<'hours'>; first?: boolean; anchor?: string }>()
const { settings, words, week, today, address } = await useRestaurant()
const w = computed(() => words.value.paragon)
const plan = computed(() => !!props.block.planFrom)
const planAria = computed(() => words.value.plan([props.block.planFrom, props.block.planGate, props.block.planSquare, props.block.planStreet].filter(Boolean).join(' – ')))
const [from1, from2] = [computed(() => (props.block.planFrom ?? '').split(' ')[0] ?? ''), computed(() => (props.block.planFrom ?? '').split(' ').slice(1).join(' '))]
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-28 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10 items-start">
      <div class="lg:col-span-5 sheet px-6 pt-9 pb-7 sm:px-9 sm:pt-11">
        <component :is="first ? 'h1' : 'h2'" class="h text-[2.1rem] sm:text-[2.6rem] pb-4 border-b-[3px] border-double border-ink"><KitMarked :text="block.heading" plain /></component>
        <ul class="hours text-[1.06rem]">
          <li v-for="(d, i) in week" :key="i" :data-day="i" :class="i === today ? 'is-today' : ''"><span>{{ words.days[i]!.toLowerCase() }}</span><span>{{ d.open == null ? words.closed : `${d.from}–${d.to}` }}</span></li>
        </ul>
        <p v-if="settings?.hoursNote" class="mt-5 text-[.95rem]">{{ tidyText(settings.hoursNote) }}</p>
      </div>

      <div class="lg:col-span-7">
        <h2 v-if="block.placeLabel" class="print">{{ block.placeLabel }}</h2>
        <p class="h mt-3 text-[2.5rem] sm:text-[3.3rem] lg:text-[4rem]">{{ address }}</p>
        <div class="mt-7 grid sm:grid-cols-2 gap-7 items-start">
          <!-- a plan, drawn by pen: no map -->
          <svg v-if="plan" class="plan w-full" viewBox="0 0 300 232" role="img" :aria-label="planAria">
            <g fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 56c24-2 50-1 76 0 1 22 0 46 1 68-26 1-52 2-77 0-1-23 1-46 0-68z" />
              <path d="M91 78c6-1 12 0 18 0 0 9 1 18 0 27-6 1-12 0-18 0" />
              <path d="M138 62c20-1 40 0 60 1 1 18 0 38 0 56-20 1-40 1-60 0 0-19-1-38 0-57z" stroke-dasharray="1 7" />
              <path d="M109 91c10 0 19 1 29 0M198 91c33-2 66 1 98-1M232 92c1 36-1 72 1 108" />
            </g>
            <g fill="none" stroke="var(--brand)" stroke-width="2.6" stroke-linecap="round">
              <path d="M253 81l18 19M271 81l-18 19" />
              <path d="M262 68c16-2 27 9 26 23-1 13-12 22-27 21-14-1-24-11-23-24 1-11 10-19 22-20" />
            </g>
            <text x="14" y="30">{{ from1 }}</text>
            <text x="14" y="45">{{ from2 }}</text>
            <text v-if="block.planGate" x="100" y="144" text-anchor="middle" style="font-weight:700">{{ block.planGate }}</text>
            <text x="162" y="97" style="font-weight:700;font-size:16px">P</text>
            <text v-if="block.planSquare" x="138" y="52">{{ block.planSquare }}</text>
            <text x="244" y="56" style="font-weight:700;fill:var(--brand);font-size:15px">{{ settings?.siteName }}</text>
            <text v-if="block.planStreet" x="298" y="130" text-anchor="end">{{ block.planStreet }}</text>
            <text v-if="block.planBus" x="222" y="184" text-anchor="end">{{ block.planBus }}</text>
            <text v-if="block.planTrain" x="222" y="200" text-anchor="end">{{ block.planTrain }}</text>
          </svg>
          <figure v-if="block.image" class="photo">
            <CmsImage :media="block.image" sizes="(min-width: 1024px) 20rem, 90vw" class="w-full aspect-[4/3] object-cover" />
            <figcaption v-if="block.imageCaption">{{ w.figure(5, block.imageCaption) }}</figcaption>
          </figure>
        </div>
        <dl v-if="block.ways.length" class="mt-7 border-t rule">
          <div v-for="(way, i) in block.ways" :key="i" class="grid sm:grid-cols-[9rem_1fr] gap-x-6 py-3 border-b rule"><dt class="font-bold">{{ way.label }}</dt><dd>{{ tidyText(way.text) }}</dd></div>
        </dl>
      </div>
    </div>
  </section>
</template>
