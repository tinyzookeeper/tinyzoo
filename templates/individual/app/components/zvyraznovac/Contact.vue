<script setup lang="ts">
// Zvýrazňovač's contact: on black, the heading at poster size in the brand colour, the phone
// number in display type and the form with outlined fields.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'contact'>; first?: boolean; anchor?: string; form: SiteForm }>()
const { settings, words } = await useProfile()
const form = props.form
const size = computed(() => byLength(props.block.heading, [
  [18, 'text-[3.4rem] sm:text-[4.5rem] md:text-[6rem] lg:text-[8.4vw] 2xl:text-[7.6rem]'],
  [40, 'text-[2.6rem] sm:text-[3.4rem] md:text-[4.4rem] lg:text-[5.6vw] 2xl:text-[5.4rem]'],
], 'text-[2.2rem] sm:text-[3rem] md:text-[3.6rem] lg:text-[4.4vw] 2xl:text-[4.2rem]'))
</script>

<template>
  <section :id="anchor" class="bg-ink text-paper on-ink">
    <div class="wrap py-20 lg:py-28">
      <component :is="first ? 'h1' : 'h2'" class="text-brand leading-[0.92] tracking-[-0.05em]" :class="size"><KitMarked :text="block.heading" plain /></component>
      <div class="mt-10 lg:mt-14 grid lg:grid-cols-12 gap-x-10 gap-y-12">
        <div class="lg:col-span-5">
          <p v-if="block.text" class="text-[1.2rem] lg:text-[1.35rem] leading-[1.4] font-medium max-w-[30rem]">{{ czText(block.text) }}</p>
          <dl class="mt-10 border-b-2 border-paper/30">
            <div v-if="settings?.phone" class="py-5 border-t-2 border-paper/30">
              <dt class="mono opacity-75">{{ words.phone }}<template v-if="settings.phoneHours"> · {{ czText(settings.phoneHours) }}</template></dt>
              <dd><a class="inline-flex min-h-[48px] items-center font-black text-[2.2rem] lg:text-[2.8rem] tracking-[-0.045em] leading-none hover:text-brand transition-colors" :href="telHref(settings.phone)">{{ tidyText(settings.phone) }}</a></dd>
            </div>
            <div v-if="settings?.email" class="py-5 border-t-2 border-paper/30">
              <dt class="mono opacity-75"><span class="whitespace-nowrap">{{ words.email }}</span></dt>
              <dd><a class="inline-flex min-h-[48px] items-center font-extrabold text-[1.3rem] lg:text-[1.6rem] tracking-[-0.03em] hover:text-brand transition-colors break-all" :href="`mailto:${settings.email}`">{{ settings.email }}</a></dd>
            </div>
            <div v-if="settings?.address" class="py-5 border-t-2 border-paper/30">
              <dt class="mono opacity-75">{{ words.personally }}<template v-if="settings.addressNote"> · {{ czText(settings.addressNote) }}</template></dt>
              <dd class="font-extrabold text-[1.3rem] lg:text-[1.6rem] tracking-[-0.03em] mt-2">{{ tidyText(settings.address) }}</dd>
            </div>
          </dl>
        </div>

        <div class="lg:col-span-6 lg:col-start-7">
          <p v-if="form.sent.value" class="font-extrabold text-[1.6rem] lg:text-[2rem] tracking-[-0.03em] leading-[1.15]" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" class="relative grid gap-6 content-start" novalidate @submit.prevent="form.submit">
            <ContactFields :form="form" :block="block" label-class="mono" />
            <div class="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              <button class="btn btn-brand" type="submit" :disabled="form.sending.value">{{ form.sending.value ? words.sending : form.submitLabel.value }} <UIcon name="i-lucide-arrow-right" aria-hidden="true" /></button>
              <p v-if="block.note" class="mono opacity-75">{{ czText(block.note) }}</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
