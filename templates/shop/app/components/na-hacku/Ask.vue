<script setup lang="ts">
// Na háčku's enquiry: on the board, the form as a card on two pegs beside three contact pills
// and the voucher as a brass tag hanging on a string. The product buttons fill in the message.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'ask'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words } = await useShop()
const form = props.form
const field = (key: string) => form.fields.value.find((f) => f.key === key)
useEnquiryFill(form)
</script>

<template>
  <section :id="anchor" class="board scroll-mt-0 py-16 md:py-24">
    <div class="wrap grid items-start gap-14 lg:grid-cols-12 lg:gap-12">
      <div class="plate px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:col-span-7">
        <span class="peg peg-l" /><span class="peg peg-r" />
        <component :is="first ? 'h1' : 'h2'" class="text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-4 max-w-xl">{{ tidyText(block.text) }}</p>
        <p v-if="form.sent.value" class="mt-7 text-[1.2rem] font-bold" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate @submit.prevent="form.submit">
          <div class="mt-7 grid gap-4 sm:grid-cols-2">
            <label class="block"><span class="text-[0.92rem] font-bold">{{ field('name')?.label }}</span><input v-model="form.values.name" class="field mt-1.5" type="text" name="name" autocomplete="name" :placeholder="field('name')?.help ?? undefined" required :aria-invalid="!!form.errors.name"><span v-if="form.errors.name" class="field-error block">{{ form.errors.name }}</span></label>
            <label class="block"><span class="text-[0.92rem] font-bold">{{ field('contact')?.label }}</span><input v-model="form.values.contact" class="field mt-1.5" type="text" name="contact" :placeholder="field('contact')?.help ?? undefined" required :aria-invalid="!!form.errors.contact"><span v-if="form.errors.contact" class="field-error block">{{ form.errors.contact }}</span></label>
            <label class="block sm:col-span-2"><span class="text-[0.92rem] font-bold">{{ field('message')?.label }}</span><textarea v-model="form.values.message" class="field mt-1.5" name="message" rows="4" :placeholder="field('message')?.help ?? undefined" required :aria-invalid="!!form.errors.message" /><span v-if="form.errors.message" class="field-error block">{{ form.errors.message }}</span></label>
          </div>
          <label class="mt-4 flex min-h-11 cursor-pointer items-center gap-3 font-semibold"><input v-model="form.values.hold" type="checkbox" name="hold" class="size-5 accent-[var(--brand)]"> {{ field('hold')?.label }}</label>
          <KitFormExtras :form="form" />
          <p v-if="form.failure.value" class="field-error mt-3" role="alert">{{ form.failure.value }}</p>
          <button type="submit" class="btn mt-4 w-full sm:w-auto" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        </form>
      </div>

      <div class="grid gap-12 lg:col-span-5 lg:pt-6">
        <div class="grid grid-cols-1 gap-9 md:grid-cols-2 lg:grid-cols-1 lg:gap-8">
          <a v-if="settings?.phone" :href="phoneHref(settings.phone)" class="tag plate swing flex items-center gap-4 !rounded-full py-3 pl-3 pr-6" style="--r: -1deg">
            <span class="peg !left-[2.1rem]" />
            <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-[1.3rem] text-card"><UIcon name="i-lucide-phone" aria-hidden="true" /></span>
            <span><span class="block text-[0.82rem] font-bold text-[var(--soft)]">{{ words.nahacku.contactPhone }}</span><span class="disp block text-[1.5rem] font-extrabold leading-tight">{{ settings.phone }}</span></span>
          </a>
          <a v-if="settings?.mobile" :href="smsHref(settings.mobile)" class="tag plate swing flex items-center gap-4 !rounded-full py-3 pl-3 pr-6" style="--r: 1.2deg">
            <span class="peg !left-[2.1rem]" />
            <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-[1.3rem] text-card"><UIcon name="i-lucide-message-circle" aria-hidden="true" /></span>
            <span><span class="block text-[0.82rem] font-bold text-[var(--soft)]">{{ words.nahacku.contactSms }}</span><span class="disp block text-[1.5rem] font-extrabold leading-tight">{{ settings.mobile }}</span></span>
          </a>
          <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="tag plate swing flex items-center gap-4 !rounded-full py-3 pl-3 pr-6" style="--r: -0.6deg">
            <span class="peg !left-[2.1rem]" />
            <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-[1.3rem] text-card"><UIcon name="i-lucide-mail" aria-hidden="true" /></span>
            <span class="min-w-0"><span class="block text-[0.82rem] font-bold text-[var(--soft)]">{{ words.nahacku.contactEmail }}</span><span class="disp block text-[1.25rem] font-extrabold leading-tight">{{ settings.email }}</span></span>
          </a>
        </div>
        <!-- the voucher: a big tag -->
        <div v-if="block.voucherLabel" class="swing relative pt-10" style="--r: 2deg">
          <span class="peg !top-[-7px]" />
          <svg class="absolute left-0 top-0 h-10 w-full text-ink/45" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M30 40 50 3 70 40" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>
          <div class="rounded-[26px] bg-pop px-6 pb-7 pt-6 text-ink shadow-[0_20px_28px_-18px_rgba(40,36,24,.5)] md:px-8">
            <p class="flex items-center justify-between gap-4"><span class="pill bg-ink text-card">{{ block.voucherLabel }}</span><span class="size-4 rounded-full bg-[var(--board)] shadow-[inset_0_2px_3px_rgba(0,0,0,.35)]" /></p>
            <p class="disp mt-4 text-[2.3rem] font-black leading-none tracking-[-0.02em] md:text-[2.7rem]">{{ tidyText(block.voucherValues) }}</p>
            <p class="mt-3 font-semibold">{{ tidyText(block.voucherText) }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
