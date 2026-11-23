<script setup lang="ts">
// Vizitka's contact: on a tinted band, the heading, a ruled list of the ways to reach the
// person on the left and the form on a sheet of paper on the right.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words } = await useProfile()
const form = props.form
</script>

<template>
  <section :id="anchor" class="bg-tint">
    <div class="wrap py-20 lg:py-28 grid lg:grid-cols-12 gap-x-10 gap-y-12">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label text-brand">{{ czText(block.eyebrow) }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.1rem] md:text-[2.75rem] leading-[1.12]"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-6 max-w-[30rem]">{{ czText(block.text) }}</p>
        <dl class="mt-10 border-t border-ink max-w-[30rem]">
          <div v-if="settings?.phone" class="grid sm:grid-cols-[6.5rem_1fr] gap-x-4 gap-y-1 py-4 border-b border-line items-baseline">
            <dt class="label text-quiet">{{ words.phone }}</dt>
            <dd><a class="serif text-ink text-[1.3rem] font-medium hover:text-brand transition-colors inline-flex min-h-[44px] items-center" :href="telHref(settings.phone)">{{ tidyText(settings.phone) }}</a><span v-if="settings.phoneHours" class="block text-[0.9rem] text-quiet">{{ czText(settings.phoneHours) }}</span></dd>
          </div>
          <div v-if="settings?.email" class="grid sm:grid-cols-[6.5rem_1fr] gap-x-4 gap-y-1 py-4 border-b border-line items-baseline">
            <dt class="label text-quiet"><span class="whitespace-nowrap">{{ words.email }}</span></dt>
            <dd><a class="serif text-ink text-[1.3rem] font-medium hover:text-brand transition-colors inline-flex min-h-[44px] items-center break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></dd>
          </div>
          <div v-if="settings?.address" class="grid sm:grid-cols-[6.5rem_1fr] gap-x-4 gap-y-1 py-4 border-b border-ink items-baseline">
            <dt class="label text-quiet">{{ words.personally }}</dt>
            <dd class="text-ink">{{ tidyText(settings.address) }}<span v-if="settings.addressNote" class="block text-[0.9rem] text-quiet">{{ czText(settings.addressNote) }}</span></dd>
          </div>
        </dl>
      </div>

      <div class="lg:col-span-6 lg:col-start-7 bg-paper p-6 md:p-10">
        <p v-if="form.sent.value" class="serif text-ink text-[1.4rem] leading-snug" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid gap-6 content-start" novalidate @submit.prevent="form.submit">
          <ContactFields :form="form" :block="block" />
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
            <button class="btn" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
            <p v-if="block.note" class="text-[0.9rem] text-quiet">{{ czText(block.note) }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
