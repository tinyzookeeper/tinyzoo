<script setup lang="ts">
// Rozsvíceno's detail: one large rounded panel. The photographs (one wide, two beside each
// other under it) on the left; on the right "house of the week", the title, the place, the
// price in the lamp colour, the parameters as tiles and a pill with the agent and a phone button.
// On the property's own page (`page`) every photograph is there and the title is the page's heading.
import type { Listing } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'detail'>; first?: boolean; anchor?: string; listing: Listing | null; page?: boolean }>()
const { words } = await useOffice()
const w = words.value.rozsviceno
const l = computed(() => props.listing)
const photos = computed(() => (l.value ? (props.page ? l.value.photos.slice(0, 3) : detailPhotos(l.value)) : []))
const rest = computed(() => (props.page && l.value ? l.value.photos.slice(3) : []))
const rows = computed(() => (l.value ? paramRows(l.value, words.value, { landApart: true }) : []))
const place = computed(() => (l.value ? [placeOf(l.value), l.value.street].filter(Boolean).join(', ') : ''))
const agent = computed(() => l.value?.agent ?? null)
</script>

<template>
  <section v-if="l" :id="anchor" class="wrap" :class="page ? 'pt-10 md:pt-16' : 'pt-20 md:pt-32'">
    <div class="rounded-[2rem] bg-surface shadow-[inset_0_0_0_1px_var(--line)] p-4 md:p-8 lg:p-10 grid lg:grid-cols-12 gap-x-10 gap-y-8">
      <div class="lg:col-span-7 grid grid-cols-5 gap-3 content-start">
        <div v-if="photos[0]" class="col-span-5 aspect-[3/2] lg:aspect-[4/3] rounded-[1.3rem] overflow-hidden bg-raised"><CmsImage :media="photos[0]" :eager="page" sizes="(min-width: 1024px) 40rem, 100vw" class="w-full h-full object-cover" /></div>
        <div v-if="photos[1]" class="col-span-3 aspect-[3/2] lg:aspect-[4/3] rounded-[1.3rem] overflow-hidden bg-raised"><CmsImage :media="photos[1]" sizes="(min-width: 1024px) 24rem, 60vw" class="w-full h-full object-cover" /></div>
        <div v-if="photos[2]" class="col-span-2 rounded-[1.3rem] overflow-hidden bg-raised relative"><CmsImage :media="photos[2]" sizes="(min-width: 1024px) 16rem, 40vw" class="absolute inset-0 w-full h-full object-cover" :style="{ objectPosition: '78% 50%' }" /></div>
        <p v-if="!page && block.caption" class="col-span-5 px-1 text-[0.92rem] text-quiet">{{ tidyText(block.caption) }}</p>
        <template v-if="rest.length">
          <div v-for="p in rest" :key="p.id" class="col-span-5 sm:col-span-5 aspect-[3/2] rounded-[1.3rem] overflow-hidden bg-raised"><CmsImage :media="p" sizes="(min-width: 1024px) 40rem, 100vw" class="w-full h-full object-cover" /></div>
        </template>
      </div>
      <div class="lg:col-span-5 px-2 md:px-0 pb-2 md:pb-0">
        <p v-if="block.eyebrow" class="hand text-[1.2rem]">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-2 text-[2rem] md:text-[2.6rem]">{{ tidyText(l.title) }}</component>
        <p class="mt-3 flex items-center gap-1.5 text-quiet"><UIcon name="i-lucide-map-pin" class="ic" aria-hidden="true" />{{ place }}</p>
        <p class="mt-5 fig text-[2.4rem] md:text-[2.8rem] leading-none text-lamp">{{ priceKc(l.price) }} <span v-if="l.deal === 'rent'" class="font-sans font-normal text-[1rem] text-quiet">{{ w.perMonth }}</span></p>
        <p v-if="l.priceNote" class="mt-2 text-[0.92rem] text-quiet">{{ tidyText(l.priceNote) }}</p>
        <div v-if="l.summary" class="mt-6 space-y-4">
          <p v-for="(p, i) in paragraphs(l.summary)" :key="i">{{ tidyText(p) }}</p>
        </div>
        <dl class="tiles mt-6 text-[0.97rem]">
          <div v-for="r in rows" :key="r.label"><dt>{{ r.label }}</dt><dd>{{ tidyText(r.value) }}</dd></div>
        </dl>
        <div v-if="agent" class="mt-6 p-2 pl-5 rounded-[1.4rem] sm:rounded-full bg-night flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p class="text-[0.97rem] py-2"><span class="text-quiet">{{ w.sells[l.deal] }}</span> <strong class="font-semibold">{{ agent.name }}</strong></p>
          <a v-if="agent.phone" class="btn min-h-[46px] px-5" :href="telHref(agent.phone)"><UIcon name="i-lucide-phone" class="size-4" aria-hidden="true" />{{ agent.phone }}</a>
        </div>
        <p v-if="l.viewings || !page" class="mt-4 text-[0.92rem] text-quiet"><template v-if="l.viewings">{{ tidyText(w.viewings(l.viewings)) }} </template><NuxtLink v-if="!page && block.moreLabel" class="text-cream underline decoration-lamp decoration-2 underline-offset-4 hover:text-lamp transition-colors" :to="`/nabidka/${l.slug}`">{{ block.moreLabel }}</NuxtLink></p>
      </div>
    </div>
  </section>
</template>
