<script setup lang="ts">
// Lhůty's contact: an invitation, the enquiry form on a white card, a photograph of the house, the
// office hours drawn as bars on a 7 to 18 hours scale, and the address with the way there as a
// table of distances.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words, address, phone } = await useOffice()
const days = computed(() => hoursDays(settings.value?.hours))
const form = props.form
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24">
    <div class="grid gap-12 lg:grid-cols-12">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label text-quiet"><span class="ticks" />{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] leading-[1.15] sm:text-[42px]" :class="block.eyebrow ? 'mt-5' : ''"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="mt-5 max-w-[46ch] text-[16.5px] leading-[1.6] text-ink/85">{{ tidyText(block.text) }}</p>
        <div class="mt-8 border-t border-ink bg-card p-6 sm:p-8">
          <p v-if="form.sent.value" class="text-[16.5px] leading-[1.6]" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" novalidate data-enquiry @submit.prevent="form.submit">
            <div class="grid gap-5 sm:grid-cols-2">
              <EnquiryFields :form="form" label-class="mb-1.5 block text-[14px] font-medium" />
            </div>
            <button type="submit" class="btn btn-brand mt-6 w-full justify-center sm:w-auto" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" class="size-[1em]" aria-hidden="true" /></button>
            <p v-if="block.consent" class="mt-4 text-[13.5px] leading-[1.5] text-quiet">{{ block.consent }}</p>
          </form>
        </div>
      </div>

      <div class="lg:col-span-7">
        <CmsImage v-if="block.image" :media="block.image" sizes="(min-width: 1280px) 45rem, (min-width: 1024px) 55vw, 100vw" class="aspect-[16/9] w-full object-cover" />
        <div class="grid gap-10 sm:grid-cols-2" :class="block.image ? 'mt-8' : ''">
          <div>
            <h3 class="label border-b border-ink pb-3">{{ words.officeHours }}</h3>
            <div v-if="days.length" class="mt-4 space-y-2.5 text-[14px]" role="list">
              <div v-for="d in days" :key="d.day" class="hours-row" role="listitem"><span class="font-medium">{{ words.dayShort[d.day] }}</span><span class="hours-track" aria-hidden="true"><span class="hours-bar" :style="hoursBar(d)" /></span><span class="num text-[13px]">{{ hoursSpan(d) }}</span></div>
              <div class="hours-row text-quiet" aria-hidden="true"><span /><span class="num flex justify-between text-[11px]"><span>7</span><span>18 {{ words.hoursUnit }}</span></span><span /></div>
            </div>
            <p v-if="block.hoursNote || phone || settings?.email" class="mt-4 text-[14.5px] leading-[1.55] text-ink/85">
              <template v-if="block.hoursNote">{{ tidyText(block.hoursNote) }}</template><template v-if="phone">{{ ' ' }}{{ words.officePhoneIs }} <a class="ulink num" :href="phone.href">{{ phone.text }}</a></template><template v-if="settings?.email"><template v-if="phone">, </template><template v-else>{{ ' ' }}</template>{{ words.emailWord }} <a class="ulink" :href="`mailto:${settings.email}`">{{ settings.email }}</a></template>.
            </p>
          </div>
          <div>
            <h3 class="label border-b border-ink pb-3">{{ words.findUs }}</h3>
            <address class="mt-4 text-[17px] not-italic leading-[1.5]"><span class="font-semibold">{{ address }}</span><template v-if="settings?.addressNote"><br>{{ settings.addressNote }}</template></address>
            <dl v-if="block.route.length" class="mt-5 text-[14.5px] leading-[1.5]">
              <div v-for="(r, i) in block.route" :key="r.id" class="grid grid-cols-[5.2rem_1fr] gap-3 border-line py-2.5" :class="i === block.route.length - 1 ? 'border-y' : 'border-t'"><dt class="num text-signal-text">{{ r.figure }}</dt><dd>{{ tidyText(r.text) }}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
