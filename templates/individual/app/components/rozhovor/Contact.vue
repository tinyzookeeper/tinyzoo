<script setup lang="ts">
// Rozhovor's contact: on a dark rounded panel the visitor asks when they will talk, the owner
// answers, a photograph and the ways to reach them follow, and the form is a light card.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words } = await useProfile()
const form = props.form
</script>

<template>
  <section :id="anchor" class="panel bg-ink text-paper on-dark">
    <div class="wrap py-14 lg:py-24 grid lg:grid-cols-12 gap-x-12 gap-y-12 items-start">
      <div class="lg:col-span-6">
        <RozhovorQuestion :question="block.question" kicker-class="opacity-80" />
        <RozhovorAnswer :heading="block.heading" :first="first" :asked="!!block.question" light />
        <div v-if="block.image" class="ph mt-9 aspect-[16/9] rounded-[1.75rem]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 36rem, 100vw" /></div>
        <ul class="mt-7 space-y-1">
          <li v-if="settings?.phone"><a class="inline-flex items-center gap-3 min-h-[48px] serif font-bold text-[1.6rem] tracking-[-0.02em] hover:underline underline-offset-4" :href="telHref(settings.phone)"><UIcon name="i-lucide-phone" class="text-[1.15rem]" aria-hidden="true" /> {{ tidyText(settings.phone) }}</a></li>
          <li v-if="settings?.email"><a class="inline-flex items-center gap-3 min-h-[48px] font-medium text-[1.2rem] hover:underline underline-offset-4 break-all" :href="`mailto:${settings.email}`"><UIcon name="i-lucide-mail" class="text-[1.15rem]" aria-hidden="true" /> {{ settings.email }}</a></li>
          <li v-if="settings?.address" class="flex items-center gap-3 min-h-[48px] text-[1.2rem]"><UIcon name="i-lucide-map-pin" class="text-[1.15rem]" aria-hidden="true" /> {{ tidyText(settings.address) }}<template v-if="settings.addressNote"> · {{ czText(settings.addressNote) }}</template></li>
        </ul>
      </div>

      <div class="lg:col-span-6 bg-card text-body rounded-[1.5rem] md:rounded-[2.25rem] p-5 md:p-9">
        <p v-if="form.sent.value" class="serif text-ink font-bold text-[1.5rem] leading-[1.2] tracking-[-0.02em]" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" class="grid gap-5 content-start" novalidate @submit.prevent="form.submit">
          <p v-if="block.formTitle" class="serif text-ink font-bold text-[1.5rem] leading-[1.2] tracking-[-0.02em]">{{ czText(block.formTitle) }}</p>
          <ContactFields :form="form" :block="block" gap="gap-5" />
          <div class="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
            <button class="btn" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
            <p v-if="block.note" class="text-[1.02rem] text-quiet">{{ czText(block.note) }}</p>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
