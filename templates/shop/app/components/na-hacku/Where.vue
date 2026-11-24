<script setup lang="ts">
// Na háčku's last section: the week as seven round tokens (today's filled, the closed day
// dashed), the front of the shop beside a soft drawn plan with a dotted walk from the square and
// from the car park, and three cards with an icon each.
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, name, words, week, place } = await useShop()
const opening = useOpening(week)
// "7:30–17:00" as two lines on a phone: the dash stays with the first.
const stretches = (i: number) => week.value[i]!.map(([from, to]) => [formatTime(from), formatTime(to)] as const)
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 py-16 md:py-24">
    <div class="grid items-end gap-6 lg:grid-cols-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" :class="block.eyebrow ? 'mt-5' : ''" class="text-[2.3rem] md:text-[3.3rem]"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="settings?.hoursNote" class="text-[1.08rem] lg:col-span-5 lg:pb-2">{{ tidyText(settings.hoursNote) }}</p>
    </div>
    <ul class="mt-10 grid grid-cols-4 gap-3 md:grid-cols-7 md:gap-4 lg:mt-12 lg:gap-6" data-hours>
      <li v-for="(day, i) in words.daysShort" :key="i" class="day" :class="[{ 'is-today': opening?.day === i }, week[i]!.length ? '' : 'is-off']" :data-day="i">
        <span class="t">{{ words.todayMark }}</span><span class="d">{{ day }}</span>
        <span class="h"><template v-if="stretches(i).length === 1">{{ stretches(i)[0]![0] }}–<br class="md:hidden">{{ stretches(i)[0]![1] }}</template><template v-else>{{ dayText(week[i]!, words.closedDay) }}</template></span>
      </li>
    </ul>

    <div class="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-12 lg:gap-8">
      <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1024px) 38rem, 100vw" class="aspect-[4/3] h-full w-full rounded-[26px] object-cover lg:col-span-6" />
      <!-- the plan, drawn: no map -->
      <div class="aspect-[4/3] overflow-hidden rounded-[26px] bg-tint lg:col-span-6 lg:aspect-auto">
        <svg viewBox="0 0 600 450" class="block h-full w-full" role="img" :aria-label="words.sketch(name, place)">
          <rect width="600" height="450" fill="var(--tint)" />
          <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
            <path d="M-30 262C120 250 260 244 420 214S560 168 640 150" stroke-width="46" />
            <path d="M392 -30c-8 100 2 180 20 240s22 150 14 270" stroke-width="34" />
            <path d="M168 256c6 70 2 140-10 220" stroke-width="28" />
          </g>
          <rect x="30" y="78" width="150" height="112" rx="24" fill="#fff" />
          <rect x="446" y="268" width="124" height="108" rx="24" fill="var(--ink)" />
          <text x="508" y="342" text-anchor="middle" font-family="Gabarito, sans-serif" font-weight="800" font-size="60" fill="var(--card)">P</text>
          <path d="M176 196C208 226 240 238 266 234" fill="none" stroke="var(--brand)" stroke-width="6" stroke-dasharray="1 13" stroke-linecap="round" />
          <path d="M446 312C416 296 370 256 322 236" fill="none" stroke="var(--brand)" stroke-width="6" stroke-dasharray="1 13" stroke-linecap="round" />
          <circle cx="294" cy="214" r="34" fill="var(--brand)" />
          <g transform="translate(274 194) scale(.84)" fill="none" stroke="var(--card)" stroke-width="3.6" stroke-linecap="round"><g transform="rotate(42 24 26)"><circle cx="24" cy="9" r="5.5" /><path d="M24 14.5V44M24 37h6M24 30h4.5" /></g><g transform="rotate(-42 24 26)"><circle cx="24" cy="9" r="5.5" /><path d="M24 14.5V44M24 37h-6M24 30h-4.5" /></g></g>
          <g font-family="Nunito Sans, sans-serif" font-weight="800" font-size="20" fill="var(--ink)">
            <text x="105" y="128" text-anchor="middle">{{ (block.landmark ?? '').split(' ')[0] }}</text><text x="105" y="153" text-anchor="middle">{{ (block.landmark ?? '').split(' ').slice(1).join(' ') }}</text>
            <text x="34" y="300" opacity=".75">{{ streetOf(settings?.address) }}</text>
            <text x="190" y="420" opacity=".75">{{ block.sideStreet }}</text>
            <text x="508" y="404" text-anchor="middle">{{ block.parking }}</text>
            <text x="294" y="164" text-anchor="middle" font-size="23">{{ name }}</text>
            <text x="212" y="268" text-anchor="middle" font-size="18" fill="var(--brand)">{{ minutesOf(block.walk) }}</text>
            <text x="372" y="312" text-anchor="middle" font-size="18" fill="var(--brand)">{{ block.parkingDistance }}</text>
          </g>
        </svg>
      </div>
    </div>
    <div class="mt-6 grid gap-3 sm:grid-cols-3 lg:gap-8">
      <div class="flex items-start gap-4 rounded-[26px] bg-tint p-5"><span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-[1.3rem] text-card"><UIcon name="i-lucide-map-pin" aria-hidden="true" /></span><div><p class="disp text-[1.3rem] font-extrabold leading-tight">{{ place }}</p><p v-if="settings?.locationNote" class="mt-1 text-[0.97rem]">{{ tidyText(settings.locationNote) }}</p></div></div>
      <div v-for="(w, i) in block.ways" :key="i" class="flex items-start gap-4 rounded-[26px] bg-tint p-5"><span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-[1.3rem] text-card"><UIcon :name="`i-lucide-${w.icon ?? 'map-pin'}`" aria-hidden="true" /></span><div><p class="disp text-[1.3rem] font-extrabold leading-tight">{{ w.title || w.label }}</p><p v-if="w.text" class="mt-1 text-[0.97rem]">{{ tidyText(w.text) }}</p></div></div>
    </div>
  </section>
</template>
