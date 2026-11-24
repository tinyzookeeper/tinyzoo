<script setup lang="ts">
// Patra's enquiry: a soft band with the salesperson, her portrait with rounded corners and the
// phone number in the large serif, and the form on a white rounded sheet.
import type { SiteForm } from '#imports'
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm; flats: Flat[] }>()
const { settings, nav } = await useSite()
const words = useSiteWords()
const form = props.form
const privacy = computed(() => menuLinks(nav.value?.legal)[0]?.url ?? null)
</script>

<template>
  <section :id="anchor" class="mt-24 lg:mt-32 bg-soft scroll-mt-2">
    <div class="wrap py-20 lg:py-28 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3">{{ block.heading }}</component>
        <p v-if="block.text" class="lead mt-5">{{ tidyText(block.text) }}</p>
        <div v-if="settings?.sellerName" class="mt-9 flex items-center gap-5">
          <CmsImage v-if="settings.sellerPhoto" :media="settings.sellerPhoto" sizes="7rem" class="w-24 sm:w-28 aspect-[4/5] object-cover rounded-[12px] flex-none" />
          <div class="min-w-0">
            <p class="font-medium">{{ settings.sellerName }}</p>
            <p v-if="settings.sellerRole" class="text-[0.92rem] text-quiet">{{ settings.sellerRole.toLowerCase() }}</p>
            <a v-if="settings.phone" :href="telHref(settings.phone)" class="block mt-1 serif text-[2.3rem] sm:text-[2.7rem] num whitespace-nowrap hover:text-brand transition-colors">{{ settings.phone }}</a>
            <a v-if="settings.email" :href="`mailto:${settings.email}`" class="link">{{ settings.email }}</a>
          </div>
        </div>
        <p v-if="block.office.length" class="mt-9 pt-6 border-t border-line max-w-[30rem] text-quiet">{{ tidyText(block.office.map((r) => r.value).join(' ')) }}</p>
      </div>
      <div class="lg:col-span-5 lg:col-start-8 bg-paper rounded-[18px] p-6 sm:p-8 lg:p-9">
        <p v-if="form.sent.value" class="text-[1.1rem]" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate data-enquiry @submit.prevent="form.submit">
          <EnquiryFields :form="form" :block="block" :flats="flats" :unit-label="words.patra.unitLabel" legend-class="font-medium text-[0.88rem]" fields-gap="gap-4" ticks-top="mt-5" ticks-gap="gap-x-4" legend-gap="mt-1" message-top="mt-4" />
          <button type="submit" class="btn w-full mt-6" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[1.0625rem]" aria-hidden="true" /></button>
          <p class="mt-4 text-[0.86rem] text-quiet">{{ words.consentBefore }}<NuxtLink v-if="privacy" :to="privacy" class="link">{{ words.consentLink }}</NuxtLink><template v-else>{{ words.consentLink }}</template>{{ words.consentAfter }}</p>
        </form>
      </div>
    </div>
  </section>
</template>
