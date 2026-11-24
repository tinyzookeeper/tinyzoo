<script setup lang="ts">
// Čtvero dob's contact: the brand colour across the page, where the association meets and how
// to reach it on the left, and on the right one white card with the message form. The form is
// a sign-up, a membership application, a question about a gift or a plain message: its topic is
// chosen from the coming events that need a sign-up and the topics the block lists.
import type { Event as CalendarEvent } from '../../lib/cms-content'
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm; events: CalendarEvent[] }>()
const { settings, words } = await useAssociation()
const { coming } = useCalendar(() => props.events)
const form = props.form
const topic = useTopic()

const topics = computed(() => [
  ...coming.value.filter((e) => e.signup && placesLeft(e) !== 0).map((e) => signupTopic(e, words.value)),
  ...props.block.topics.map((t) => t.name).filter(Boolean),
])
// A visitor who pressed "Přihlásit se" on an event arrives with that event chosen; otherwise the first choice stands.
watch([topics, topic], ([list, chosen]) => {
  form.values.topic = list.includes(chosen) ? chosen : list.includes(form.values.topic) ? form.values.topic : (list[0] ?? '')
}, { immediate: true })

const field = (key: string) => form.fields.value.find((f) => f.key === key)
const where = computed(() => [settings.value?.address, settings.value?.directions].filter(Boolean).join('. '))
</script>

<template>
  <section :id="anchor" class="on-dark scroll-mt-6 bg-brand text-brand-ink" :class="first ? 'pb-20 pt-[calc(80px+5rem)] md:pb-24 md:pt-[calc(80px+6rem)]' : 'py-20 md:py-24'">
    <div class="wrap grid gap-x-12 gap-y-12 lg:grid-cols-12">
      <div class="lg:col-span-5">
        <component :is="first ? 'h1' : 'h2'" class="h2 !text-brand-ink"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[26rem] text-[1.1rem]">{{ tidy(block.text) }}</p>
        <dl class="mt-9 space-y-6">
          <div v-if="settings?.placeName || where"><dt class="serif text-[1.15rem] font-semibold italic">{{ words.meetLabel }}</dt><dd class="mt-1"><span v-if="settings?.placeName" class="serif block text-[1.6rem] font-bold leading-tight">{{ settings.placeName }}</span>{{ tidy(where) }}</dd></div>
          <div v-if="settings?.presence"><dt class="serif text-[1.15rem] font-semibold italic">{{ words.presenceLabel }}</dt><dd class="mt-1"><span class="serif lnum block text-[1.6rem] font-bold leading-tight">{{ settings.presence }}</span>{{ tidy(settings.presenceNote) }}</dd></div>
          <div v-if="settings?.email || settings?.phone"><dt class="serif text-[1.15rem] font-semibold italic">{{ words.reachLabel }}</dt><dd class="mt-1"><a v-if="settings.email" :href="`mailto:${settings.email}`" class="serif flex min-h-[44px] items-center break-all text-[1.6rem] font-bold leading-[1.2] hover:underline">{{ settings.email }}</a><a v-if="settings.phone" :href="telHref(settings.phone)" class="serif lnum flex min-h-[44px] items-center text-[1.6rem] font-bold leading-[1.2] hover:underline">{{ settings.phone }}</a></dd></div>
        </dl>
      </div>
      <div v-if="form.sent.value" class="rounded-[28px] bg-paper p-6 text-body sm:p-9 lg:col-span-7" role="status">
        <h3 class="text-[1.9rem]">{{ block.formHeading }}</h3>
        <p class="mt-3 text-[1.1rem] text-ink">{{ form.successMessage.value }}</p>
      </div>
      <form v-else-if="!form.unavailable.value" :ref="form.el" class="rounded-[28px] bg-paper p-6 text-body sm:p-9 lg:col-span-7" novalidate data-contact-form @submit.prevent="form.submit">
        <h3 class="text-[1.9rem]">{{ block.formHeading }}</h3>
        <p v-if="block.formText" class="mt-1">{{ tidy(block.formText) }}</p>
        <div class="mt-6 grid gap-5 sm:grid-cols-2">
          <label class="block"><span class="mb-1.5 block font-semibold text-ink">{{ field('name')?.label }}</span><input v-model="form.values.name" class="field" type="text" name="name" autocomplete="name" :required="field('name')?.required" :maxlength="field('name')?.max ?? undefined" :aria-invalid="!!form.errors.name"><span v-if="form.errors.name" class="field-error block">{{ form.errors.name }}</span></label>
          <label class="block"><span class="mb-1.5 block font-semibold text-ink">{{ field('contact')?.label }}</span><input v-model="form.values.contact" class="field" type="text" name="contact" autocomplete="email" :required="field('contact')?.required" :maxlength="field('contact')?.max ?? undefined" :aria-invalid="!!form.errors.contact"><span v-if="form.errors.contact" class="field-error block">{{ form.errors.contact }}</span></label>
          <label v-if="topics.length" class="block sm:col-span-2"><span class="mb-1.5 block font-semibold text-ink">{{ field('topic')?.label }}</span>
            <select v-model="form.values.topic" class="field" name="topic">
              <option v-for="t in topics" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
          <label class="block sm:col-span-2"><span class="mb-1.5 block font-semibold text-ink">{{ field('message')?.label }}</span><textarea v-model="form.values.message" class="field" name="message" rows="4" :placeholder="field('message')?.help ?? undefined" :maxlength="field('message')?.max ?? undefined" :aria-invalid="!!form.errors.message" /><span v-if="form.errors.message" class="field-error block">{{ form.errors.message }}</span></label>
        </div>
        <KitFormExtras :form="form" />
        <p v-if="form.failure.value" class="field-error mt-4" role="alert">{{ form.failure.value }}</p>
        <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button class="btn !bg-brand !text-brand-ink hover:!bg-ink" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }}</button>
          <p v-if="block.formNote" class="max-w-[21rem] text-[0.92rem]">{{ tidy(block.formNote) }}</p>
        </div>
      </form>
    </div>
  </section>
</template>
