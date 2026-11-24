<script setup lang="ts">
// Ode dveří's enquiry: what happens next in numbered discs beside a soft rounded form. The
// room is a choice of pills, the guesthouse's own rooms and "advise me".
import type { SiteForm } from '#imports'
import type { Room } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm; rooms: Room[] }>()
const { settings, words, tel } = await useStay()
const form = props.form
const { choices } = useEnquiryFields(form, () => props.rooms, () => props.block)
// Where each question stands (a grid of two columns on a phone, four from `md`).
const SPAN: Record<string, string> = {
  arrival: '', departure: '', adults: '', children: '',
  room: 'col-span-2 md:col-span-4', name: 'col-span-2', phone: 'col-span-2 md:col-span-1', email: 'col-span-2 md:col-span-1', message: 'col-span-2 md:col-span-4',
}
const PILL = 'flex items-center gap-2.5 min-h-[48px] px-4 rounded-full bg-paper text-ink font-medium cursor-pointer shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--brand)] peer-checked:bg-brand peer-checked:text-brand-ink peer-checked:shadow-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand transition-colors'
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-28 pb-20 md:pb-28">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-4">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-quiet max-w-[40ch]">{{ tidyText(block.text) }}</p>
        <ol v-if="block.steps.length" class="mt-7 space-y-4">
          <li v-for="(s, i) in block.steps" :key="s.id" class="flex items-center gap-4"><span class="flex-none grid place-items-center w-9 h-9 rounded-full bg-brand-soft text-brand font-semibold">{{ i + 1 }}</span><span>{{ tidyText(s.text) }}</span></li>
        </ol>
        <p v-if="settings?.phone" class="mt-7">{{ block.callLabel }} <a :href="tel" class="tlink num">{{ settings.phone }}</a></p>
      </div>

      <div v-if="form.sent.value" class="soft lg:col-span-8 rounded-[28px] bg-soft p-5 md:p-9" role="status">
        <p class="text-[1.6rem] font-semibold tracking-[-0.025em] text-ink leading-tight">{{ form.successMessage.value }}</p>
      </div>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="soft lg:col-span-8 rounded-[28px] bg-soft p-5 md:p-9 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5" novalidate @submit.prevent="form.submit">
        <template v-for="f in form.fields.value" :key="f.key">
          <fieldset v-if="f.key === 'room'" class="col-span-2 md:col-span-4">
            <legend class="flabel">{{ f.label }}</legend>
            <div class="flex flex-wrap gap-2">
              <label v-for="c in choices" :key="c.value" class="relative"><input v-model="form.values[f.key]" class="peer sr-only" type="radio" :name="f.key" :value="c.value"><span :class="PILL">{{ c.name }}</span></label>
              <label class="relative"><input v-model="form.values[f.key]" class="peer sr-only" type="radio" :name="f.key" value=""><span :class="PILL">{{ block.adviceLabel }}</span></label>
            </div>
          </fieldset>
          <div v-else :class="SPAN[f.key]">
            <label class="flabel" :for="form.id(f.key)">{{ f.label }}</label>
            <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" class="field" :name="f.key" rows="3" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
            <select v-else-if="f.type === 'select'" :id="form.id(f.key)" v-model="form.values[f.key]" class="field" :name="f.key" :aria-invalid="!!form.errors[f.key]">
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <input
              v-else :id="form.id(f.key)" v-model="form.values[f.key]" class="field" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined"
              :type="f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'" :autocomplete="f.key === 'name' ? 'name' : f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : undefined"
              :placeholder="f.key === 'arrival' ? words.dateExample[0] : f.key === 'departure' ? words.dateExample[1] : undefined" :aria-invalid="!!form.errors[f.key]"
            >
            <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
          </div>
        </template>
        <KitFormExtras :form="form" />
        <p v-if="form.failure.value" class="col-span-2 md:col-span-4 field-error" role="alert">{{ form.failure.value }}</p>
        <div class="col-span-2 md:col-span-4 flex flex-wrap items-center justify-between gap-4">
          <p class="text-sm text-quiet max-w-[38ch]">{{ words.consentBefore }} <NuxtLink v-if="block.consentUrl" :to="siteHref(block.consentUrl)" class="underline underline-offset-4 hover:text-ink">{{ words.consentLink }}</NuxtLink><template v-else>{{ words.consentLink }}</template>.</p>
          <button class="btn w-full sm:w-auto" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        </div>
      </form>
    </div>
  </section>
</template>
