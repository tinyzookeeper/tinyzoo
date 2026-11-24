<script setup lang="ts">
// One Day's price list, 12:00: soft cards for the plans (the highlighted one in the afternoon
// colour), a switch between monthly and yearly payment, then the limits and what happens on the
// thirty-first day.
import type { Plan, PlanLimit } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'pricing'>; first?: boolean; anchor?: string; plans: Plan[]; limits: PlanLimit[] }>()
const words = useSiteWords()
const look = computed(() => words.value.look['jeden-den'])
const { settings } = await useSite()
const billing = ref<'monthly' | 'yearly'>('monthly')
const contactHref = `/#${anchorOf('contact')}`
</script>

<template>
  <section :id="anchor" class="bg-noon">
    <div class="wrap lg:grid lg:grid-cols-[150px_1fr]">
      <JedenDenRail class="pt-12 lg:pt-24" :time="block.time" :note="block.timeNote" />
      <div class="pb-16 pt-6 lg:pb-28 lg:pl-14 lg:pt-24">
        <div class="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div>
            <component :is="first ? 'h1' : 'h2'" class="h2 text-[36px] sm:text-[46px] lg:text-[52px]"><KitMarked :text="block.heading" /></component>
            <p v-if="block.text" class="mt-4 max-w-[34rem]">{{ tidyText(block.text) }}</p>
            <p v-if="block.yearlyNote" class="mt-2 max-w-[34rem] text-[15px] opacity-80">{{ tidyText(block.yearlyNote) }}</p>
          </div>
          <div class="inline-flex rounded-[14px] bg-morning p-1 shadow-[inset_0_0_0_1px_rgb(43_29_18/.12)]" role="group" :aria-label="words.paymentGroup">
            <button type="button" :aria-pressed="billing === 'monthly'" class="min-h-[44px] cursor-pointer rounded-[10px] px-5 text-[16px] font-semibold transition-colors aria-pressed:bg-ink aria-pressed:text-cream" @click="billing = 'monthly'">{{ words.monthly }}</button>
            <button type="button" :aria-pressed="billing === 'yearly'" class="min-h-[44px] cursor-pointer rounded-[10px] px-5 text-[16px] font-semibold transition-colors aria-pressed:bg-ink aria-pressed:text-cream" @click="billing = 'yearly'">{{ words.yearly }}</button>
          </div>
        </div>

        <div class="mt-10 grid gap-5 lg:grid-cols-3">
          <article v-for="plan in plans" :key="plan.id" class="card relative flex flex-col p-6 lg:p-7" :class="plan.highlighted ? '!bg-afternoon' : ''">
            <p v-if="plan.highlighted && plan.badge" class="time absolute right-6 top-6 rounded-full bg-ink px-3 py-1 !text-[11px] text-cream lg:right-7 lg:top-7">{{ plan.badge }}</p>
            <h3 class="font-display text-[28px] font-semibold leading-none">{{ plan.name }}</h3>
            <p v-if="plan.forWhom" class="mt-2 text-[16px]" :class="plan.highlighted ? 'opacity-85' : 'opacity-80'">{{ tidyText(plan.forWhom) }}</p>
            <p class="mt-6 flex items-baseline gap-2"><span class="font-display text-[60px] font-bold leading-none tracking-[-0.02em]">{{ planPrice(plan, billing).amount }}</span><span class="text-[17px] font-medium">{{ look.priceUnit }}</span></p>
            <p class="mt-1.5 text-[14px]" :class="plan.highlighted ? 'opacity-85' : 'opacity-75'">{{ look.priceNote(billing, planPrice(plan, billing).note.perMonthYearly, planPrice(plan, billing).note.perYear) }}</p>
            <ul class="mt-6 flex-1 space-y-2 border-t pt-5 text-[16px]" :class="plan.highlighted ? 'border-ink/25' : 'border-ink/15'">
              <li v-for="(item, i) in plan.items" :key="i" class="flex gap-2.5"><UIcon name="i-lucide-check" class="mt-1 size-[19px] flex-none" :class="plan.highlighted ? '' : 'text-brand'" aria-hidden="true" />{{ tidyText(item.text) }}</li>
            </ul>
            <SiteLink v-if="settings?.ctaUrl" class="btn mt-7" :class="plan.highlighted ? 'btn-brand' : 'btn-line'" :to="settings.ctaUrl">{{ plan.buttonLabel || settings.ctaLabel }}</SiteLink>
          </article>
        </div>

        <div class="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-10">
          <div v-if="limits.length" class="lg:col-span-8">
            <table class="w-full table-fixed text-[14px] sm:text-[16px]">
              <caption class="sr-only">{{ words.limitsCaption }}</caption>
              <colgroup><col class="w-[31%]"><col v-for="p in plans" :key="p.id"></colgroup>
              <thead><tr class="font-display text-[17px] font-semibold sm:text-[19px]"><th scope="col" class="pb-2 pr-2 text-left"><span class="time font-normal opacity-70">{{ words.limits }}</span></th><th v-for="(p, i) in plans" :key="p.id" scope="col" class="pb-2 text-left" :class="i < plans.length - 1 ? 'pr-2' : ''">{{ p.name }}</th></tr></thead>
              <tbody>
                <tr v-for="(l, r) in limits" :key="l.id" :class="[r === 0 ? 'border-t border-ink/40' : 'border-t border-ink/15', r === limits.length - 1 ? 'border-b' : '']">
                  <th scope="row" class="py-3 pr-2 text-left font-normal opacity-85">{{ tidyText(l.name) }}</th>
                  <td v-for="(p, i) in plans" :key="p.id" class="py-3 font-medium" :class="i < plans.length - 1 ? 'pr-2' : ''">{{ tidyText(l.values[i]?.value) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="block.afterText" :class="limits.length ? 'lg:col-span-4' : 'lg:col-span-8'">
            <h3 v-if="block.afterLabel" class="font-display text-[24px] font-semibold leading-tight">{{ block.afterLabel }}</h3>
            <p class="mt-3 text-[16px]">{{ tidyText(block.afterText) }}<template v-if="block.afterNote"> {{ tidyText(block.afterNote) }}</template></p>
            <p v-if="block.moreText" class="mt-3 text-[16px]"><KitMarked :text="block.moreText" as="a" :attrs="{ class: 'ul font-medium', href: contactHref }" /></p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
