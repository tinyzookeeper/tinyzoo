<script setup lang="ts">
// Portál's enquiry: the light ground, the contacts as a list with rules, the voucher in a double
// frame, and the form as a dark panel. The product buttons fill in the message.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'ask'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words } = await useShop()
const form = props.form
const field = (key: string) => form.fields.value.find((f) => f.key === key)
useEnquiryFill(form)
</script>

<template>
  <section :id="anchor" class="lit scroll-mt-0 bg-glass py-16 text-wood-lo md:py-24">
    <div class="wrap grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="caps text-wood">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-xl">{{ tidyText(block.text) }}</p>
        <dl class="mt-9 border-t border-wood/35">
          <div v-if="settings?.phone" class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-wood/35 py-4">
            <dt class="caps text-wood">{{ words.portal.contactPhone }}</dt>
            <dd class="fig text-[1.6rem]"><a :href="phoneHref(settings.phone)" class="tlink">{{ settings.phone }}</a></dd>
          </div>
          <div v-if="settings?.mobile" class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-wood/35 py-4">
            <dt class="caps text-wood">{{ words.portal.contactSms }}</dt>
            <dd class="fig text-[1.6rem]"><a :href="smsHref(settings.mobile)" class="tlink">{{ settings.mobile }}</a></dd>
          </div>
          <div v-if="settings?.email" class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-wood/35 py-4">
            <dt class="caps text-wood">{{ words.portal.contactEmail }}</dt>
            <dd class="fig text-[1.35rem] sm:text-[1.6rem]"><a :href="`mailto:${settings.email}`" class="tlink">{{ settings.email }}</a></dd>
          </div>
        </dl>
        <div v-if="block.voucherLabel" class="mt-10 flex gap-6 p-6 shadow-[inset_0_0_0_1px_var(--wood),inset_0_0_0_5px_var(--glass),inset_0_0_0_6px_color-mix(in_srgb,var(--wood)_45%,transparent)] md:p-8">
          <div class="min-w-0">
            <p class="caps text-wood">{{ block.voucherLabel }}</p>
            <p class="fig mt-3 text-[1.7rem] leading-tight">{{ tidyText(block.voucherValues) }}</p>
            <p class="mt-3">{{ tidyText(block.voucherText) }}</p>
          </div>
        </div>
      </div>
      <div class="self-start bg-wood px-6 py-8 text-cream md:px-10 md:py-10 lg:col-span-6">
        <p v-if="form.sent.value" class="text-[1.2rem]" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate @submit.prevent="form.submit">
          <h3 v-if="block.formHeading" class="text-[1.7rem]">{{ block.formHeading }}</h3>
          <p v-if="block.formText" class="mt-2 text-[0.97rem] text-cream/80">{{ tidyText(block.formText) }}</p>
          <div class="mt-7 grid gap-5 sm:grid-cols-2">
            <label class="block"><span class="caps text-brass">{{ field('name')?.label }}</span><input v-model="form.values.name" class="field mt-2" type="text" name="name" autocomplete="name" :placeholder="field('name')?.help ?? undefined" required :aria-invalid="!!form.errors.name"><span v-if="form.errors.name" class="field-error block">{{ form.errors.name }}</span></label>
            <label class="block"><span class="caps text-brass">{{ field('contact')?.label }}</span><input v-model="form.values.contact" class="field mt-2" type="text" name="contact" :placeholder="field('contact')?.help ?? undefined" required :aria-invalid="!!form.errors.contact"><span v-if="form.errors.contact" class="field-error block">{{ form.errors.contact }}</span></label>
            <label class="block sm:col-span-2"><span class="caps text-brass">{{ field('message')?.label }}</span><textarea v-model="form.values.message" class="field mt-2" name="message" rows="4" :placeholder="field('message')?.help ?? undefined" required :aria-invalid="!!form.errors.message" /><span v-if="form.errors.message" class="field-error block">{{ form.errors.message }}</span></label>
          </div>
          <label class="mt-5 flex min-h-11 cursor-pointer items-center gap-3 text-[0.97rem]"><input v-model="form.values.hold" type="checkbox" name="hold" class="size-5 accent-[var(--brass)]"> {{ field('hold')?.label }}</label>
          <KitFormExtras :form="form" />
          <p v-if="form.failure.value" class="field-error mt-4" role="alert">{{ form.failure.value }}</p>
          <button type="submit" class="btn mt-6 w-full sm:w-auto" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        </form>
      </div>
    </div>
  </section>
</template>
