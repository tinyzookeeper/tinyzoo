<script setup lang="ts">
// Ateliér's enquiry: the contacts as a ruled list on the left, the form with underlined fields on the right.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'enquiry'>; first?: boolean; form: SiteForm }>()
const { settings } = await useSite()
const words = useSiteWords()
const form = props.form
</script>

<template>
  <section class="wrap pb-20 md:pb-32">
    <div class="grid md:grid-cols-12 gap-x-10 gap-y-12 border-t border-line pt-10 md:pt-16">
      <div class="md:col-span-5">
        <p v-if="block.eyebrow" class="label text-quiet mb-4">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.6rem] md:text-[3.8rem] leading-[1.02]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[26rem]">{{ tidyText(block.text) }}</p>
        <dl class="mt-10 border-t border-line">
          <div v-if="settings?.phone" class="grid grid-cols-[6.5rem_1fr] items-baseline py-3 border-b border-line">
            <dt class="label text-quiet">{{ words.phone }}</dt>
            <dd><a class="font-display text-ink text-[1.3rem] hover:text-brand" :href="telHref(settings.phone)">{{ settings.phone }}</a></dd>
          </div>
          <div v-if="settings?.email" class="grid grid-cols-[6.5rem_1fr] items-baseline py-3 border-b border-line">
            <dt class="label text-quiet">{{ words.email }}</dt>
            <dd><a class="font-display text-ink text-[1.3rem] hover:text-brand break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></dd>
          </div>
          <div v-if="settings?.address" class="grid grid-cols-[6.5rem_1fr] items-baseline py-3 border-b border-line">
            <dt class="label text-quiet">{{ words.studio }}</dt>
            <dd class="font-display text-ink text-[1.3rem] leading-snug">{{ settings.address }}<span v-if="settings.addressNote" class="block font-sans text-base text-quiet">{{ settings.addressNote }}</span></dd>
          </div>
          <div v-if="settings?.instagram" class="grid grid-cols-[6.5rem_1fr] items-baseline py-3 border-b border-line">
            <dt class="label text-quiet">Instagram</dt>
            <dd><a class="font-display text-ink text-[1.3rem] hover:text-brand" :href="settings.instagram" target="_blank" rel="noopener">{{ socialHandle(settings.instagram) }}</a></dd>
          </div>
        </dl>
      </div>

      <div class="md:col-span-6 md:col-start-7">
        <p v-if="form.sent.value" class="font-display text-ink text-[1.6rem] md:text-[2rem] leading-snug" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid sm:grid-cols-2 gap-x-8 gap-y-7 content-start" novalidate @submit.prevent="form.submit">
          <div v-for="f in form.fields.value" :key="f.key" class="field" :class="f.multiline ? 'sm:col-span-2' : ''">
            <label class="label" :for="form.id(f.key)">{{ f.label }}</label>
            <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
            <select v-else-if="f.type === 'select'" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :aria-invalid="!!form.errors[f.key]">
              <option v-if="f.default == null" value="" :disabled="f.required">—</option>
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <input
              v-else :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined"
              :type="f.format === 'email' ? 'email' : 'text'" :autocomplete="f.format === 'email' ? 'email' : f.key === 'name' ? 'name' : undefined" :aria-invalid="!!form.errors[f.key]"
            >
            <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
          </div>
          <KitFormExtras :form="form" />
          <p v-if="form.failure.value" class="sm:col-span-2 field"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
          <div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-5">
            <button class="btn label shrink-0" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
            <p v-if="block.consent" class="text-[0.95rem] leading-snug text-quiet">
              <KitMarked v-if="block.consentUrl" :text="block.consent" as="a" :attrs="{ href: siteHref(block.consentUrl), class: 'underline underline-offset-4 hover:text-ink' }" />
              <KitMarked v-else :text="block.consent" plain />
            </p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
