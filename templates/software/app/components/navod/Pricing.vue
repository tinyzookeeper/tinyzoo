<script setup lang="ts">
// Návod's price list: one ruled table. The first column holds the switch between monthly and
// yearly payment and what happens after the trial, then one column for each plan (the
// highlighted one tinted), and under them the limits of each plan in the same columns.
import type { Plan, PlanLimit } from '../../lib/cms-content'

defineProps<{ block: BlockOf<'pricing'>; first?: boolean; anchor?: string; plans: Plan[]; limits: PlanLimit[] }>()
const words = useSiteWords()
const look = computed(() => words.value.look.navod)
const { settings } = await useSite()
const sections = await usePageSections()
const number = computed(() => sectionNumber(sections.value, 'pricing'))
const billing = ref<'monthly' | 'yearly'>('monthly')
const contactHref = `/#${anchorOf('contact')}`
</script>

<template>
  <section :id="anchor" class="border-t border-ink/15 bg-sheet">
    <div class="wrap py-16 lg:py-24">
      <div class="grid gap-6 lg:grid-cols-12 lg:gap-12">
        <div class="lg:col-span-5">
          <p v-if="block.eyebrow" class="label text-quiet"><span class="text-brand">{{ number }}</span> · {{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" v-bind="cmsField('heading')" class="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink lg:text-[42px]"><KitMarked :text="block.heading" /></component>
        </div>
        <p v-if="block.text" class="max-w-[36rem] lg:col-span-7 lg:pt-2">{{ tidyText(block.text) }}</p>
      </div>

      <div class="mt-10 grid gap-y-6 border-t border-ink lg:mt-14 lg:gap-y-0" :class="plans.length === 3 ? 'lg:grid-cols-[1.05fr_1fr_1fr_1fr]' : 'lg:grid-cols-[1.05fr_repeat(auto-fit,minmax(0,1fr))]'">
        <div class="pt-6 lg:pr-8 lg:pt-8">
          <p class="label text-quiet">{{ words.paymentLabel }}</p>
          <div class="mt-3 inline-flex border border-ink p-0.5" role="group" :aria-label="words.paymentGroup">
            <button type="button" :aria-pressed="billing === 'monthly'" class="min-h-[44px] cursor-pointer px-4 text-[15px] font-medium text-ink transition-colors aria-pressed:bg-ink aria-pressed:text-sheet" @click="billing = 'monthly'">{{ words.monthly }}</button>
            <button type="button" :aria-pressed="billing === 'yearly'" class="min-h-[44px] cursor-pointer px-4 text-[15px] font-medium text-ink transition-colors aria-pressed:bg-ink aria-pressed:text-sheet" @click="billing = 'yearly'">{{ words.yearly }}</button>
          </div>
          <p v-if="block.yearlyNote" class="mt-3 text-[14px] text-quiet">{{ tidyText(block.yearlyNote) }}</p>
          <div v-if="block.afterText" class="mt-8 hidden lg:block">
            <p v-if="block.afterLabel" class="label text-quiet">{{ block.afterLabel }}</p>
            <p class="mt-3 text-[15px] leading-[1.55]">{{ tidyText(block.afterText) }} {{ tidyText(block.afterNote) }}</p>
          </div>
        </div>

        <article v-for="plan in plans" :key="plan.id" class="p-6 lg:border-y-0 lg:border-r-0 lg:p-8" :class="plan.highlighted ? 'relative border border-ink bg-tint lg:border-l-line' : 'border border-line'">
          <p v-if="plan.highlighted && plan.badge" class="label absolute right-6 top-6 !text-[11px] text-ink lg:right-8 lg:top-9">{{ plan.badge }}</p>
          <h3 class="text-[22px] font-semibold tracking-[-0.02em] text-ink">{{ plan.name }}</h3>
          <p v-if="plan.forWhom" class="mt-1 text-[15px]" :class="plan.highlighted ? 'text-body' : 'text-quiet'">{{ tidyText(plan.forWhom) }}</p>
          <p class="mt-6 flex items-baseline gap-2 text-ink"><span class="text-[48px] font-semibold leading-none tracking-[-0.04em]">{{ planPrice(plan, billing).amount }}</span><span class="text-[15px]">{{ look.priceUnit }}</span></p>
          <p class="mt-2 font-mono text-[12px]" :class="plan.highlighted ? 'text-body' : 'text-quiet'">{{ look.priceNote(billing, planPrice(plan, billing).note.perMonthYearly, planPrice(plan, billing).note.perYear) }}</p>
          <SiteLink v-if="settings?.ctaUrl" class="btn mt-6 w-full" :class="plan.highlighted ? 'btn-main' : 'btn-line'" :to="settings.ctaUrl">{{ plan.buttonLabel || settings.ctaLabel }}</SiteLink>
          <ul class="mt-6 space-y-2 border-t pt-5 text-[15px] text-ink" :class="plan.highlighted ? 'border-ink/20' : 'border-line'">
            <li v-for="(item, i) in plan.items" :key="i" class="flex gap-3"><UIcon name="i-lucide-check" class="mt-1 size-[18px] flex-none text-brand" aria-hidden="true" />{{ tidyText(item.text) }}</li>
          </ul>
        </article>
      </div>

      <div class="mt-10 lg:mt-0">
        <table v-if="limits.length" class="w-full table-fixed border-t border-ink text-[14px] sm:text-[15px]">
          <caption class="sr-only">{{ words.limitsCaption }}</caption>
          <colgroup><col class="w-[31%] lg:w-[25.9%]"><col v-for="p in plans" :key="p.id"></colgroup>
          <thead><tr class="label !text-[11px] text-quiet"><th scope="col" class="py-3 pr-2 text-left font-normal">{{ words.limits }}</th><th v-for="p in plans" :key="p.id" scope="col" class="px-1 py-3 text-left font-normal lg:px-8">{{ p.name }}</th></tr></thead>
          <tbody class="text-ink">
            <tr v-for="(l, r) in limits" :key="l.id" class="border-t border-line" :class="r === limits.length - 1 ? 'border-b' : ''">
              <th scope="row" class="py-3 pr-2 text-left font-normal text-body">{{ tidyText(l.name) }}</th>
              <td v-for="(p, i) in plans" :key="p.id" class="px-1 py-3 font-mono text-[13px] lg:px-8">{{ tidyText(l.values[i]?.value) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="block.moreText" class="mt-5 text-[15px] text-quiet"><KitMarked :text="block.moreText" as="a" :attrs="{ class: 'link text-ink', href: contactHref }" /></p>
        <div v-if="block.afterText" class="mt-8 border-t border-line pt-6 lg:hidden">
          <p v-if="block.afterLabel" class="label text-quiet">{{ block.afterLabel }}</p>
          <p class="mt-3 text-[15px] leading-[1.55]">{{ tidyText(block.afterText) }} {{ tidyText(block.afterNote) }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
