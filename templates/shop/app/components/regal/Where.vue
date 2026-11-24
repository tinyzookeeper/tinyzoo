<script setup lang="ts">
// Regál's last section: the week as heavy ruled rows (today's inverted, with a flag), the front
// of the shop beside a plan of the streets drawn in the page's colours, and three cards with the
// address and the way there.
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, name, words, week, place } = await useShop()
const opening = useOpening(week)
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 py-16 md:py-24">
    <component :is="first ? 'h1' : 'h2'" class="text-[2.3rem] font-bold tracking-[-0.035em] md:text-[3.5rem]"><KitMarked :text="block.heading" /></component>
    <div class="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-12 lg:gap-10">
      <div class="lg:col-span-4">
        <ul class="border-t-[6px] border-ink" data-hours>
          <li v-for="(day, i) in words.days" :key="i" class="day" :class="{ 'is-today': opening?.day === i }" :data-day="i">
            <span class="cond text-[1.7rem] !font-bold">{{ day }}<span class="mark">{{ words.todayMark }}</span></span><span class="num text-[1.9rem]">{{ dayText(week[i]!, words.closedDay) }}</span>
          </li>
        </ul>
        <p v-if="settings?.hoursNote" class="mt-4 text-[0.95rem]">{{ tidyText(settings.hoursNote) }}</p>
      </div>

      <!-- the plan, drawn: no map -->
      <div class="lg:col-span-8">
        <div class="grid gap-[5px] sm:grid-cols-2">
          <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 28rem, (min-width: 640px) 45vw, 100vw" class="aspect-[4/3] h-full w-full object-cover" />
          <svg viewBox="0 0 400 300" class="h-auto w-full bg-tint" role="img" :aria-label="words.sketch(name, place)">
            <g fill="var(--paper)">
              <rect x="-10" y="118" width="420" height="34" />
              <rect x="250" y="-10" width="28" height="320" />
              <rect x="94" y="152" width="28" height="160" />
            </g>
            <rect x="18" y="20" width="92" height="76" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 5" />
            <rect x="298" y="174" width="84" height="104" fill="var(--ink)" />
            <text x="340" y="244" text-anchor="middle" font-family="Saira Extra Condensed, sans-serif" font-weight="700" font-size="58" fill="var(--paper)">P</text>
            <rect x="150" y="76" width="42" height="42" fill="var(--rail)" />
            <path d="M150 152h42v22h-42z" fill="none" stroke="var(--ink)" stroke-width="2" />
            <path d="M171 157v12M165 163h12" stroke="var(--ink)" stroke-width="3" />
            <g font-family="Saira Extra Condensed, sans-serif" font-weight="600" font-size="17" fill="var(--ink)" letter-spacing=".06em">
              <text x="26" y="141">{{ streetOf(settings?.address).toUpperCase() }}</text>
              <text x="64" y="62" text-anchor="middle">{{ (block.landmark ?? '').split(' ')[0]?.toUpperCase() }}</text><text x="64" y="80" text-anchor="middle">{{ (block.landmark ?? '').split(' ').slice(1).join(' ').toUpperCase() }}</text>
              <text x="340" y="298" text-anchor="middle">{{ (block.parking ?? '').toUpperCase() }}</text>
              <text x="200" y="169">{{ (block.opposite ?? '').toUpperCase() }}</text>
              <text transform="rotate(-90 113 232)" x="113" y="232" text-anchor="middle" font-size="15">{{ (block.sideStreet ?? '').toUpperCase() }}</text>
            </g>
            <text x="171" y="66" text-anchor="middle" font-family="Saira Extra Condensed, sans-serif" font-weight="800" font-size="22" fill="var(--rail)" letter-spacing=".04em">{{ words.regal.number(numberOf(settings?.address)) }}</text>
          </svg>
        </div>
        <div class="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-3">
          <div class="border-t-[6px] border-ink pt-3">
            <p class="cond text-[1.2rem]">{{ words.address }}</p>
            <p class="mt-2 text-[1.2rem] font-bold leading-tight tracking-[-0.02em]">{{ settings?.address }}<br>{{ [settings?.postalCode, settings?.town].filter(Boolean).join(' ') }}</p>
            <p v-if="settings?.locationNote" class="mt-2 text-[0.95rem] leading-snug">{{ tidyText(settings.locationNote) }}</p>
          </div>
          <div v-for="(w, i) in block.ways" :key="i" class="border-t-[6px] border-ink pt-3">
            <p class="cond text-[1.2rem]">{{ w.label }}</p>
            <p v-if="w.title" class="mt-2 text-[1.2rem] font-bold leading-tight tracking-[-0.02em]">{{ w.title }}</p>
            <p v-if="w.text" class="mt-2 text-[0.95rem] leading-snug">{{ tidyText(w.text) }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
