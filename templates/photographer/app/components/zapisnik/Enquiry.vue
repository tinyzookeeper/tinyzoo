<script setup lang="ts">
// Zápisník's enquiry: a tinted panel, the contacts with small icons on the left, the form on
// a white card on the right.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'enquiry'>; form: SiteForm; first?: boolean }>()
const { settings } = await useSite()
const words = useSiteWords()
const form = props.form
</script>

<template>
  <section class="wrap pb-20 md:pb-28" :class="first ? 'pt-6 md:pt-8' : ''">
    <div class="grid md:grid-cols-12 gap-x-10 gap-y-10 bg-tint rounded-[18px] px-5 py-9 md:p-14 -mx-1.5 md:mx-0">
      <div class="md:col-span-5">
        <p v-if="block.eyebrow" class="hand text-brand text-[1.9rem] md:text-[2.1rem] -rotate-2 origin-left mb-3">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] md:text-[3.6rem] leading-[1.04]"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 max-w-[25rem]">{{ tidyText(block.text) }}</p>
        <ul class="mt-8 grid gap-1 text-ink">
          <li v-if="settings?.phone"><a class="navlink gap-3.5 !font-bold text-[1.15rem]" :href="telHref(settings.phone)"><UIcon name="i-lucide-phone" class="text-brand size-5 shrink-0" aria-hidden="true" />{{ settings.phone }}</a></li>
          <li v-if="settings?.email"><a class="navlink gap-3.5 !font-bold text-[1.15rem] break-all" :href="`mailto:${settings.email}`"><UIcon name="i-lucide-mail" class="text-brand size-5 shrink-0" aria-hidden="true" />{{ settings.email }}</a></li>
          <li v-if="settings?.instagram"><a class="navlink gap-3.5 !font-bold text-[1.15rem]" :href="settings.instagram" target="_blank" rel="noopener"><UIcon name="i-lucide-instagram" class="text-brand size-5 shrink-0" aria-hidden="true" />{{ socialHandle(settings.instagram) }}</a></li>
          <li v-if="settings?.address" class="flex gap-3.5 py-2.5"><UIcon name="i-lucide-map-pin" class="text-brand mt-1 size-5 shrink-0" aria-hidden="true" /><span><span class="font-bold text-[1.15rem]">{{ settings.address }}</span><span v-if="settings.addressNote" class="block text-body">{{ settings.addressNote }}</span></span></li>
        </ul>
      </div>

      <div class="md:col-span-7">
        <p v-if="form.sent.value" class="bg-card rounded-[14px] p-5 md:p-9 font-display text-ink text-[1.5rem] leading-snug" role="status">{{ form.successMessage.value }}</p>
        <form
          v-else-if="!form.unavailable.value" :ref="form.el" novalidate
          class="relative bg-card rounded-[14px] p-5 md:p-9 grid sm:grid-cols-2 gap-x-5 gap-y-5 content-start shadow-[0_0_0_1px_rgba(22,28,25,.05),0_1px_2px_rgba(22,28,25,.1),0_18px_30px_-20px_rgba(22,28,25,.35)]"
          @submit.prevent="form.submit"
        >
          <div v-for="f in form.fields.value" :key="f.key" class="fld" :class="f.multiline ? 'sm:col-span-2' : ''">
            <label :for="form.id(f.key)">{{ f.label }}</label>
            <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined" :aria-invalid="!!form.errors[f.key]" />
            <select v-else-if="f.type === 'select'" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :aria-invalid="!!form.errors[f.key]">
              <option v-if="f.default == null" value="" :disabled="f.required">—</option>
              <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <input
              v-else :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :placeholder="f.help ?? undefined"
              :type="f.format === 'email' ? 'email' : 'text'" :autocomplete="f.format === 'email' ? 'email' : f.key === 'name' ? 'name' : undefined" :aria-invalid="!!form.errors[f.key]"
            >
            <p v-if="form.errors[f.key]" class="fld-error">{{ form.errors[f.key] }}</p>
          </div>
          <KitFormExtras :form="form" />
          <p v-if="form.failure.value" class="sm:col-span-2 fld"><span class="fld-error" role="alert">{{ form.failure.value }}</span></p>
          <div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-4">
            <button class="btn shrink-0" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
            <p v-if="block.consent" class="text-[0.95rem] leading-snug">
              <KitMarked v-if="block.consentUrl" :text="block.consent" as="a" :attrs="{ href: siteHref(block.consentUrl), class: 'underline underline-offset-4 hover:text-brand' }" />
              <KitMarked v-else :text="block.consent" plain />
            </p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
