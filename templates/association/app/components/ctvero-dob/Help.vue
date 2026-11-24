<script setup lang="ts">
// Čtvero dob's ways to help: three cards (by hand in straw, membership in young leaves, and the
// gift in the brand colour with the payment code and the account), then a strip of what a sum
// pays for and the note about the gift receipt.
import type { Person } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'help'>; first?: boolean; anchor?: string; people: Person[] }>()
const { settings, words } = await useAssociation()
const volunteer = computed(() => volunteerOf(props.people))
const receipt = computed(() => receiptParts(props.block.receipt, settings.value?.giftEmail))
</script>

<template>
  <section :id="anchor" class="scroll-mt-6" :class="first ? 'pb-20 pt-[calc(80px+5rem)] md:pb-24 md:pt-[calc(80px+6rem)]' : 'py-20 md:py-24'">
    <div class="wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end">
        <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="text-[1.1rem] lg:col-span-5">{{ tidy(block.text) }}</p>
      </div>

      <div class="mt-12 grid gap-6 lg:grid-cols-3">
        <article class="flex flex-col rounded-[28px] bg-leto p-4 sm:p-5">
          <CmsImage v-if="block.volunteerImage" :media="block.volunteerImage" sizes="(min-width: 1024px) 26rem, 100vw" class="aspect-[16/10] w-full rounded-[18px] object-cover" />
          <div class="flex grow flex-col px-2 pb-2 pt-5 sm:px-3">
            <p class="serif text-[1.15rem] font-semibold italic text-ink">{{ block.volunteerLabel }}</p>
            <h3 class="mt-1 text-[1.9rem]">{{ block.volunteerHeading }}</h3>
            <p class="mt-2 text-ink">{{ tidy(block.volunteerText) }}</p>
            <p v-if="volunteer" class="mt-auto pt-5 font-semibold text-ink">{{ volunteer.name }}<template v-if="volunteer.phone"><br><a class="serif lnum text-[1.6rem] font-bold underline decoration-2 underline-offset-4" :href="telHref(volunteer.phone)">{{ volunteer.phone }}</a></template></p>
          </div>
        </article>
        <article class="flex flex-col rounded-[28px] bg-jaro p-6 sm:p-8">
          <p class="serif text-[1.15rem] font-semibold italic text-ink">{{ block.memberLabel }}</p>
          <h3 class="mt-1 text-[1.9rem]">{{ block.memberHeading }}</h3>
          <p class="serif lnum mt-6 text-[clamp(3.6rem,6vw,5rem)] font-extrabold leading-[0.85] tracking-[-0.02em] text-ink">{{ tidy(block.memberAmount) }}</p>
          <p v-if="block.memberUnit" class="serif mt-2 text-[1.25rem] font-semibold italic text-ink">{{ block.memberUnit }}</p>
          <p class="mt-5 text-ink">{{ tidy(block.memberText) }}</p>
          <p v-if="block.memberNote" class="mt-3 text-ink">{{ tidy(block.memberNote) }}</p>
          <p v-if="block.memberButtonLabel && block.memberButtonUrl" class="mt-auto pt-6"><NuxtLink :to="siteHref(block.memberButtonUrl)" class="btn">{{ block.memberButtonLabel }}</NuxtLink></p>
        </article>
        <!-- Giving -->
        <article :id="anchorOf('give')" class="on-dark flex scroll-mt-6 flex-col rounded-[28px] bg-brand p-6 text-brand-ink sm:p-8">
          <p class="serif text-[1.15rem] font-semibold italic">{{ block.giveLabel }}</p>
          <h3 class="mt-1 text-[1.9rem] !text-brand-ink">{{ block.giveHeading }}</h3>
          <div class="mt-6 flex items-start gap-5">
            <figure class="w-[132px] flex-none">
              <div class="rounded-[16px] bg-paper p-2.5">
                <CmsImage v-if="block.qrImage" :media="block.qrImage" sizes="8rem" class="block w-full" />
                <CtveroDobQrSample v-else :label="words.qrSample" />
              </div>
              <figcaption class="mt-2 text-[0.9rem] font-semibold">{{ words.qrPayment }}</figcaption>
            </figure>
            <p class="leading-snug">{{ tidy(block.giveText) }}</p>
          </div>
          <template v-if="settings?.account">
            <p class="mt-6 text-[0.9rem] font-semibold">{{ words.account }}</p>
            <p class="lnum text-[clamp(1.5rem,2.3vw,1.85rem)] font-bold leading-tight tracking-[-0.01em]">{{ settings.account }}</p>
          </template>
          <p v-if="block.accountNote" class="mt-3">{{ tidy(block.accountNote) }}<template v-if="settings?.accountUrl && block.accountLinkLabel">{{ ' ' }}<a class="u" :href="settings.accountUrl" target="_blank" rel="noopener">{{ block.accountLinkLabel }}</a></template></p>
        </article>
      </div>

      <!-- What a sum pays for -->
      <div v-if="block.sums.length || block.receipt" class="mt-6 rounded-[28px] bg-sand p-6 sm:p-8">
        <div v-if="block.sums.length" class="grid gap-x-10 gap-y-6 lg:grid-cols-12 lg:items-start">
          <h3 class="text-[1.7rem] lg:col-span-3"><KitMarked :text="block.sumsHeading" /></h3>
          <ul class="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-4">
            <li v-for="s in block.sums" :key="s.id"><p class="serif lnum text-[2.2rem] font-extrabold leading-none text-ink">{{ formatPrice(s.amount) }}&nbsp;{{ words.currency }}</p><p class="mt-2 border-t-2 border-ink pt-2 leading-snug text-ink">{{ tidy(s.text) }}</p></li>
          </ul>
        </div>
        <p v-if="block.receipt" class="flex gap-3 text-ink" :class="block.sums.length ? 'mt-7 border-t border-[var(--rule)] pt-5' : ''"><UIcon name="i-lucide-file-check" class="mt-1 size-[20px] flex-none" aria-hidden="true" /><span><template v-for="(r, i) in receipt" :key="i"><strong v-if="r.kind === 'bold'" class="font-semibold">{{ tidy(r.text) }}</strong><a v-else-if="r.kind === 'email'" class="u" :href="`mailto:${r.text}`">{{ r.text }}</a><template v-else>{{ tidy(r.text) }}</template></template></span></p>
      </div>
    </div>
  </section>
</template>
