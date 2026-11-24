<script setup lang="ts">
// Regál's enquiry: the one section in the rail's colour. The contacts in big condensed figures,
// the voucher as a white ticket with a bright strip, the form with plain white fields.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'ask'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words } = await useShop()
const form = props.form
const field = (key: string) => form.fields.value.find((f) => f.key === key)
useEnquiryFill(form)
</script>

<template>
  <section :id="anchor" class="on-rail mt-8 scroll-mt-0 bg-rail py-14 text-rail-ink md:mt-12 md:py-24">
    <div class="wrap grid gap-12 lg:grid-cols-12 lg:gap-14">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="cond text-[1.2rem]"><template v-for="(part, i) in slashParts(block.eyebrow)" :key="i"><template v-if="i">{{ ' ' }}<span class="mx-1 opacity-60">/</span>{{ ' ' }}</template>{{ part }}</template></p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[clamp(2.5rem,11vw,3.4rem)] font-bold tracking-[-0.04em] md:text-[4.4rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-xl text-[1.1rem] leading-snug">{{ tidyText(block.text) }}</p>
        <dl class="mt-10 grid gap-x-8 gap-y-6 border-t-2 border-rail-ink pt-6 sm:grid-cols-3">
          <div v-if="settings?.phone"><dt class="cond text-[1.1rem] opacity-85">{{ words.regal.contactPhone }}</dt><dd class="num mt-1 text-[2.7rem]"><a :href="phoneHref(settings.phone)" class="ulink">{{ settings.phone }}</a></dd></div>
          <div v-if="settings?.mobile"><dt class="cond text-[1.1rem] opacity-85">{{ words.regal.contactSms }}</dt><dd class="num mt-1 text-[2.7rem]"><a :href="smsHref(settings.mobile)" class="ulink">{{ settings.mobile }}</a></dd></div>
          <div v-if="settings?.email"><dt class="cond text-[1.1rem] opacity-85">{{ words.regal.contactEmail }}</dt><dd class="mt-2 text-[1.15rem] font-bold"><a :href="`mailto:${settings.email}`" class="ulink">{{ settings.email }}</a></dd></div>
        </dl>
        <div v-if="block.voucherLabel" class="mt-10 max-w-xl bg-white text-ink">
          <p class="cond flex items-center justify-between bg-signal px-5 py-2 text-[1.25rem] text-signal-ink"><span>{{ block.voucherLabel }}</span><span class="opacity-80">{{ block.voucherValidity }}</span></p>
          <div class="px-5 pb-5 pt-4">
            <p class="num text-[clamp(2.6rem,11vw,3.4rem)]">{{ tidyText(block.voucherValues) }}</p>
            <p class="mt-2 text-[0.97rem] leading-snug">{{ tidyText(block.voucherText) }}</p>
          </div>
        </div>
      </div>
      <div class="self-end lg:col-span-5">
        <p v-if="form.sent.value" class="text-[1.4rem] font-bold" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate @submit.prevent="form.submit">
          <h3 v-if="block.formHeading" class="text-[1.8rem]">{{ block.formHeading }}</h3>
          <div class="grid gap-4" :class="block.formHeading ? 'mt-6' : ''">
            <label class="block"><span class="cond text-[1.1rem]">{{ field('name')?.label }}</span><input v-model="form.values.name" class="field mt-1.5" type="text" name="name" autocomplete="name" :placeholder="field('name')?.help ?? undefined" required :aria-invalid="!!form.errors.name"><span v-if="form.errors.name" class="field-error block">{{ form.errors.name }}</span></label>
            <label class="block"><span class="cond text-[1.1rem]">{{ field('contact')?.label }}</span><input v-model="form.values.contact" class="field mt-1.5" type="text" name="contact" :placeholder="field('contact')?.help ?? undefined" required :aria-invalid="!!form.errors.contact"><span v-if="form.errors.contact" class="field-error block">{{ form.errors.contact }}</span></label>
            <label class="block"><span class="cond text-[1.1rem]">{{ field('message')?.label }}</span><textarea v-model="form.values.message" class="field mt-1.5" name="message" rows="4" :placeholder="field('message')?.help ?? undefined" required :aria-invalid="!!form.errors.message" /><span v-if="form.errors.message" class="field-error block">{{ form.errors.message }}</span></label>
          </div>
          <label class="mt-4 flex min-h-11 cursor-pointer items-center gap-3 font-semibold"><input v-model="form.values.hold" type="checkbox" name="hold" class="size-5 accent-[var(--ink)]"> {{ field('hold')?.label }}</label>
          <KitFormExtras :form="form" />
          <p v-if="form.failure.value" class="field-error mt-3" role="alert">{{ form.failure.value }}</p>
          <button type="submit" class="btn mt-4 w-full" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="icon" aria-hidden="true" /></button>
          <p v-if="block.formText" class="mt-3 text-[0.9rem] opacity-90">{{ tidyText(block.formText) }}</p>
        </form>
      </div>
    </div>
  </section>
</template>
