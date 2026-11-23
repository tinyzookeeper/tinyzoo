<script setup lang="ts">
// Šuplíky's "where": a plan of the yard instead of a map (the way in from the street, the gate and
// the key box, the parking, the workshop with its two bays), the way by car, a photograph, and
// the week's hours on a dark row for today.
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, week, today, words } = await useGarage()
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
</script>

<template>
  <section :id="anchor" class="bg-card py-16 lg:py-24 scroll-mt-4">
    <div class="wrap">
      <p v-if="block.eyebrow" class="kicker text-brand">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[42px] sm:text-[60px] max-w-[13em]">{{ plainEmphasis(block.heading) }}</component>
      <div class="mt-10 grid lg:grid-cols-12 gap-x-10 gap-y-10">
        <div class="lg:col-span-7">
          <div class="rounded-[28px] bg-paper p-3 sm:p-5">
            <svg viewBox="0 0 640 430" class="block w-full h-auto" role="img" :aria-label="words.planLabel(block.streetLabel ?? '')">
              <!-- street -->
              <rect x="0" y="352" width="640" height="78" rx="14" fill="var(--tint)" />
              <path d="M20 391H620" stroke="var(--card)" stroke-width="4" stroke-dasharray="26 22" />
              <!-- siding -->
              <g stroke="var(--ink)" stroke-width="4"><path d="M40 344V430M64 344V430" /><path d="M32 362H72M32 380H72M32 398H72M32 416H72" stroke-width="3" /></g>
              <!-- fence and gate -->
              <path d="M100 344H292M398 344H628" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
              <path d="M292 344L262 300M398 344L428 300" stroke="#2f7d4f" stroke-width="7" stroke-linecap="round" />
              <!-- workshop -->
              <rect x="100" y="16" width="528" height="118" rx="14" fill="var(--brand)" />
              <rect x="236" y="122" width="108" height="14" rx="4" fill="var(--card)" /><rect x="378" y="122" width="108" height="14" rx="4" fill="var(--card)" /><rect x="128" y="122" width="62" height="14" rx="4" fill="var(--ink)" />
              <!-- parking -->
              <g fill="none" stroke="var(--ink)" stroke-width="3" stroke-dasharray="7 6"><path d="M530 172H626M612 195H626M612 218H626M612 241H626M612 264H626M612 287H626M530 310H626M530 172V310" /></g>
              <!-- key box -->
              <rect x="238" y="320" width="18" height="18" rx="4" fill="var(--ink)" />
              <!-- the way in -->
              <path d="M12 372H345V214" fill="none" stroke="var(--brand)" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" />
              <path d="M345 182l-20 34h40z" fill="var(--brand)" />
              <g font-family="Rubik, sans-serif" font-size="20" font-weight="500" fill="var(--ink)">
                <text x="124" y="60" fill="#fff" font-family="Kanit, sans-serif" font-style="italic" font-weight="700" font-size="34">{{ words.plan.workshop }}</text>
                <text x="124" y="90" fill="#fff" font-size="19">{{ block.workshopNote }}</text>
                <text x="290" y="164" text-anchor="middle">{{ words.plan.lift1 }}</text><text x="432" y="164" text-anchor="middle">{{ words.plan.lift2 }}</text><text x="159" y="164" text-anchor="middle">{{ words.plan.reception }}</text>
                <text x="568" y="246" text-anchor="middle" font-family="Kanit, sans-serif" font-weight="700" font-size="40">P</text>
                <text x="568" y="274" text-anchor="middle" font-size="19">{{ block.places }}</text>
                <text x="230" y="336" text-anchor="end">{{ block.keyLabel }}</text>
                <text x="438" y="336">{{ block.gateLabel }}</text>
                <text x="88" y="417">{{ block.landmark }}</text>
                <text x="452" y="417">{{ block.streetLabel }}</text>
              </g>
            </svg>
          </div>
          <p v-if="block.arrival || block.keys" class="mt-5 text-[16.5px] max-w-[40em]">{{ tidyText([block.arrival, block.keys].filter(Boolean).join(' ')) }}</p>
          <p v-if="block.transit" class="mt-2 text-[16px] text-quiet">{{ tidyText(block.transit) }}</p>
        </div>
        <div class="lg:col-span-5">
          <CmsImage v-if="block.photo" :media="block.photo" sizes="(min-width: 1024px) 30rem, 100vw" class="w-full aspect-[3/2] object-cover rounded-[28px]" />
          <h3 class="mt-9 text-[28px]">{{ words.hoursHeading.supliky }}</h3>
          <table class="mt-4 w-full text-[18px]">
            <tbody>
              <tr v-for="(h, i) in week" :key="i" :class="h && today.weekday === i ? '' : (i < 6 ? 'border-b-2 border-tint' : '')">
                <template v-if="h && today.weekday === i">
                  <th scope="row" class="text-left font-semibold py-2.5 px-4 rounded-l-[14px] bg-ink text-white">{{ cap(words.weekdays[i]!) }} <span class="text-[13px] font-medium uppercase tracking-[0.06em] ml-2 opacity-80">{{ words.todayBadge }}</span></th>
                  <td class="num text-right py-2.5 px-4 rounded-r-[14px] bg-ink text-white text-[20px]">{{ h.from }}–{{ h.to }}</td>
                </template>
                <template v-else>
                  <th scope="row" class="text-left font-normal py-2.5 px-4" :class="h ? '' : 'text-quiet'">{{ cap(words.weekdays[i]!) }}<span v-if="h?.note" class="text-[14px] text-quiet ml-1">{{ ' ' }}{{ h.note }}</span></th>
                  <td v-if="h" class="num text-right py-2.5 px-4 text-[20px]">{{ h.from }}–{{ h.to }}</td>
                  <td v-else class="text-right py-2.5 px-4 text-quiet">{{ words.closed }}</td>
                </template>
              </tr>
            </tbody>
          </table>
          <p class="mt-6 text-[17px] leading-[1.6]"><b class="font-semibold">{{ settings?.siteName }}</b><br>{{ [settings?.street, [settings?.zip, settings?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') }}<template v-if="settings?.email"><br><a :href="`mailto:${settings.email}`" class="underline underline-offset-4 decoration-2 hover:text-brand">{{ settings.email }}</a></template></p>
        </div>
      </div>
    </div>
  </section>
</template>
