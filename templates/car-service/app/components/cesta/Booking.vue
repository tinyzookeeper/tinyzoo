<script setup lang="ts">
// Cesta's booking: the phone number on the one brand-coloured surface of the page, beside the
// request form on a soft grey one.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'booking'>; first?: boolean; anchor?: string; form: SiteForm }>()
const garage = await useGarage()
const { phone, phoneUrl, phone2, phone2Url, serviceInSentence, tyresInSentence, words } = garage
const form = props.form
const book = useBookingForm(form, () => props.block, garage)
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24 scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-14 gap-y-12">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 font-extrabold text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
        <p class="mt-5 text-quiet max-w-[28em]">{{ tidyText([block.text, words.freeSentence(serviceInSentence, tyresInSentence)].filter(Boolean).join(' ')) }}</p>
        <div class="mt-10 rounded-[28px] bg-brand text-brand-ink p-7 sm:p-9">
          <p v-if="block.callLabel" class="font-display font-semibold text-[17px] opacity-90">{{ block.callLabel }}</p>
          <a v-if="phone" :href="phoneUrl" class="num mt-1 inline-block text-[44px] sm:text-[54px] font-extrabold leading-none hover:underline underline-offset-8 decoration-[3px]">{{ phone }}</a>
          <p v-if="block.callNote" class="mt-4 text-[16.5px] opacity-95">{{ book.callParts.value[0] }}<template v-if="book.callParts.value[1] !== null"><a :href="phone2Url" class="num font-bold underline underline-offset-4 whitespace-nowrap">{{ phone2 }}</a>{{ book.callParts.value[1] }}</template></p>
        </div>
      </div>
      <form v-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 rounded-[28px] bg-paper p-6 sm:p-10 grid sm:grid-cols-2 gap-x-5 gap-y-5 content-start" novalidate @submit.prevent="form.submit">
        <label class="block"><span class="font-medium text-[16px]">{{ book.label('name') }}</span><input v-model="form.values.name" class="field mt-2" type="text" name="name" autocomplete="name" required :aria-invalid="!!form.errors.name"><span v-if="form.errors.name" class="field-error block">{{ form.errors.name }}</span></label>
        <label class="block"><span class="font-medium text-[16px]">{{ book.label('phone') }}</span><input v-model="form.values.phone" class="field mt-2" type="tel" name="phone" autocomplete="tel" :placeholder="book.help('phone')" required :aria-invalid="!!form.errors.phone"><span v-if="form.errors.phone" class="field-error block">{{ form.errors.phone }}</span></label>
        <label class="block"><span class="font-medium text-[16px]">{{ book.carLabel.value }}</span><input v-model="form.values.car" class="field mt-2" type="text" name="car" :placeholder="book.help('car')" required :aria-invalid="!!form.errors.car"><span v-if="form.errors.car" class="field-error block">{{ form.errors.car }}</span></label>
        <label class="block"><span class="font-medium text-[16px]">{{ book.label('plate') }} <span v-if="book.plateLabel.value" class="text-quiet font-normal">{{ book.plateLabel.value }}</span></span><input v-model="form.values.plate" class="field mt-2 uppercase num tracking-[0.06em]" type="text" name="plate" :placeholder="book.help('plate')" maxlength="9"></label>
        <label class="block sm:col-span-2"><span class="font-medium text-[16px]">{{ book.label('message') }}</span><textarea v-model="form.values.message" class="field mt-2" name="message" rows="4" :placeholder="book.messageHint.value" required :aria-invalid="!!form.errors.message" /><span v-if="form.errors.message" class="field-error block">{{ form.errors.message }}</span></label>
        <label class="block"><span class="font-medium text-[16px]">{{ book.label('when') }}</span>
          <select v-model="form.values.when" class="field mt-2" name="when"><option v-for="d in book.days.value" :key="d" :value="d">{{ d }}</option></select>
        </label>
        <label class="flex items-center gap-3 sm:mt-8 min-h-[54px] cursor-pointer"><input v-model="form.values.loaner" type="checkbox" name="loaner" class="w-6 h-6 accent-[var(--brand)]"><span>{{ book.loanerLabel.value }}</span></label>
        <KitFormExtras :form="form" />
        <div class="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
          <button type="submit" class="btn btn-brand" :disabled="form.sending.value">{{ form.sending.value ? words.sending : book.submitLabel.value }}</button>
          <p v-if="block.privacyNote" class="text-[15px] text-quiet flex-1 min-w-[220px]">{{ block.privacyNote }}</p>
          <p v-if="form.sent.value" class="basis-full font-display font-bold text-brand" role="status">{{ book.sentText.value }}</p>
          <p v-if="form.failure.value" class="basis-full field-error" role="alert">{{ form.failure.value }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
