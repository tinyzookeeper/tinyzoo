<script setup lang="ts">
// Negativ's enquiry: the whole section is a field of the accent colour.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'enquiry'>; form: SiteForm; first?: boolean }>()
const { settings } = await useSite()
const words = useSiteWords()
const form = props.form
const size = computed(() => byLength(props.block.heading, [
  [9, 'text-[24vw] md:text-[12vw] wide:text-[min(12vw,12.5rem)]'],
  [22, 'text-[17vw] md:text-[7.6vw] wide:text-[min(7.6vw,7.8rem)]'],
], 'text-[12vw] md:text-[5.4vw] wide:text-[min(5.4vw,5.4rem)]'))
</script>

<template>
  <section class="on-brand bg-brand text-brand-ink">
    <div class="pad grid md:grid-cols-12 gap-x-10 gap-y-10 py-14 md:py-24">
      <div class="md:col-span-5 flex flex-col">
        <p v-if="block.eyebrow" class="m mb-4">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="d" :class="size"><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 mb-9 text-[1.2rem] leading-snug font-medium max-w-[24rem]">{{ tidyText(block.text) }}</p>
        <dl class="m mt-auto grid grid-cols-[6.5rem_1fr] border-t-2 border-brand-ink">
          <template v-if="settings?.phone">
            <dt class="py-2.5 border-b border-brand-ink/40">{{ words.phone }}</dt><dd class="border-b border-brand-ink/40"><a class="lnk" :href="telHref(settings.phone)">{{ settings.phone }}</a></dd>
          </template>
          <template v-if="settings?.email">
            <dt class="py-2.5 border-b border-brand-ink/40">{{ words.email }}</dt><dd class="border-b border-brand-ink/40"><a class="lnk normal-case break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></dd>
          </template>
          <template v-if="settings?.address">
            <dt class="py-2.5 border-b border-brand-ink/40">{{ words.studio }}</dt><dd class="py-2.5 border-b border-brand-ink/40">{{ settings.address }}<template v-if="settings.addressNote"><br>{{ settings.addressNote }}</template></dd>
          </template>
          <template v-if="settings?.instagram">
            <dt class="py-2.5 border-b border-brand-ink/40">Instagram</dt><dd class="border-b border-brand-ink/40"><a class="lnk normal-case" :href="settings.instagram" target="_blank" rel="noopener">{{ socialHandle(settings.instagram) }}</a></dd>
          </template>
        </dl>
      </div>

      <div class="md:col-span-6 md:col-start-7">
        <p v-if="form.sent.value" class="text-[1.6rem] md:text-[2.3rem] leading-[1.2] font-medium" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid sm:grid-cols-2 gap-x-8 gap-y-6 content-start" novalidate @submit.prevent="form.submit">
          <div v-for="f in form.fields.value" :key="f.key" class="fld" :class="f.multiline ? 'sm:col-span-2' : ''">
            <label class="m" :for="form.id(f.key)">{{ f.label }}</label>
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
          <div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-5 pt-2">
            <button class="btn btn-ink m !font-medium shrink-0 !min-h-[56px] !px-7" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" /></button>
            <p v-if="block.consent" class="m normal-case tracking-normal">
              <KitMarked v-if="block.consentUrl" :text="block.consent" as="a" :attrs="{ href: siteHref(block.consentUrl), class: 'underline underline-offset-4' }" />
              <KitMarked v-else :text="block.consent" plain />
            </p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
