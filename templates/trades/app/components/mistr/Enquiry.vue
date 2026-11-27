<script setup lang="ts">
// Mistr's enquiry: on a tinted band, the heading, the phone number and the e-mail on the
// left, the form on a white card on the right.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, phone, words } = await useTrades()
const form = props.form
const hours = computed(() => [settings.value?.hoursLine, settings.value?.emergency ? `${words.value.emergency.toLowerCase()} ${settings.value.emergency}` : ''].filter(Boolean).join(' · '))
</script>

<template>
  <section :id="anchor" class="bg-tint scroll-mt-20">
    <div class="wrap py-20 md:py-28">
      <div class="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div class="lg:col-span-5">
          <component :is="first ? 'h1' : 'h2'" v-bind="cmsField('heading')" class="h2"><KitMarked :text="block.heading" plain /></component>
          <p v-if="block.text" class="serif mt-5">{{ tidyText(block.text) }}</p>
          <div v-if="phone || settings?.email" class="mt-9 pt-7 border-t border-line">
            <template v-if="phone">
              <p v-if="block.callLabel" class="text-[0.9375rem] text-quiet">{{ block.callLabel }}</p>
              <a :href="phone.href" class="mt-1 inline-flex items-center gap-3 min-h-[52px] text-ink text-[2.25rem] md:text-[2.6rem] font-bold tracking-[-0.03em] tabular-nums hover:text-brand transition-colors">{{ phone.text }}</a>
              <p v-if="hours" class="mt-2 text-[0.9375rem]">{{ hours }}</p>
            </template>
            <a v-if="settings?.email" :href="`mailto:${settings.email}`" class="tlink mt-3 break-all">{{ settings.email }}</a>
          </div>
        </div>

        <div v-if="form.sent.value" class="lg:col-span-7 bg-white border border-line rounded-[4px] p-6 md:p-9" role="status">
          <p class="serif text-ink md:!text-[1.25rem]">{{ form.successMessage.value }}</p>
        </div>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="lg:col-span-7 bg-white border border-line rounded-[4px] p-6 md:p-9 grid sm:grid-cols-2 gap-x-5 gap-y-5" novalidate @submit.prevent="form.submit">
          <EnquiryFields :form="form" />
          <div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
            <button type="submit" class="btn btn-brand !min-h-[56px] !px-7 text-[1.0625rem] cursor-pointer whitespace-nowrap shrink-0" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
            <p v-if="block.note" class="text-[0.875rem] text-quiet">{{ tidyText(block.note) }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
