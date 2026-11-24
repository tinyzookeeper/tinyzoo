<script setup lang="ts">
// Po slunci's enquiry: on a soft rounded slab the salesperson, her portrait in a circle with a
// yellow ring, where and when to meet, and the form on a white rounded card.
import type { SiteForm } from '#imports'
import type { Flat } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; anchor?: string; form: SiteForm; flats: Flat[] }>()
const { settings, nav } = await useSite()
const words = useSiteWords()
const form = props.form
const privacy = computed(() => menuLinks(nav.value?.legal)[0]?.url ?? null)
</script>

<template>
  <section :id="anchor" class="slab bg-soft scroll-mt-4">
    <div class="wrap grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
        <p v-if="block.text" class="lead mt-5">{{ tidyText(block.text) }}</p>
        <div v-if="settings?.sellerName" class="mt-8 flex items-center gap-5">
          <CmsImage v-if="settings.sellerPhoto" :media="settings.sellerPhoto" sizes="8rem" class="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover object-top flex-none" style="box-shadow:0 0 0 5px var(--sun)" />
          <div>
            <p class="serif text-[1.45rem] leading-tight">{{ settings.sellerName }}</p>
            <p v-if="settings.sellerRole" class="text-[0.94rem] text-quiet">{{ settings.sellerRole.toLowerCase() }}</p>
            <a v-if="settings.phone" :href="telHref(settings.phone)" class="block mt-1 serif text-[1.9rem] leading-tight num link">{{ settings.phone }}</a>
            <a v-if="settings.email" :href="`mailto:${settings.email}`" class="link">{{ settings.email }}</a>
          </div>
        </div>
        <p v-if="block.office.length" class="mt-8 max-w-[28rem] text-[0.96rem] text-quiet">{{ tidyText(block.office.map((r) => r.value).join(' ')) }}</p>
      </div>
      <div class="lg:col-span-6 lg:col-start-7 card bg-paper">
        <p v-if="form.sent.value" class="text-[1.1rem]" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate data-enquiry @submit.prevent="form.submit">
          <EnquiryFields :form="form" :block="block" :flats="flats" :unit-label="form.fields.value.find((f) => f.key === 'unit')?.label ?? ''" legend-class="text-[0.9rem] font-semibold" fields-gap="gap-4" ticks-top="mt-5" ticks-gap="gap-x-4" legend-gap="mt-1" message-top="mt-4" />
          <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
            <button type="submit" class="btn" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[1.125rem]" aria-hidden="true" /></button>
            <p class="text-[0.86rem] text-quiet max-w-[19rem]">{{ words.consentBefore }}<NuxtLink v-if="privacy" :to="privacy" class="link">{{ words.consentLink }}</NuxtLink><template v-else>{{ words.consentLink }}</template>{{ words.consentAfter }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
