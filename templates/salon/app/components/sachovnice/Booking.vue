<script setup lang="ts">
// Šachovnice's booking: the brand colour edge to edge, the phone number under a heavy line, and a
// paper form in a black frame with square fields and three square buttons for the time of day.
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
  <section :id="anchor" class="bg-brand text-brand-ink scroll-mt-0">
    <div class="wrap py-16 md:py-24 grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" :class="wideHeading(block.heading)">{{ tidyText(block.heading) }}</component>
        <p v-if="block.text" class="mt-6 max-w-[26rem] text-[18px] font-semibold">{{ tidyText(block.text) }}</p>
        <div v-if="phone" class="mt-10 border-t-2 border-ink pt-6">
          <p v-if="block.phoneLabel" class="tag">{{ block.phoneLabel }}</p>
          <a :href="phone.href" class="mt-2 inline-block pt-2 pb-1 font-display font-extrabold text-[34px] sm:text-[44px] leading-none tracking-[-0.02em] border-b-4 border-transparent hover:border-ink">{{ phone.text }}</a>
          <p v-if="block.phoneNote" class="mt-4 max-w-[24rem] font-semibold">{{ tidyText(block.phoneNote) }}</p>
        </div>
      </div>
      <form v-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 bg-paper text-ink border-2 border-ink p-5 md:p-9 grid sm:grid-cols-2 gap-5" novalidate @submit.prevent="form.submit">
        <label class="block sm:col-span-2"><span class="tag block mb-2">{{ label('service') }}</span>
          <select v-model="form.values.service" name="service" class="field">
            <option :value="booking.undecided">{{ booking.undecided }}</option>
            <optgroup v-for="g in groups" :key="g.group.id" :label="g.group.name">
              <option v-for="s in g.items" :key="s.id" :value="s.name">{{ booking.optionLabel(s) }}</option>
            </optgroup>
          </select></label>
        <label class="block"><span class="tag block mb-2">{{ label('person') }}</span>
          <select v-model="form.values.person" name="person" class="field">
            <option v-for="p in booking.people.value" :key="p" :value="p">{{ p }}</option>
          </select></label>
        <label class="block"><span class="tag block mb-2">{{ label('day') }}</span>
          <select v-model="form.values.day" name="day" class="field">
            <option v-for="d in booking.days.value" :key="d" :value="d">{{ d }}</option>
          </select></label>
        <fieldset class="sm:col-span-2"><legend class="tag mb-2">{{ label('part') }}</legend>
          <div class="grid grid-cols-3">
            <label v-for="(o, i) in parts" :key="o.value" class="cursor-pointer" :class="i ? '-ml-0.5' : ''"><input v-model="form.values.part" type="radio" name="part" :value="o.value" class="peer sr-only"><span class="flex items-center justify-center text-center min-h-[54px] px-1 border-2 border-ink bg-white font-bold text-[15px] sm:text-[17px] peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-3 peer-focus-visible:outline-brand transition-colors">{{ o.label }}</span></label>
          </div>
        </fieldset>
        <div class="block"><label class="tag block mb-2" :for="form.id('name')">{{ label('name') }}</label>
          <input :id="form.id('name')" v-model="form.values.name" type="text" name="name" autocomplete="name" class="field" :placeholder="help('name')" required :aria-invalid="!!form.errors.name">
          <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p></div>
        <div class="block"><label class="tag block mb-2" :for="form.id('phone')">{{ label('phone') }}</label>
          <input :id="form.id('phone')" v-model="form.values.phone" type="tel" name="phone" autocomplete="tel" class="field" :placeholder="help('phone')" required :aria-invalid="!!form.errors.phone">
          <p v-if="form.errors.phone" class="field-error">{{ form.errors.phone }}</p></div>
        <KitFormExtras :form="form" />
        <div class="sm:col-span-2">
          <button type="submit" class="btn btn-ink w-full" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.submitLabel || form.submitLabel.value }}</button>
          <p v-if="form.sent.value" class="mt-3 text-[15px] font-extrabold text-ink" role="status">{{ form.successMessage.value }}</p>
          <p v-else-if="form.failure.value" class="mt-3 field-error" role="alert">{{ form.failure.value }}</p>
          <p v-else-if="block.note" class="mt-3 text-[15px] font-semibold text-soft">{{ tidyText(block.note) }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
