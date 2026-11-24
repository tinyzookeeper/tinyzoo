<script setup lang="ts">
// Šanony's contact, on the brand colour: the address as the headline with the way there in three
// big figures, a photograph of the house and the hours in heavy type, and the enquiry form on
// a paper card.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words, address, phone } = await useOffice()
const groups = computed(() => hoursGroups(settings.value?.hours))
// (the first three figures; the headline's size steps down for a longer address)
const route = computed(() => props.block.route.slice(0, 3))
const size = computed(() => byLength(props.block.heading, [
  [24, 'text-[46px] sm:text-[72px] xl:text-[92px]'],
  [40, 'text-[38px] sm:text-[54px] xl:text-[64px]'],
], 'text-[30px] sm:text-[40px] xl:text-[48px]'))
const form = props.form
</script>

<template>
  <section :id="anchor" class="on-dark bg-brand text-brand-ink">
    <div class="wrap grid gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-28">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="kicker">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="display" :class="[size, block.eyebrow ? 'mt-4' : '']"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-soft' }" /></component>
        <ul v-if="route.length" class="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-3">
          <li v-for="r in route" :key="r.id" class="border-t-4 border-brand-ink pt-4"><p class="display text-[44px]">{{ r.figure }}</p><p class="mt-2 text-[15.5px] leading-[1.45]">{{ tidyText(r.text) }}</p></li>
        </ul>
        <div class="mt-10 grid gap-8 sm:grid-cols-[1fr_1fr]">
          <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1280px) 28rem, (min-width: 640px) 40vw, 100vw" class="aspect-[4/3] w-full object-cover" />
          <div>
            <h3 class="kicker border-b-2 border-brand-ink pb-2">{{ words.officeHours }}</h3>
            <dl v-if="groups.length" class="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 font-display text-[21px] font-bold tracking-[-0.01em]">
              <template v-for="g in groups" :key="g.days.join()"><dt>{{ groupLabel(g, words) }}</dt><dd>{{ hoursSpan(g) }}</dd></template>
            </dl>
            <p v-if="block.hoursNote" class="mt-3 text-[15px] leading-[1.5]">{{ tidyText(block.hoursNote) }}</p>
            <p v-if="address || settings?.email" class="mt-5 text-[15px] leading-[1.5]">
              <template v-if="address">{{ address }}</template><template v-if="address && settings?.email"><br></template><a v-if="settings?.email" class="underline decoration-brand-ink/50 underline-offset-4 hover:decoration-brand-ink" :href="`mailto:${settings.email}`">{{ settings.email }}</a>
            </p>
            <a v-if="phone" :href="phone.href" class="mt-2 block font-display text-[30px] font-extrabold tracking-[-0.02em] hover:underline hover:underline-offset-4">{{ phone.text }}</a>
          </div>
        </div>
      </div>

      <div class="self-start bg-paper p-6 text-ink sm:p-8 lg:col-span-5">
        <h3 v-if="block.formHeading" class="font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.025em]">{{ block.formHeading }}</h3>
        <p v-if="block.text" class="mt-2 text-[15.5px] leading-[1.5]">{{ tidyText(block.text) }}</p>
        <p v-if="form.sent.value" class="mt-6 text-[16.5px] font-semibold leading-[1.5]" role="status">{{ form.successMessage.value }}</p>
        <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate data-enquiry @submit.prevent="form.submit">
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <EnquiryFields :form="form" label-class="mb-1.5 block text-[14px] font-bold" />
          </div>
          <button type="submit" class="btn btn-ink mt-6 w-full" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></button>
          <p v-if="block.consent" class="mt-4 text-[13.5px] leading-[1.5]">{{ block.consent }}</p>
        </form>
      </div>
    </div>
  </section>
</template>
