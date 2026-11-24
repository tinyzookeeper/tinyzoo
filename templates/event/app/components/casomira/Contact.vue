<script setup lang="ts">
// Časomíra's contact page: the organiser's details and a short form on a dark panel.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; form: SiteForm }>()
const { settings, words } = await useEvent()
const form = props.form
</script>

<template>
  <section class="py-16 sm:py-24" :class="first ? 'pt-36 sm:pt-44' : 'border-t border-line'">
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="mono idx">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-4"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-quiet max-w-[28rem]">{{ tidyText(block.text) }}</p>
        <dl class="mt-8 border-t border-line">
          <div v-if="settings?.contactName" class="flex justify-between gap-4 py-3 border-b border-line"><dt class="mono text-quiet pt-1">{{ ucfirst(settings.contactRole) }}</dt><dd class="font-bold text-right">{{ settings.contactName }}</dd></div>
          <div v-if="settings?.phone" class="flex justify-between gap-4 py-3 border-b border-line items-baseline"><dt class="mono text-quiet">{{ words.phone }}</dt><dd><a :href="telHref(settings.phone)" class="led text-[1.9rem] hover:!text-text transition-colors">{{ settings.phone }}</a></dd></div>
          <div v-if="settings?.email" class="flex justify-between gap-4 py-3 border-b border-line"><dt class="mono text-quiet pt-1">{{ words.email }}</dt><dd><a :href="`mailto:${settings.email}`" class="font-bold hover:text-led transition-colors underline underline-offset-4 decoration-1 break-all">{{ settings.email }}</a></dd></div>
        </dl>
      </div>
      <div class="lg:col-span-7 panel p-6 sm:p-8">
        <p v-if="form.sent.value" class="text-xl font-bold" role="status" data-form-sent>{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="grid gap-5" novalidate @submit.prevent="form.submit">
          <div v-for="f in form.fields.value" :key="f.key" class="field">
            <label class="mono text-quiet mb-2" :for="form.id(f.key)">{{ f.label }}</label>
            <textarea v-if="f.multiline" :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :aria-invalid="!!form.errors[f.key]" />
            <input v-else :id="form.id(f.key)" v-model="form.values[f.key]" :name="f.key" :required="f.required" :maxlength="f.max ?? undefined" :type="f.format === 'email' ? 'email' : 'text'" :autocomplete="f.key === 'name' ? 'name' : f.key === 'email' ? 'email' : undefined" :aria-invalid="!!form.errors[f.key]">
            <p v-if="form.errors[f.key]" class="field-error">{{ form.errors[f.key] }}</p>
          </div>
          <KitFormExtras :form="form" />
          <p v-if="form.failure.value" class="field-error" role="alert">{{ form.failure.value }}</p>
          <div><button class="btn max-sm:w-full" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button></div>
        </form>
      </div>
    </div>
  </section>
</template>
