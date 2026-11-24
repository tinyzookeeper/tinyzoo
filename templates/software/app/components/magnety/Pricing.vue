<script setup lang="ts">
// Magnets' price list: on the orange, one big tile for each plan (the highlighted one dark, the
// others cream and sky) with a huge price, then the limits on a board and what happens on the
// thirty-first day in a dashed tile.
import type { Plan, PlanLimit } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'pricing'>; first?: boolean; anchor?: string; plans: Plan[]; limits: PlanLimit[] }>()
const words = useSiteWords()
const look = computed(() => words.value.look.magnety)
const { settings } = await useSite()
const billing = ref<'monthly' | 'yearly'>('monthly')
const contactHref = `/#${anchorOf('contact')}`
const size = computed(() => byLength(props.block.heading, [[26, 'text-[44px] sm:text-[64px] lg:text-[84px]'], [44, 'text-[36px] sm:text-[48px] lg:text-[64px]']], 'text-[30px] sm:text-[40px] lg:text-[52px]'))
// The highlighted plan is the dark tile; the others alternate cream and sky.
const tone = (plan: Plan, i: number) => (plan.highlighted ? 'dark' : props.plans.slice(0, i).filter((p) => !p.highlighted).length % 2 === 0 ? 'cream' : 'sky')
</script>

<template>
  <section :id="anchor" class="bg-brand">
    <div class="wrap py-14 lg:py-24">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="mono">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="q mt-4" :class="size"><KitMarked :text="block.heading" /></component>
        </div>
        <div class="lg:col-span-5 lg:pb-3">
          <p v-if="block.text" class="font-medium">{{ tidyText(block.text) }}</p>
          <div class="mt-4 inline-flex rounded-full bg-ink p-1" role="group" :aria-label="words.paymentGroup">
            <button type="button" :aria-pressed="billing === 'monthly'" class="min-h-[44px] cursor-pointer rounded-full px-5 font-display text-[16px] font-bold text-cream transition-colors aria-pressed:bg-cream aria-pressed:text-ink" @click="billing = 'monthly'">{{ words.monthly }}</button>
            <button type="button" :aria-pressed="billing === 'yearly'" class="min-h-[44px] cursor-pointer rounded-full px-5 font-display text-[16px] font-bold text-cream transition-colors aria-pressed:bg-cream aria-pressed:text-ink" @click="billing = 'yearly'">{{ words.yearly }}</button>
          </div>
          <p v-if="block.yearlyNote" class="mt-3 text-[15px] font-medium">{{ tidyText(block.yearlyNote) }}</p>
        </div>
      </div>

      <div class="mt-8 grid gap-4 lg:mt-12 lg:grid-cols-3 lg:gap-5">
        <article v-for="(plan, i) in plans" :key="plan.id" class="tile flex flex-col p-6 lg:p-8" :class="tone(plan, i) === 'dark' ? 'on-dark bg-ink text-cream' : tone(plan, i) === 'sky' ? 'bg-sky' : 'bg-cream'">
          <div class="flex items-start justify-between gap-3">
            <h3 class="font-display text-[30px] font-extrabold leading-none tracking-[-0.02em]">{{ plan.name }}</h3>
            <span v-if="plan.highlighted && plan.badge" class="mono rounded-full bg-sky px-3 py-1.5 text-[10px] text-ink">{{ plan.badge }}</span>
          </div>
          <p v-if="plan.forWhom" class="mt-2 text-[16px]">{{ tidyText(plan.forWhom) }}</p>
          <p class="mt-6 flex items-baseline gap-2"><span class="q text-[72px] lg:text-[88px]">{{ planPrice(plan, billing).amount }}</span><span class="font-display text-[20px] font-bold">{{ look.priceUnit }}</span></p>
          <p class="mono mt-2">{{ look.priceNote(billing, planPrice(plan, billing).note.perMonthYearly, planPrice(plan, billing).note.perYear) }}</p>
          <ul class="mt-6 flex-1 space-y-2 border-t-2 pt-5 text-[16px] font-medium" :class="tone(plan, i) === 'dark' ? 'border-cream' : 'border-ink'">
            <li v-for="(item, n) in plan.items" :key="n" class="flex gap-2.5"><UIcon name="i-lucide-check" class="mt-0.5 size-5 flex-none" aria-hidden="true" />{{ tidyText(item.text) }}</li>
          </ul>
          <SiteLink v-if="settings?.ctaUrl" class="btn mt-7" :class="tone(plan, i) === 'dark' ? 'btn-brand' : 'border-2 border-ink hover:bg-ink hover:text-cream'" :to="settings.ctaUrl">{{ plan.buttonLabel || settings.ctaLabel }}</SiteLink>
        </article>
      </div>

      <div class="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-3 lg:gap-5">
        <div v-if="limits.length" class="tile bg-board p-4 sm:p-6 lg:col-span-2 lg:p-8">
          <table class="w-full table-fixed text-[14px] sm:text-[16px]">
            <caption class="sr-only">{{ words.limitsCaption }}</caption>
            <colgroup><col class="w-[30%]"><col v-for="p in plans" :key="p.id"></colgroup>
            <thead><tr class="font-display text-[15px] font-extrabold sm:text-[18px]"><th scope="col" class="pb-3 pr-2 text-left"><span class="mono font-normal">{{ words.limits }}</span></th><th v-for="(p, i) in plans" :key="p.id" scope="col" class="pb-3 text-left" :class="i < plans.length - 1 ? 'pr-2' : ''">{{ p.name }}</th></tr></thead>
            <tbody class="font-medium">
              <tr v-for="(l, r) in limits" :key="l.id" :class="r === 0 ? 'border-t-2 border-ink' : 'border-t border-ink/20'">
                <th scope="row" class="py-3 pr-2 text-left font-normal">{{ tidyText(l.name) }}</th>
                <td v-for="(p, i) in plans" :key="p.id" class="py-3" :class="i < plans.length - 1 ? 'pr-2' : ''">{{ tidyText(l.values[i]?.value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="block.afterText" class="tile flex flex-col justify-between gap-6 border-2 border-dashed border-ink p-6 lg:p-8">
          <div>
            <p v-if="block.afterLabel" class="mono">{{ block.afterLabel }}</p>
            <p class="mt-3 font-display text-[24px] font-bold leading-[1.15] tracking-[-0.01em]">{{ tidyText(block.afterText) }}</p>
          </div>
          <p class="text-[16px] font-medium"><template v-if="block.afterNote">{{ tidyText(block.afterNote) }} </template><KitMarked v-if="block.moreText" :text="block.moreText" as="a" :attrs="{ class: 'ul', href: contactHref }" /></p>
        </div>
      </div>
    </div>
  </section>
</template>
