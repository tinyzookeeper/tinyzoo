<script setup lang="ts">
// Cedule's contact: "call" and the phone number set enormous with a rule under it, a mono
// table of the office, and the form on a tinted block between black rules.
const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm; topics: string[] }>()
const { settings, address, words } = await useOffice()
const w = words.value.cedule
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap py-14 md:py-24 grid lg:grid-cols-12 gap-x-10 gap-y-12">
    <div class="lg:col-span-6">
      <p v-if="block.eyebrow" class="mono caps">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[3.2rem] md:text-[5rem] tracking-[-0.05em] leading-[0.9]"><KitMarked :text="block.heading" plain /></component>
      <p v-if="block.text" class="mt-6 text-[1.1rem] font-medium max-w-[34rem]">{{ tidyText(block.text) }}</p>
      <a v-if="settings?.phone" class="mt-8 inline-block font-extrabold text-[2.6rem] md:text-[4rem] leading-none tracking-[-0.05em] num big-link" :href="telHref(settings.phone)">{{ settings.phone }}</a>
      <dl class="params mt-10 max-w-[34rem]">
        <div v-if="address"><dt>{{ w.address }}</dt><dd>{{ address }}</dd></div>
        <div v-if="settings?.hours"><dt>{{ w.open }}</dt><dd>{{ settings.hours }}</dd></div>
        <div v-if="settings?.email"><dt>{{ words.email }}</dt><dd><a class="hover:underline underline-offset-4 decoration-2" :href="`mailto:${settings.email}`">{{ settings.email }}</a></dd></div>
        <div v-if="block.viewings"><dt>{{ w.viewingsRow }}</dt><dd>{{ tidyText(block.viewings) }}</dd></div>
      </dl>
    </div>
    <div class="lg:col-span-6 field bg-tint border-2 border-ink p-6 md:p-9" data-enquiry>
      <p v-if="form.sent.value" class="font-bold" role="status">{{ form.successMessage.value }}</p>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="grid grid-cols-2 gap-x-3 gap-y-4 content-start" novalidate @submit.prevent="form.submit">
        <SiteFields :form="form" label-class="mono caps" :cols="{ name: 'col-span-2 sm:col-span-1', contact: 'col-span-2 sm:col-span-1' }" :choices="{ topic: topics }" :placeholders="{ message: w.messagePlaceholder }" />
        <div class="col-span-2 flex flex-wrap items-center justify-between gap-4">
          <p class="mono text-quiet max-w-[20rem]">{{ w.consent[0] }}<NuxtLink class="underline underline-offset-4" :to="words.privacyUrl">{{ w.consent[1] }}</NuxtLink>{{ w.consent[2] }}</p>
          <button class="btn" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></button>
        </div>
      </form>
    </div>
  </section>
</template>
