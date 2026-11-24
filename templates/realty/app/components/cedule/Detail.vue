<script setup lang="ts">
// Cedule's detail: a tinted band between two rules. The title set huge beside the price, a
// mosaic of photographs (one large, two small, the second stamped with how many more there
// are), the parameters in a mono table and a black box with the agent's phone set large.
// On the property's own page (`page`) every photograph is there and the title is the page's heading.
import type { Listing } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'detail'>; first?: boolean; anchor?: string; listing: Listing | null; page?: boolean }>()
const { words } = await useOffice()
const w = words.value.cedule
const l = computed(() => props.listing)
const photos = computed(() => (l.value ? (props.page ? l.value.photos.slice(0, 3) : detailPhotos(l.value)) : []))
const rest = computed(() => (props.page && l.value ? l.value.photos.slice(3) : []))
const rows = computed(() => (l.value ? paramRows(l.value, words.value, { usable: w.usable }) : []))
const place = computed(() => (l.value ? [placeOf(l.value), l.value.street].filter(Boolean).join(', ') : ''))
const kindLine = computed(() => (l.value ? [words.value.deal[l.value.deal], words.value.kind[l.value.kind], l.value.code && w.no(l.value.code)].filter(Boolean).join(w.sep) : ''))
const agent = computed(() => l.value?.agent ?? null)
const contactTo = `/#${words.value.anchors.contact}`
</script>

<template>
  <section v-if="l" :id="anchor" class="bg-tint border-y-2 border-ink" :class="page ? '' : 'mt-14 md:mt-20'">
    <div class="wrap py-12 md:py-20">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-6 items-end">
        <div class="lg:col-span-8">
          <p class="mono caps flex flex-wrap gap-x-3 items-center"><span v-if="l.state !== 'none'" class="bg-brand text-brand-ink px-2 py-1 font-semibold border-2 border-ink">{{ words.state[l.state] }}</span><span>{{ kindLine }}</span></p>
          <component :is="first ? 'h1' : 'h2'" class="mt-5 text-[2.5rem] md:text-[4.2rem] tracking-[-0.045em] leading-[0.92]">{{ tidyText(l.title) }}</component>
          <p class="mt-4 text-[1.1rem] font-medium flex items-center gap-2"><UIcon name="i-lucide-map-pin" class="ic" aria-hidden="true" />{{ place }}</p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <p class="font-extrabold text-[2.6rem] md:text-[3.4rem] leading-none tracking-[-0.05em] num">{{ priceKc(l.price) }}</p>
          <p v-if="l.priceNote" class="mt-2 mono caps text-quiet">{{ tidyText(l.priceNote.replace(/\.$/, '')) }}</p>
        </div>
      </div>

      <div v-if="photos.length" class="mt-8 grid md:grid-cols-3 gap-2">
        <div class="aspect-[3/2] bg-paper overflow-hidden border-2 border-ink" :class="photos.length > 1 ? 'md:col-span-2' : 'md:col-span-3'"><CmsImage :media="photos[0]!" :eager="page" sizes="(min-width: 768px) 60vw, 100vw" class="w-full h-full object-cover" /></div>
        <div v-if="photos.length > 1" class="grid grid-cols-2 md:grid-cols-1 gap-2">
          <div v-for="(p, i) in photos.slice(1)" :key="p.id" class="relative aspect-[3/2] md:aspect-auto bg-paper overflow-hidden border-2 border-ink">
            <CmsImage :media="p" sizes="(min-width: 768px) 30vw, 50vw" class="w-full h-full object-cover" />
            <span v-if="!page && block.badge && i === 1" class="absolute right-0 bottom-0 bg-ink text-paper mono caps px-2.5 py-1.5">{{ block.badge }}</span>
          </div>
        </div>
      </div>
      <div v-if="rest.length" class="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <div v-for="p in rest" :key="p.id" class="aspect-[3/2] bg-paper overflow-hidden border-2 border-ink"><CmsImage :media="p" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw" class="w-full h-full object-cover" /></div>
      </div>

      <div class="mt-10 grid lg:grid-cols-12 gap-x-10 gap-y-10">
        <dl class="params lg:col-span-5">
          <div v-for="r in rows" :key="r.label"><dt>{{ r.label }}</dt><dd :class="{ num: /\d/.test(r.value) }">{{ tidyText(r.value) }}</dd></div>
        </dl>
        <div class="lg:col-span-4">
          <div v-if="l.summary" class="text-[1.05rem] leading-[1.6] space-y-4">
            <p v-for="(p, i) in paragraphs(l.summary)" :key="i">{{ tidyText(p) }}</p>
          </div>
          <NuxtLink v-if="!page && block.moreLabel" class="btn btn-ghost mt-6" :to="`/nabidka/${l.slug}`">{{ block.moreLabel }} <UIcon name="i-lucide-arrow-right" class="ic size-4" aria-hidden="true" /></NuxtLink>
        </div>
        <div class="on-dark lg:col-span-3 bg-ink text-paper p-6 flex flex-col">
          <template v-if="agent">
            <p class="mono caps text-spark">{{ w.sells[l.deal] }}</p>
            <p class="mt-2 font-extrabold text-[1.5rem] leading-[1.05] tracking-[-0.03em]">{{ agent.name }}</p>
            <a v-if="agent.phone" class="mt-3 inline-flex items-center min-h-[44px] font-extrabold text-[1.9rem] lg:text-[1.45rem] xl:text-[1.9rem] leading-none tracking-[-0.04em] num whitespace-nowrap text-spark hover:text-paper transition-colors" :href="telHref(agent.phone)">{{ agent.phone }}</a>
          </template>
          <p v-if="l.viewings" class="mt-3 mono">{{ tidyText(w.viewings(l.viewings)) }}</p>
          <NuxtLink class="btn btn-brand mt-6 lg:mt-auto" :to="contactTo">{{ w.book }}</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
