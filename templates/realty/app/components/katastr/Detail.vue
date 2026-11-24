<script setup lang="ts">
// Katastr's detail: the photographs (one large, two small) beside the record of the property:
// state, title, place, a serif price and a ruled table of parameters, the agent and two buttons.
// On the property's own page (`page`) the photographs are all there, and the page's heading is the title.
import type { Listing } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'detail'>; first?: boolean; anchor?: string; listing: Listing | null; page?: boolean }>()
const { words } = await useOffice()
const w = words.value.katastr
const l = computed(() => props.listing)
const photos = computed(() => (l.value ? (props.page ? l.value.photos.slice(0, 3) : detailPhotos(l.value)) : []))
const rest = computed(() => (props.page && l.value ? l.value.photos.slice(3) : []))
const rows = computed(() => (l.value ? paramRows(l.value, words.value) : []))
const stateLine = computed(() => (l.value ? [l.value.state !== 'none' ? words.value.state[l.value.state] : '', words.value.deal[l.value.deal]].filter(Boolean).join(' · ') : ''))
const place = computed(() => (l.value ? [placeOf(l.value), l.value.street].filter(Boolean).join(', ') : ''))
const agent = computed(() => l.value?.agent ?? null)
const contactTo = `/#${words.value.anchors.contact}`
</script>

<template>
  <section v-if="l" :id="anchor" class="bg-card border-y border-line" :class="page ? '' : 'mt-20 md:mt-28'">
    <div class="wrap" :class="page ? 'py-12 md:py-16' : 'py-16 md:py-24'">
      <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10">
        <div class="lg:col-span-7">
          <p v-if="block.eyebrow" class="label text-brand">{{ block.eyebrow }}</p>
          <div v-if="photos[0]" class="aspect-[3/2] bg-tint overflow-hidden" :class="block.eyebrow ? 'mt-5' : ''"><CmsImage :media="photos[0]" :eager="page" sizes="(min-width: 1024px) 44rem, 100vw" class="w-full h-full object-cover" /></div>
          <div v-if="photos.length > 1" class="mt-3 grid grid-cols-2 gap-3">
            <div v-for="p in photos.slice(1)" :key="p.id" class="aspect-[3/2] bg-tint overflow-hidden"><CmsImage :media="p" sizes="(min-width: 1024px) 22rem, 50vw" class="w-full h-full object-cover" /></div>
          </div>
          <p v-if="!page && (block.caption || block.moreLabel)" class="mt-3 flex justify-between gap-6 text-[0.9rem] text-quiet"><span>{{ tidyText(block.caption) }}</span><NuxtLink v-if="block.moreLabel" class="text-ink underline underline-offset-4 decoration-line hover:text-brand hover:decoration-brand transition-colors" :to="`/nabidka/${l.slug}`">{{ tidyText(block.moreLabel) }}</NuxtLink></p>
          <div v-if="l.summary" class="mt-7 max-w-[40rem] text-[1.05rem] leading-[1.7] space-y-4">
            <p v-for="(p, i) in paragraphs(l.summary)" :key="i">{{ tidyText(p) }}</p>
          </div>
        </div>
        <div class="lg:col-span-5">
          <p class="flex items-center justify-between label text-quiet"><span class="inline-flex items-center gap-2 text-ink"><span class="w-[0.45rem] h-[0.45rem] rounded-full bg-accent" />{{ stateLine }}</span><span v-if="l.code" class="num">{{ w.no(l.code) }}</span></p>
          <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2rem] md:text-[2.4rem] leading-[1.12]">{{ tidyText(l.title) }}</component>
          <p class="mt-2 flex items-center gap-1.5"><UIcon name="i-lucide-map-pin" class="ic text-quiet" aria-hidden="true" />{{ place }}</p>
          <p class="mt-6 serif text-ink text-[2.4rem] leading-none num">{{ priceKc(l.price) }}</p>
          <p v-if="l.priceNote" class="mt-2 text-[0.92rem] text-quiet">{{ tidyText(l.priceNote) }}</p>

          <dl class="params mt-7 text-[0.97rem]">
            <div v-for="r in rows" :key="r.label"><dt>{{ r.label }}</dt><dd :class="{ num: /\d/.test(r.value) }">{{ tidyText(r.value) }}</dd></div>
          </dl>

          <div class="mt-8 pt-6 border-t border-line flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div v-if="agent">
              <p class="label text-quiet">{{ w.sells[l.deal] }}</p>
              <p class="mt-1 serif text-ink text-[1.3rem] leading-tight">{{ agent.name }}</p>
              <a v-if="agent.phone" class="rowlink num -mb-2" :href="telHref(agent.phone)"><UIcon name="i-lucide-phone" class="ic" aria-hidden="true" />{{ agent.phone }}</a>
            </div>
            <div class="flex flex-wrap gap-3">
              <NuxtLink class="btn" :to="contactTo">{{ w.book }}</NuxtLink>
              <NuxtLink v-if="!page" class="btn btn-line" :to="`/nabidka/${l.slug}`">{{ w.fullDetail }}</NuxtLink>
            </div>
          </div>
          <p v-if="l.viewings" class="mt-4 text-[0.92rem] text-quiet">{{ tidyText(w.viewings(l.viewings)) }}</p>
        </div>
      </div>
      <div v-if="rest.length" class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="p in rest" :key="p.id" class="aspect-[3/2] bg-tint overflow-hidden"><CmsImage :media="p" sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw" class="w-full h-full object-cover" /></div>
      </div>
    </div>
  </section>
</template>
