<script setup lang="ts">
// Rozsvíceno's contact: the phone number set large in the lamp colour, the office as rows with
// small icons, and the form in a rounded panel whose fields are as dark as the page.
const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm; topics: string[] }>()
const { settings, address, words } = await useOffice()
const w = words.value.rozsviceno
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap py-20 md:py-32 grid lg:grid-cols-12 gap-x-12 gap-y-12">
    <div class="lg:col-span-5">
      <p v-if="block.eyebrow" class="hand text-[1.2rem]">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2.3rem] md:text-[3.2rem]"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'hand' }" /></component>
      <p v-if="block.text" class="mt-5 text-quiet max-w-[28rem]">{{ tidyText(block.text) }}</p>
      <a v-if="settings?.phone" class="mt-7 inline-flex items-center min-h-[48px] fig text-[2.3rem] md:text-[2.8rem] leading-none text-lamp hover:text-cream transition-colors" :href="telHref(settings.phone)">{{ settings.phone }}</a>
      <ul class="mt-6 space-y-1">
        <li v-if="address" class="flex items-center gap-3 min-h-[44px]"><UIcon name="i-lucide-map-pin" class="text-lamp" aria-hidden="true" />{{ address }}</li>
        <li v-if="settings?.hours" class="flex items-center gap-3 min-h-[44px]"><UIcon name="i-lucide-clock" class="text-lamp" aria-hidden="true" />{{ settings.hours }}</li>
        <li v-if="settings?.email"><a class="inline-flex items-center gap-3 min-h-[44px] hover:text-lamp transition-colors" :href="`mailto:${settings.email}`"><UIcon name="i-lucide-mail" class="text-lamp" aria-hidden="true" />{{ settings.email }}</a></li>
      </ul>
    </div>
    <div class="lg:col-span-7 field rounded-[2rem] bg-surface shadow-[inset_0_0_0_1px_var(--line)] p-6 md:p-9 [&_input]:bg-night [&_select]:bg-night [&_textarea]:bg-night" data-enquiry>
      <p v-if="form.sent.value" class="font-medium" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="grid grid-cols-2 gap-x-3 gap-y-4 content-start" novalidate @submit.prevent="form.submit">
        <SiteFields :form="form" :cols="{ name: 'col-span-2 sm:col-span-1', contact: 'col-span-2 sm:col-span-1' }" :choices="{ topic: topics }" :placeholders="{ message: w.messagePlaceholder }" />
        <div class="col-span-2 flex flex-wrap items-center justify-between gap-4">
          <p class="text-[0.9rem] text-quiet max-w-[22rem]">{{ w.consent[0] }}<NuxtLink class="underline underline-offset-4" :to="words.privacyUrl">{{ w.consent[1] }}</NuxtLink>{{ w.consent[2] }}</p>
          <button class="btn" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
        </div>
      </form>
    </div>
  </section>
</template>
