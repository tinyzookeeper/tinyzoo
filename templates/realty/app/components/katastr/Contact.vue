<script setup lang="ts">
// Katastr's contact: the office as a ruled table (address, hours, phone, e-mail) and the form
// on the tinted ground beside it.
const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm; topics: string[] }>()
const { settings, address, words } = await useOffice()
const w = words.value.katastr
const form = props.form
const privacy = computed(() => ({ to: words.value.privacyUrl }))
</script>

<template>
  <section :id="anchor" class="bg-tint border-t border-line">
    <div class="wrap py-16 md:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-12">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[2.1rem] md:text-[2.75rem] leading-[1.1]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[28rem]">{{ tidyText(block.text) }}</p>
        <dl class="params mt-8 text-[0.97rem]">
          <div v-if="address"><dt>{{ w.address }}</dt><dd>{{ address }}</dd></div>
          <div v-if="settings?.hours"><dt>{{ w.open }}</dt><dd>{{ settings.hours }}</dd></div>
          <div v-if="settings?.phone"><dt>{{ words.phone }}</dt><dd><a class="num hover:text-brand transition-colors" :href="telHref(settings.phone)">{{ settings.phone }}</a></dd></div>
          <div v-if="settings?.email"><dt>{{ words.email }}</dt><dd><a class="hover:text-brand transition-colors" :href="`mailto:${settings.email}`">{{ settings.email }}</a></dd></div>
        </dl>
      </div>
      <div class="lg:col-span-6 lg:col-start-7 field" data-enquiry>
        <p v-if="form.sent.value" class="text-ink" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="grid grid-cols-2 gap-x-4 gap-y-4 content-start" novalidate @submit.prevent="form.submit">
          <SiteFields :form="form" label-class="label" :cols="{ name: 'col-span-2 sm:col-span-1', contact: 'col-span-2 sm:col-span-1' }" :choices="{ topic: topics }" :placeholders="{ message: w.messagePlaceholder }" />
          <div class="col-span-2 flex flex-wrap items-center justify-between gap-4">
            <p class="text-[0.88rem] text-quiet max-w-[22rem]">{{ w.consent[0] }}<NuxtLink class="underline underline-offset-4" :to="privacy.to">{{ w.consent[1] }}</NuxtLink>{{ w.consent[2] }}</p>
            <button class="btn" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
