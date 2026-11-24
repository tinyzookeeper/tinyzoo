<script setup lang="ts">
// Zrcadlo's booking: a panel in the brand colour with the phone number beside a white form with
// soft fields. The service, the person and the day are choices (useBooking); a click on a price
// or on a person elsewhere on the page has already chosen one.
import type { Person } from '~/lib/cms-content'
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
  <section :id="anchor" class="wrap scroll-mt-4">
    <div class="rounded-[36px] md:rounded-[56px] bg-brand text-brand-ink px-5 py-12 md:p-16 grid lg:grid-cols-12 gap-x-14 gap-y-12">
      <div class="lg:col-span-4">
        <p v-if="block.eyebrow" class="text-[12px] font-semibold tracking-[.14em] uppercase opacity-80">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[38px] md:text-[48px] leading-[1.08] !text-brand-ink">{{ tidyText(block.heading) }}</component>
        <p v-if="block.text" class="mt-5 opacity-90">{{ tidyText(block.text) }}</p>
        <div v-if="phone" class="mt-10">
          <p v-if="block.phoneLabel" class="text-[12px] font-semibold tracking-[.14em] uppercase opacity-80">{{ block.phoneLabel }}</p>
          <a :href="phone.href" class="mt-1 inline-block py-1 font-display text-[40px] md:text-[46px] leading-none hover:underline underline-offset-8 decoration-1">{{ phone.text }}</a>
          <p v-if="block.phoneNote" class="mt-3 text-[15px] opacity-90">{{ tidyText(block.phoneNote) }}</p>
        </div>
      </div>
      <form v-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-8 bg-surface text-body rounded-[28px] p-5 md:p-9 grid sm:grid-cols-2 gap-x-5 gap-y-5" novalidate @submit.prevent="form.submit">
        <label class="block sm:col-span-2"><span class="block mb-2 text-sm font-semibold text-ink">{{ label('service') }}</span>
          <select v-model="form.values.service" name="service" class="field">
            <option :value="booking.undecided">{{ booking.undecided }}</option>
            <optgroup v-for="g in groups" :key="g.group.id" :label="g.group.name">
              <option v-for="s in g.items" :key="s.id" :value="s.name">{{ booking.optionLabel(s, true) }}</option>
            </optgroup>
          </select></label>
        <label class="block"><span class="block mb-2 text-sm font-semibold text-ink">{{ label('person') }}</span>
          <select v-model="form.values.person" name="person" class="field">
            <option v-for="p in booking.people.value" :key="p" :value="p">{{ p }}</option>
          </select></label>
        <label class="block"><span class="block mb-2 text-sm font-semibold text-ink">{{ label('day') }}</span>
          <select v-model="form.values.day" name="day" class="field">
            <option v-for="d in booking.days.value" :key="d" :value="d">{{ d }}</option>
          </select></label>
        <fieldset class="sm:col-span-2"><legend class="mb-2 text-sm font-semibold text-ink">{{ label('part') }}</legend>
          <div class="grid grid-cols-3 gap-2">
            <label v-for="o in parts" :key="o.value" class="cursor-pointer"><input v-model="form.values.part" type="radio" name="part" :value="o.value" class="peer sr-only"><span class="flex items-center justify-center text-center min-h-[52px] px-2 rounded-2xl bg-paper text-ink text-[14px] sm:text-[15px] font-semibold peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2 transition-colors">{{ o.label }}</span></label>
          </div>
        </fieldset>
        <div class="block"><label class="block mb-2 text-sm font-semibold text-ink" :for="form.id('name')">{{ label('name') }}</label>
          <input :id="form.id('name')" v-model="form.values.name" type="text" name="name" autocomplete="name" class="field" :placeholder="help('name')" required :aria-invalid="!!form.errors.name">
          <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p></div>
        <div class="block"><label class="block mb-2 text-sm font-semibold text-ink" :for="form.id('phone')">{{ label('phone') }}</label>
          <input :id="form.id('phone')" v-model="form.values.phone" type="tel" name="phone" autocomplete="tel" class="field" :placeholder="help('phone')" required :aria-invalid="!!form.errors.phone">
          <p v-if="form.errors.phone" class="field-error">{{ form.errors.phone }}</p></div>
        <KitFormExtras :form="form" />
        <div class="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
          <button type="submit" class="btn btn-brand w-full sm:w-auto" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.submitLabel || form.submitLabel.value }}</button>
          <p v-if="form.sent.value" class="text-sm font-semibold text-brand" role="status">{{ form.successMessage.value }}</p>
          <p v-else-if="form.failure.value" class="field-error" role="alert">{{ form.failure.value }}</p>
          <p v-else-if="block.note" class="text-sm text-quiet">{{ tidyText(block.note) }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
