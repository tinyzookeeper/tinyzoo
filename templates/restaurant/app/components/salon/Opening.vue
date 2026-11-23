<script setup lang="ts">
// Salon's opening: a wide framed photograph with the title card laid over its lower edge, and
// under it one line of three facts: open now, where, how to book.
defineProps<{ block: BlockOf<'opening'>; first?: boolean; anchor?: string; from?: number | null }>()
const { address, phone, tel, words, state, openText } = await useRestaurant()
const open = computed(() => openText(words.value.salon.open))
const to = (section: 'lunch' | 'hours' | 'reservation') => `/#${anchorOf(section)}`
</script>

<template>
  <section :id="anchor" class="wrap pt-3 lg:pt-4">
    <figure v-if="block.image" class="frame">
      <CmsImage :media="block.image" eager sizes="(min-width: 1240px) 1200px, 100vw" class="w-full aspect-[4/3] md:aspect-[21/9] object-cover" />
    </figure>
    <div class="sheet relative mx-3 sm:mx-auto max-w-[840px] px-7 py-11 md:px-20 md:py-16 text-center" :class="block.image ? '-mt-12 md:-mt-32' : 'mt-6'">
      <p v-if="block.eyebrow" class="label ink-muted">{{ block.eyebrow }}</p>
      <component :is="first ? 'h1' : 'h2'" class="mt-5 font-display font-medium text-[2.6rem] leading-[1.05] md:text-[4.4rem] md:leading-[1.02] tracking-[-.015em]"><KitMarked :text="block.heading" :attrs="{ class: 'block font-normal' }" /></component>
      <div class="orn mt-6"><i /></div>
      <p v-if="block.text" class="mt-6 mx-auto max-w-[34rem] text-[1.12rem]">{{ tidyText(block.text) }}</p>
      <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-x-8 gap-y-4">
        <NuxtLink v-if="block.primaryLabel && block.primaryUrl" class="btn btn-ink w-full sm:w-auto" :to="siteHref(block.primaryUrl)">{{ block.primaryLabel }}</NuxtLink>
        <NuxtLink v-if="block.secondaryLabel && block.secondaryUrl" class="link text-[1.08rem] py-2" :to="siteHref(block.secondaryUrl)">{{ block.secondaryLabel }}</NuxtLink>
      </div>
    </div>

    <dl class="mt-10 md:mt-14 grid md:grid-cols-3 border-y border-line md:divide-x divide-line max-md:divide-y">
      <div v-if="open" class="py-6 md:py-8 md:pr-8">
        <dt class="label text-brand">{{ words.salon.openLabel }}</dt>
        <dd class="mt-3 text-[1.35rem] leading-snug" data-open :data-state="state?.open ? 'open' : 'closed'"><span data-open-text>{{ open }}</span></dd>
        <dd v-if="block.openNote || block.openLinkLabel" class="mt-1 text-quiet">{{ block.openNote }} <NuxtLink v-if="block.openLinkLabel" class="link" :to="to('hours')">{{ block.openLinkLabel }}</NuxtLink></dd>
      </div>
      <div v-if="address" class="py-6 md:py-8 md:px-8">
        <dt class="label text-brand">{{ words.salon.whereLabel }}</dt>
        <dd class="mt-3 text-[1.35rem] leading-snug">{{ address }}</dd>
        <dd v-if="block.whereNote || block.whereLinkLabel" class="mt-1 text-quiet">{{ tidyText(block.whereNote) }} <NuxtLink v-if="block.whereLinkLabel" class="link" :to="to('hours')">{{ tidyText(block.whereLinkLabel) }}</NuxtLink></dd>
      </div>
      <div v-if="phone" class="py-6 md:py-8 md:pl-8">
        <dt class="label text-brand">{{ words.salon.bookLabel }}</dt>
        <dd class="mt-3 text-[1.35rem] leading-snug"><a class="link" :href="tel">{{ phone }}</a></dd>
        <dd v-if="block.bookNote || block.bookLinkLabel" class="mt-1 text-quiet">{{ block.bookNote }} <NuxtLink v-if="block.bookLinkLabel" class="link" :to="to('reservation')">{{ block.bookLinkLabel }}</NuxtLink></dd>
      </div>
    </dl>
  </section>
</template>
