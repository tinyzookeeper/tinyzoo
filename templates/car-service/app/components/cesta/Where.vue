<script setup lang="ts">
// Cesta's "where": the way here drawn as a junction (straight on to the next town, right across
// the siding to the garage) instead of a map, a photograph of the yard, the way by car, the
// address and the week's hours as a table.
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, shortName, week, today, words } = await useGarage()
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
</script>

<template>
  <section :id="anchor" class="bg-paper py-16 lg:py-24 scroll-mt-4">
    <div class="wrap">
      <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-2 font-extrabold text-[38px] sm:text-[50px] max-w-[14em]">{{ plainEmphasis(block.heading) }}</component>
      <div class="mt-12 grid lg:grid-cols-12 gap-5 lg:gap-6">
        <!-- the approach, drawn; no map -->
        <div class="lg:col-span-7 rounded-[28px] bg-tint overflow-hidden">
          <svg viewBox="0 0 640 430" class="block w-full h-auto" role="img" :aria-label="words.approachLabel(block.comingFrom ?? '', block.towards ?? '', block.turnAt ?? '', block.distance ?? '')">
            <g fill="none" stroke="#fff" stroke-linecap="butt">
              <path d="M170 430V0" stroke-width="40" />
              <path d="M170 250H640" stroke-width="32" />
            </g>
            <g stroke="var(--ink)" stroke-width="3" opacity=".8"><path d="M338 222V278M352 222V278" /><path d="M330 230H360M330 242H360M330 258H360M330 270H360" stroke-width="2" /></g>
            <path d="M170 404V250H512" fill="none" stroke="var(--brand)" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" />
            <circle cx="530" cy="250" r="19" fill="var(--brand)" /><circle cx="530" cy="250" r="7" fill="#fff" />
            <path d="M170 34l-11 16h22z" fill="var(--quiet)" />
            <g font-family="'Red Hat Text', sans-serif" font-size="19" fill="var(--quiet)">
              <text x="206" y="52" font-family="'Red Hat Display', sans-serif" font-weight="700" font-size="22" fill="var(--ink)">{{ block.towards }}</text>
              <text x="206" y="78">{{ block.road }}</text>
              <text x="206" y="396">{{ block.comingFrom }}</text>
              <text x="206" y="218">{{ block.turnAt }}</text>
              <text x="345" y="306" text-anchor="middle">{{ block.landmark }}</text>
              <text x="446" y="190" font-family="'Red Hat Display', sans-serif" font-weight="800" font-size="27" fill="var(--ink)">{{ shortName }}</text>
              <text x="446" y="216">{{ block.distance }}</text>
            </g>
          </svg>
        </div>
        <CmsImage v-if="block.photo" :media="block.photo" sizes="(min-width: 1024px) 30rem, 100vw" class="lg:col-span-5 w-full h-full min-h-[260px] aspect-[3/2] lg:aspect-auto object-cover rounded-[28px]" />
      </div>
      <div class="mt-12 grid lg:grid-cols-12 gap-x-14 gap-y-10">
        <div class="lg:col-span-4">
          <h3 class="font-bold text-[25px]">{{ words.arrivalHeading }}</h3>
          <p v-if="block.arrival" class="mt-3 text-[17px] text-quiet">{{ tidyText(block.arrival) }}</p>
          <p v-if="block.keys" class="mt-3 text-[17px] text-quiet">{{ tidyText(block.keys) }}</p>
        </div>
        <div class="lg:col-span-3">
          <h3 class="font-bold text-[25px]">{{ words.addressHeading }}</h3>
          <p class="mt-3 text-[17px] leading-[1.6]">{{ settings?.siteName }}<br>{{ settings?.street }}<br>{{ [settings?.zip, settings?.city].filter(Boolean).join(' ') }}<template v-if="settings?.email"><br><a :href="`mailto:${settings.email}`" class="underline underline-offset-4 decoration-2 hover:text-brand">{{ settings.email }}</a></template></p>
          <p v-if="block.transit" class="mt-3 text-[17px] text-quiet">{{ tidyText(block.transit) }}</p>
        </div>
        <div class="lg:col-span-5">
          <h3 class="font-bold text-[25px]">{{ words.hoursHeading.cesta }}</h3>
          <table class="mt-3 w-full text-[18px]">
            <tbody>
              <tr v-for="(h, i) in week" :key="i" class="border-b border-line last:border-b-0">
                <th v-if="h && today.weekday === i" scope="row" class="text-left font-semibold py-2.5">{{ cap(words.weekdays[i]!) }} <span class="ml-2 inline-block rounded-full bg-brand text-brand-ink text-[13px] font-semibold px-2.5 py-0.5 align-middle">{{ words.todayBadge }}</span></th>
                <th v-else scope="row" class="text-left font-normal py-2.5" :class="h ? '' : 'text-quiet'">{{ cap(words.weekdays[i]!) }}<span v-if="h?.note" class="text-[15px] text-quiet ml-1"> {{ h.note }}</span></th>
                <td v-if="h" class="num text-right py-2.5" :class="today.weekday === i ? 'font-bold' : 'font-semibold'">{{ h.from }}–{{ h.to }}</td>
                <td v-else class="text-right py-2.5 text-quiet">{{ words.closed }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>
