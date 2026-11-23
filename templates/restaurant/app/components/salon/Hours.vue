<script setup lang="ts">
// Salon's hours and place: the week as a ruled list with today tinted, beside a panel with the
// house, the address and a line plan, and under it the ways to get there.
const props = defineProps<{ block: BlockOf<'hours'>; first?: boolean; anchor?: string }>()
const { settings, words, week, today } = await useRestaurant()
const ICONS: Record<string, string> = { walk: 'i-lucide-footprints', car: 'i-lucide-square-parking', bus: 'i-lucide-bus', bike: 'i-lucide-bike', other: 'i-lucide-map-pin' }
const plan = computed(() => !!props.block.planFrom)
const planAria = computed(() => words.value.plan([props.block.planFrom, props.block.planGate, props.block.planSquare, props.block.planStreet].filter(Boolean).join(' – ')))
const [from1, from2] = [computed(() => (props.block.planFrom ?? '').split(' ')[0] ?? ''), computed(() => (props.block.planFrom ?? '').split(' ').slice(1).join(' '))]
</script>

<template>
  <section :id="anchor" class="border-t border-line scroll-mt-6">
    <div class="wrap py-20 lg:py-24 grid lg:grid-cols-12 gap-14 lg:gap-16">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-5 font-display text-[2.4rem] lg:text-[3.3rem] leading-[1.08] tracking-[-.01em]"><KitMarked :text="block.heading" /></component>
        <ul class="hours mt-8 text-[1.12rem] border-y border-line">
          <li v-for="(d, i) in week" :key="i" :data-day="i" :class="i === today ? 'is-today' : ''">
            <span>{{ words.days[i] }}<span v-if="i === today" class="now">{{ words.today }}</span></span><span class="dots" /><span>{{ d.open == null ? words.closed : `${d.from}–${d.to}` }}</span>
          </li>
        </ul>
        <p v-if="settings?.hoursNote" class="mt-5 text-quiet">{{ tidyText(settings.hoursNote) }}</p>
      </div>

      <div class="lg:col-span-8">
        <div class="grid md:grid-cols-2 bg-panel">
          <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 768px) 28rem, 90vw" class="w-full h-full min-h-[16rem] aspect-[4/3] md:aspect-auto object-cover" />
          <div class="p-7 lg:p-10" :class="block.image ? '' : 'md:col-span-2'">
            <h2 v-if="block.placeLabel" class="label text-brand">{{ block.placeLabel }}</h2>
            <p class="mt-4 font-display text-[1.9rem] lg:text-[2.2rem] leading-[1.15]">{{ settings?.street }}<br>{{ [settings?.postalCode, settings?.city].filter(Boolean).join(' ') }}</p>
            <!-- a plan, drawn: no map -->
            <svg v-if="plan" class="plan mt-7 w-full" viewBox="0 0 340 146" role="img" :aria-label="planAria">
              <g fill="none" stroke="var(--quiet)" stroke-width="1">
                <rect x="6" y="40" width="78" height="62" />
                <rect x="84" y="60" width="16" height="22" stroke="var(--brand)" />
                <rect x="140" y="48" width="60" height="46" stroke-dasharray="3 3" />
                <path d="M100 71h40M200 71h134M246 71v66" />
              </g>
              <circle cx="286" cy="71" r="6" fill="var(--brand)" />
              <circle cx="286" cy="71" r="11" fill="none" stroke="var(--brand)" />
              <text x="6" y="17">{{ from1 }}</text>
              <text x="6" y="32">{{ from2 }}</text>
              <text v-if="block.planGate" x="92" y="120" text-anchor="middle">{{ block.planGate }}</text>
              <text x="166" y="75" style="fill:var(--text)">P</text>
              <text v-if="block.planSquare" x="140" y="38">{{ block.planSquare }}</text>
              <text x="270" y="48" style="fill:var(--brand)">{{ settings?.siteName }}</text>
              <text v-if="block.planStreet" x="204" y="63">{{ block.planStreet }}</text>
              <text v-if="block.planBus" x="255" y="135">{{ planWord(block.planBus) }}</text>
            </svg>
          </div>
        </div>
        <dl v-if="block.ways.length" class="grid sm:grid-cols-3 gap-x-10 gap-y-7 mt-9">
          <div v-for="(w, i) in block.ways" :key="i">
            <dt class="label text-brand flex items-center gap-2.5"><UIcon :name="ICONS[w.kind ?? 'other'] ?? ICONS.other!" class="text-base" aria-hidden="true" /> {{ w.label }}</dt>
            <dd class="mt-3 text-quiet">{{ tidyText(w.text) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
