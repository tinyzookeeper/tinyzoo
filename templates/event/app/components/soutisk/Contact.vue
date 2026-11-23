<script setup lang="ts">
// Soutisk's contact page: the organiser's details and a short form with round fields.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; form: SiteForm }>()
const { settings, words } = await useEvent()
const form = props.form
</script>

<template>
  <section class="bg-paper pt-10 pb-24 sm:pb-36">
    <div class="wrap grid lg:grid-cols-12 gap-x-10 gap-y-10">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-lg text-quiet max-w-[28rem]">{{ tidyText(block.text) }}</p>
        <p v-if="settings?.contactName" class="mt-6 font-bold">{{ settings.contactName }}<template v-if="settings.contactRole">, {{ settings.contactRole }}</template></p>
        <p v-if="settings?.phone"><a :href="telHref(settings.phone)" class="disp text-[1.9rem] inline-flex items-center min-h-11 hover:underline decoration-[3px] underline-offset-4 decoration-c1">{{ settings.phone }}</a></p>
        <p v-if="settings?.email"><a :href="`mailto:${settings.email}`" class="ulink break-all">{{ settings.email }}</a></p>
      </div>
      <div class="lg:col-span-7 rounded-[28px] bg-paper2 p-6 sm:p-8">
        <p v-if="form.sent.value" class="text-xl font-bold" role="status" data-form-sent>{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="grid gap-5" novalidate @submit.prevent="form.submit">
          <div v-for="f in form.fields.value" :key="f.key" class="field">
            <label :for="form.id(f.key)">{{ f.label }}</label>
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
