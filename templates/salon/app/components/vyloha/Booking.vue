<script setup lang="ts">
// Výloha's booking: a cream enamel plate on the dark page, the heading and phone number in glass
// green on it, and a form whose fields are only underlined.
import type { Person } from '../../lib/cms-content'
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'booking'>; first?: boolean; anchor?: string; form: SiteForm; groups: ServiceGroupWithItems[]; people: Person[] }>()
const { words, days, phone } = await useSalon()
const form = props.form
const booking = useBooking(form, () => props.groups, () => props.people, days)
const label = (key: string) => form.fields.value.find((f) => f.key === key)?.label ?? ''
const help = (key: string) => form.fields.value.find((f) => f.key === key)?.help ?? undefined
const parts = computed(() => form.fields.value.find((f) => f.key === 'part')?.options ?? [])
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28 scroll-mt-4">
    <div class="on-cream plate text-glass px-5 py-12 md:px-14 md:py-16 grid lg:grid-cols-12 gap-x-14 gap-y-10" style="--pr:26px">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="caps">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[44px] md:text-[64px] leading-[1.02] !text-glass">{{ tidyText(block.heading) }}</component>
        <p v-if="block.text" class="mt-5 max-w-[26rem]">{{ tidyText(block.text) }}</p>
        <div v-if="phone" class="mt-10 pt-8 border-t border-glass/30">
          <p v-if="block.phoneLabel" class="caps">{{ block.phoneLabel }}</p>
          <a :href="phone.href" class="mt-2 inline-block font-display text-[44px] md:text-[52px] leading-none tracking-[.02em] underline decoration-transparent underline-offset-8 decoration-1 hover:decoration-current">{{ phone.text }}</a>
          <p v-if="block.phoneNote" class="mt-3 max-w-[24rem] text-[16px]">{{ tidyText(block.phoneNote) }}</p>
        </div>
      </div>
      <form v-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 grid sm:grid-cols-2 gap-x-8 gap-y-6 content-start" novalidate @submit.prevent="form.submit">
        <label class="block sm:col-span-2"><span class="caps !text-[11px] block">{{ label('service') }}</span>
          <select v-model="form.values.service" name="service" class="field">
            <option :value="booking.undecided">{{ booking.undecided }}</option>
            <optgroup v-for="g in groups" :key="g.group.id" :label="g.group.name">
              <option v-for="s in g.items" :key="s.id" :value="s.name">{{ booking.optionLabel(s) }}</option>
            </optgroup>
          </select></label>
        <label class="block"><span class="caps !text-[11px] block">{{ label('person') }}</span>
          <select v-model="form.values.person" name="person" class="field">
            <option v-for="p in booking.people.value" :key="p" :value="p">{{ p }}</option>
          </select></label>
        <label class="block"><span class="caps !text-[11px] block">{{ label('day') }}</span>
          <select v-model="form.values.day" name="day" class="field">
            <option v-for="d in booking.days.value" :key="d" :value="d">{{ d }}</option>
          </select></label>
        <fieldset class="sm:col-span-2"><legend class="caps !text-[11px] mb-3">{{ label('part') }}</legend>
          <div class="grid grid-cols-3 gap-2 sm:gap-3">
            <label v-for="o in parts" :key="o.value" class="cursor-pointer"><input v-model="form.values.part" type="radio" name="part" :value="o.value" class="peer sr-only"><span class="flex items-center justify-center text-center min-h-[52px] px-1 border border-glass/50 text-[15px] sm:text-[17px] font-medium peer-checked:bg-glass peer-checked:text-cream peer-checked:border-glass peer-focus-visible:outline-2 peer-focus-visible:outline-glass peer-focus-visible:outline-offset-2 transition-colors">{{ o.label }}</span></label>
          </div>
        </fieldset>
        <div class="block"><label class="caps !text-[11px] block" :for="form.id('name')">{{ label('name') }}</label>
          <input :id="form.id('name')" v-model="form.values.name" type="text" name="name" autocomplete="name" class="field" :placeholder="help('name')" required :aria-invalid="!!form.errors.name">
          <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p></div>
        <div class="block"><label class="caps !text-[11px] block" :for="form.id('phone')">{{ label('phone') }}</label>
          <input :id="form.id('phone')" v-model="form.values.phone" type="tel" name="phone" autocomplete="tel" class="field" :placeholder="help('phone')" required :aria-invalid="!!form.errors.phone">
          <p v-if="form.errors.phone" class="field-error">{{ form.errors.phone }}</p></div>
        <KitFormExtras :form="form" />
        <div class="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-3 pt-3">
          <button type="submit" class="plate btn btn-glass w-full sm:w-auto cursor-pointer" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.submitLabel || form.submitLabel.value }}</button>
          <p v-if="form.sent.value" class="text-[15px] font-semibold" role="status">{{ form.successMessage.value }}</p>
          <p v-else-if="form.failure.value" class="field-error" role="alert">{{ form.failure.value }}</p>
          <p v-else-if="block.note" class="text-[15px]">{{ tidyText(block.note) }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
