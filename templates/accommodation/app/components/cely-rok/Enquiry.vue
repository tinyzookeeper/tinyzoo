<script setup lang="ts">
// Celý rok's enquiry: what happens next beside a form on the raised surface. The room is a
// choice of the guesthouse's own rooms; the dates are written out, as on paper.
import type { SiteForm } from '#imports'
import type { Room } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm; rooms: Room[] }>()
const { settings, words, tel } = await useStay()
const form = props.form
const { choices } = useEnquiryFields(form, () => props.rooms, () => props.block)
// Where each question stands (a grid of two columns on a phone, four from `md`).
const SPAN: Record<string, string> = {
  arrival: 'md:col-span-1', departure: 'md:col-span-1', adults: 'md:col-span-1', children: 'md:col-span-1',
  room: 'col-span-2 md:col-span-4', name: 'col-span-2', phone: 'col-span-2 md:col-span-1', email: 'col-span-2 md:col-span-1', message: 'col-span-2 md:col-span-4',
}
</script>

<template>
  <section :id="anchor" class="wrap pt-20 md:pt-24 pb-24 md:pb-32">
    <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-4">
        <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-6 text-quiet max-w-[40ch]">{{ tidyText(block.text) }}</p>
        <ol v-if="block.steps.length" class="mt-8">
          <li v-for="(s, i) in block.steps" :key="s.id" class="rule py-4 flex gap-4"><span class="font-display text-2xl text-brand w-6">{{ i + 1 }}</span><span>{{ tidyText(s.text) }}</span></li>
        </ol>
        <p v-if="settings?.phone" class="mt-8 text-quiet">{{ block.callLabel }} <a :href="tel" class="tlink num">{{ settings.phone }}</a></p>
      </div>

      <div v-if="form.sent.value" class="lg:col-span-7 lg:col-start-6 bg-surface border border-line p-5 md:p-9" role="status">
        <p class="font-display text-[1.7rem] leading-tight">{{ form.successMessage.value }}</p>
      </div>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 lg:col-start-6 bg-surface border border-line p-5 md:p-9 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5" novalidate @submit.prevent="form.submit">
        <label v-for="f in form.fields.value" :key="f.key" class="block" :class="SPAN[f.key]" :for="form.id(f.key)">
          <span class="label">{{ f.label }}</span>
          <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" class="field mt-1.5" :name="f.key" rows="3" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
          <select v-else-if="f.key === 'room'" :id="form.id(f.key)" v-model="form.values[f.key]" class="field mt-1.5" :name="f.key">
            <option value="">{{ block.adviceLabel }}</option>
            <option v-for="c in choices" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
          <select v-else-if="f.type === 'select'" :id="form.id(f.key)" v-model="form.values[f.key]" class="field mt-1.5" :name="f.key" :aria-invalid="!!form.errors[f.key]">
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <input
            v-else :id="form.id(f.key)" v-model="form.values[f.key]" class="field mt-1.5" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined"
            :type="f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'" :autocomplete="f.key === 'name' ? 'name' : f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : undefined"
            :placeholder="f.key === 'arrival' ? words.dateExample[0] : f.key === 'departure' ? words.dateExample[1] : undefined" :aria-invalid="!!form.errors[f.key]"
          >
          <span v-if="form.errors[f.key]" class="field-error block">{{ form.errors[f.key] }}</span>
        </label>
        <KitFormExtras :form="form" />
        <p v-if="form.failure.value" class="col-span-2 md:col-span-4 field-error" role="alert">{{ form.failure.value }}</p>
        <div class="col-span-2 md:col-span-4 flex flex-wrap items-center justify-between gap-4 pt-1">
          <p class="text-sm text-quiet max-w-[38ch]">{{ words.consentBefore }} <NuxtLink v-if="block.consentUrl" :to="siteHref(block.consentUrl)" class="underline underline-offset-4 hover:text-text">{{ words.consentLink }}</NuxtLink><template v-else>{{ words.consentLink }}</template>.</p>
          <button class="btn w-full sm:w-auto" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></button>
        </div>
      </form>
    </div>
  </section>
</template>
