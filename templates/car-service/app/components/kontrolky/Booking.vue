<script setup lang="ts">
// Kontrolky's booking: the heading, a gauge whose scale is the weekdays (the needle stands on
// the next free day of Site settings) and the phone number, beside the request form.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'booking'>; first?: boolean; anchor?: string; form: SiteForm }>()
const garage = await useGarage()
const { settings, phone, phoneUrl, phone2, phone2Url, tyresInSentence, words } = garage
const form = props.form
const book = useBookingForm(form, () => props.block, garage)

// The gauge: weekdays on the dial (Monday to Saturday), the needle on the next free day.
const gauge = computed(() => {
  const next = settings.value?.nextService
  if (!next) return null
  const day = dayOf(next), cx = 130, cy = 132, r = 100, a0 = -110, step = 44
  const at = Math.min(weekdayOf(day), 5)
  const pt = (a: number, rr: number): [number, number] => [cx + rr * Math.sin(a * Math.PI / 180), cy - rr * Math.cos(a * Math.PI / 180)]
  const f = (n: number) => n.toFixed(1)
  const arc = (a1: number, a2: number, rr: number) => { const [x1, y1] = pt(a1, rr), [x2, y2] = pt(a2, rr); return `M${f(x1)} ${f(y1)}A${rr} ${rr} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${f(x2)} ${f(y2)}` }
  const free = a0 + at * step
  const ticks = Array.from({ length: 26 }, (_, i) => { const a = a0 + i * step / 5, major = i % 5 === 0, [x1, y1] = pt(a, r - (major ? 13 : 7)), [x2, y2] = pt(a, r - 2); return { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), major } })
  const labels = words.value.gaugeDays.map((d, i) => { const [x, y] = pt(a0 + i * step, r - 27); return { d, x: f(x), y: f(y + 5), now: i === at, past: i < at } })
  const [nx, ny] = pt(free, r - 20), [bx, by] = pt(free + 180, 14)
  return { track: arc(a0, free, r), rest: arc(free, a0 + 5 * step, r), ticks, labels, needle: { x1: f(bx), y1: f(by), x2: f(nx), y2: f(ny) }, caption: longDay(day, words.value) }
})
</script>

<template>
  <section :id="anchor" class="bg-panel py-16 lg:py-28 scroll-mt-2">
    <div class="wrap grid lg:grid-cols-12 gap-x-14 gap-y-12">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
        <p class="mt-5 text-quiet max-w-[28em]">{{ tidyText([block.text, words.freeTyresSentence(tyresInSentence)].filter(Boolean).join(' ')) }}</p>
        <svg v-if="gauge" viewBox="0 0 260 214" class="mt-9 w-[250px] max-w-full h-auto" role="img" :aria-label="words.gaugeLabel(gauge.caption)">
          <path :d="gauge.track" fill="none" stroke="var(--line)" stroke-width="3" /><path :d="gauge.rest" fill="none" stroke="var(--brand)" stroke-width="5" />
          <line v-for="(t, i) in gauge.ticks" :key="i" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" :stroke="t.major ? '#fff' : 'var(--quiet)'" :stroke-width="t.major ? 2 : 1" />
          <text v-for="l in gauge.labels" :key="l.d" :x="l.x" :y="l.y" text-anchor="middle" font-family="Oxanium, sans-serif" font-size="14" :font-weight="l.now ? 700 : 500" :fill="l.now ? 'var(--brand)' : l.past ? 'var(--quiet)' : '#fff'">{{ l.d }}</text>
          <line :x1="gauge.needle.x1" :y1="gauge.needle.y1" :x2="gauge.needle.x2" :y2="gauge.needle.y2" stroke="#ff6a57" stroke-width="3.5" stroke-linecap="round" /><circle cx="130" cy="132" r="9" fill="var(--panel)" stroke="#fff" stroke-width="2" />
          <text x="130" y="186" text-anchor="middle" font-family="Oxanium, sans-serif" font-size="24" font-weight="600" fill="var(--brand)">{{ gauge.caption }}</text><text x="130" y="207" text-anchor="middle" font-family="Sora, sans-serif" font-size="12" fill="var(--quiet)">{{ words.gaugeCaption }}</text>
        </svg>
        <div class="mt-9 pt-8 border-t border-line">
          <p v-if="block.callLabel" class="text-[16px] text-quiet">{{ block.callLabel }}</p>
          <a v-if="phone" :href="phoneUrl" class="dig mt-1 inline-block text-[44px] sm:text-[54px] font-semibold leading-none text-brand hover:text-white transition-colors">{{ phone }}</a>
          <p v-if="block.callNote" class="mt-4 text-[16px] text-quiet">{{ book.callParts.value[0] }}<template v-if="book.callParts.value[1] !== null"><a :href="phone2Url" class="dig font-semibold text-[18px] text-text underline underline-offset-4 whitespace-nowrap hover:text-brand">{{ phone2 }}</a>{{ book.callParts.value[1] }}</template></p>
        </div>
      </div>
      <form v-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 grid sm:grid-cols-2 gap-x-5 gap-y-5 content-start" novalidate @submit.prevent="form.submit">
        <label class="block"><span class="text-[15.5px] font-medium">{{ book.label('name') }}</span><input v-model="form.values.name" class="field mt-2" type="text" name="name" autocomplete="name" required :aria-invalid="!!form.errors.name"><span v-if="form.errors.name" class="field-error block">{{ form.errors.name }}</span></label>
        <label class="block"><span class="text-[15.5px] font-medium">{{ book.label('phone') }}</span><input v-model="form.values.phone" class="field mt-2" type="tel" name="phone" autocomplete="tel" :placeholder="book.help('phone')" required :aria-invalid="!!form.errors.phone"><span v-if="form.errors.phone" class="field-error block">{{ form.errors.phone }}</span></label>
        <label class="block"><span class="text-[15.5px] font-medium">{{ book.carLabel.value }}</span><input v-model="form.values.car" class="field mt-2" type="text" name="car" :placeholder="book.help('car')" required :aria-invalid="!!form.errors.car"><span v-if="form.errors.car" class="field-error block">{{ form.errors.car }}</span></label>
        <label class="block"><span class="text-[15.5px] font-medium">{{ book.label('plate') }} <span v-if="book.plateLabel.value" class="text-quiet font-normal">{{ book.plateLabel.value }}</span></span><input v-model="form.values.plate" class="field mt-2 uppercase dig tracking-[0.08em]" type="text" name="plate" :placeholder="book.help('plate')" maxlength="9"></label>
        <label class="block sm:col-span-2"><span class="text-[15.5px] font-medium">{{ book.label('message') }}</span><textarea v-model="form.values.message" class="field mt-2" name="message" rows="5" :placeholder="book.messageHint.value" required :aria-invalid="!!form.errors.message" /><span v-if="form.errors.message" class="field-error block">{{ form.errors.message }}</span></label>
        <label class="block"><span class="text-[15.5px] font-medium">{{ book.label('when') }}</span>
          <select v-model="form.values.when" class="field mt-2" name="when"><option v-for="d in book.days.value" :key="d" :value="d">{{ d }}</option></select>
        </label>
        <label class="flex items-center gap-3 sm:mt-8 min-h-[54px] cursor-pointer"><input v-model="form.values.loaner" type="checkbox" name="loaner" class="w-6 h-6 accent-[var(--brand)]"><span>{{ book.loanerLabel.value }}</span></label>
        <KitFormExtras :form="form" />
        <div class="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
          <button type="submit" class="btn btn-brand" :disabled="form.sending.value">{{ form.sending.value ? words.sending : book.submitLabel.value }}</button>
          <p v-if="block.privacyNote" class="text-[14.5px] text-quiet flex-1 min-w-[220px]">{{ block.privacyNote }}</p>
          <p v-if="form.sent.value" class="basis-full font-display font-semibold text-brand" role="status">{{ book.sentText.value }}</p>
          <p v-if="form.failure.value" class="basis-full field-error" role="alert">{{ form.failure.value }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
