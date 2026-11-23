<script setup lang="ts">
// Modrotisk's enquiry: the salesperson, her portrait in a print frame, where and when to meet as
// a ruled list, and the form in a panel with squared-off fields.
import type { SiteForm } from '#imports'
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; index?: number; anchor?: string; form: SiteForm; flats: Flat[] }>()
const { settings, nav } = await useSite()
const words = useSiteWords()
const form = props.form
const privacy = computed(() => menuLinks(nav.value?.legal)[0]?.url ?? null)
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 grid lg:grid-cols-12 gap-x-12 gap-y-12">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
        <p v-if="block.text" class="mt-6 text-quiet max-w-[30rem]">{{ tidyText(block.text) }}</p>
        <div v-if="settings?.sellerName" class="mt-9 flex gap-5 items-start">
          <div v-if="settings.sellerPhoto" class="frame w-28 sm:w-32 aspect-[4/5] flex-none"><CmsImage :media="settings.sellerPhoto" sizes="8rem" /></div>
          <div>
            <p v-if="settings.sellerRole" class="label">{{ settings.sellerRole }}</p>
            <p class="mt-1 font-display text-[1.45rem]">{{ settings.sellerName }}</p>
            <a v-if="settings.phone" :href="telHref(settings.phone)" class="block mt-2 font-display text-[1.45rem] num"><span class="link">{{ settings.phone }}</span></a>
            <a v-if="settings.email" :href="`mailto:${settings.email}`" class="inline-block mt-2 link">{{ settings.email }}</a>
          </div>
        </div>
        <dl v-if="block.office.length" class="mt-9 border-t border-line text-[0.98rem]">
          <div v-for="(row, i) in block.office" :key="i" class="grid grid-cols-[9rem_1fr] gap-4 py-3 border-b" style="border-color:var(--line-soft)">
            <dt class="text-quiet">{{ row.label }}</dt><dd class="num">{{ row.value }}</dd>
          </div>
        </dl>
      </div>

      <div class="lg:col-span-6 lg:col-start-7 border border-line p-6 lg:p-9 bg-panel/50">
        <p v-if="form.sent.value" class="text-[1.15rem]" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate data-enquiry @submit.prevent="form.submit">
          <EnquiryFields :form="form" :block="block" :flats="flats" :unit-label="form.fields.value.find((f) => f.key === 'unit')?.label ?? ''" />
          <div class="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
            <button type="submit" class="btn" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></button>
            <p class="text-[0.86rem] text-quiet max-w-[20rem]">{{ words.consentBefore }}<NuxtLink v-if="privacy" :to="privacy" class="link">{{ words.consentLink }}</NuxtLink><template v-else>{{ words.consentLink }}</template>{{ words.consentAfter }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
