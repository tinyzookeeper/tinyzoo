<script setup lang="ts">
// Šuplíky's booking: a drawer in the brand colour with the phone number, and a cream card with
// the request form; the number plate field is drawn as a plate.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'booking'>; first?: boolean; anchor?: string; form: SiteForm }>()
const garage = await useGarage()
const { phone, phoneUrl, phone2, phone2Url, serviceInSentence, tyresInSentence, words } = garage
const form = props.form
const book = useBookingForm(form, () => props.block, garage)
</script>

<template>
  <section :id="anchor" class="wrap pb-16 lg:pb-24 scroll-mt-4">
    <div class="rounded-[34px] bg-brand text-white overflow-hidden shadow-[0_8px_0_var(--brand-deep)]">
      <span class="pull !h-[18px]" />
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-9 p-5 sm:p-10">
        <div class="lg:col-span-5">
          <p v-if="block.eyebrow" class="kicker text-white">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[42px] sm:text-[56px]">{{ plainEmphasis(block.heading) }}</component>
          <p class="mt-5 text-[17px] text-white/95 max-w-[28em]">{{ tidyText([block.text, words.freeSentence(serviceInSentence, tyresInSentence)].filter(Boolean).join(' ')) }}</p>
          <div class="mt-8">
            <p v-if="block.callLabel" class="kicker text-white">{{ block.callLabel }}</p>
            <a v-if="phone" :href="phoneUrl" class="num italic mt-1 inline-block text-[52px] sm:text-[68px] leading-none hover:underline underline-offset-8 decoration-[4px]">{{ phone }}</a>
            <p v-if="block.callNote" class="mt-3 text-[16px] text-white/95">{{ book.callParts.value[0] }}<template v-if="book.callParts.value[1] !== null"><a :href="phone2Url" class="font-semibold underline underline-offset-4 whitespace-nowrap">{{ phone2 }}</a>{{ book.callParts.value[1] }}</template></p>
          </div>
        </div>
        <form v-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 bg-card text-ink rounded-[24px] p-5 sm:p-8 grid sm:grid-cols-2 gap-x-5 gap-y-4" novalidate @submit.prevent="form.submit">
          <label class="block"><span class="font-medium text-[16px]">{{ book.label('name') }}</span><input v-model="form.values.name" class="field mt-1.5" type="text" name="name" autocomplete="name" required :aria-invalid="!!form.errors.name"><span v-if="form.errors.name" class="field-error block">{{ form.errors.name }}</span></label>
          <label class="block"><span class="font-medium text-[16px]">{{ book.label('phone') }}</span><input v-model="form.values.phone" class="field mt-1.5" type="tel" name="phone" autocomplete="tel" :placeholder="book.help('phone')" required :aria-invalid="!!form.errors.phone"><span v-if="form.errors.phone" class="field-error block">{{ form.errors.phone }}</span></label>
          <label class="block"><span class="font-medium text-[16px]">{{ book.carLabel.value }}</span><input v-model="form.values.car" class="field mt-1.5" type="text" name="car" :placeholder="book.help('car')" required :aria-invalid="!!form.errors.car"><span v-if="form.errors.car" class="field-error block">{{ form.errors.car }}</span></label>
          <label class="block"><span class="font-medium text-[16px]">{{ book.label('plate') }} <span v-if="book.plateLabel.value" class="text-quiet font-normal">{{ book.plateLabel.value }}</span></span>
            <span class="mt-1.5 flex items-stretch rounded-[10px] border-[2.5px] border-ink overflow-hidden bg-white focus-within:outline-3 focus-within:outline-ink focus-within:outline-offset-2"><span class="w-[18px] flex-none bg-[#1d4ea3]" aria-hidden="true" /><input v-model="form.values.plate" class="w-full min-h-[49px] px-3 font-display font-semibold text-[22px] tracking-[0.1em] uppercase bg-white outline-none placeholder:text-[#a79f97]" type="text" name="plate" :placeholder="book.help('plate')" maxlength="9"></span>
          </label>
          <label class="block sm:col-span-2"><span class="font-medium text-[16px]">{{ book.label('message') }}</span><textarea v-model="form.values.message" class="field mt-1.5" name="message" rows="4" :placeholder="book.messageHint.value" required :aria-invalid="!!form.errors.message" /><span v-if="form.errors.message" class="field-error block">{{ form.errors.message }}</span></label>
          <label class="block"><span class="font-medium text-[16px]">{{ book.label('when') }}</span>
            <select v-model="form.values.when" class="field mt-1.5" name="when"><option v-for="d in book.days.value" :key="d" :value="d">{{ d }}</option></select>
          </label>
          <label class="flex items-center gap-3 sm:mt-7 min-h-[54px] cursor-pointer"><input v-model="form.values.loaner" type="checkbox" name="loaner" class="w-6 h-6 accent-[var(--brand)]"><span>{{ book.loanerLabel.value }}</span></label>
          <KitFormExtras :form="form" />
          <div class="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-4 pt-2 pb-1">
            <button type="submit" class="btn btn-brand" :disabled="form.sending.value">{{ form.sending.value ? words.sending : book.submitLabel.value }} <UIcon v-if="!form.sending.value" name="i-lucide-arrow-right" aria-hidden="true" /></button>
            <p v-if="block.privacyNote" class="text-[14px] text-quiet flex-1 min-w-[220px]">{{ block.privacyNote }}</p>
            <p v-if="form.sent.value" class="basis-full font-semibold text-brand" role="status">{{ book.sentText.value }}</p>
            <p v-if="form.failure.value" class="basis-full field-error" role="alert">{{ form.failure.value }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
