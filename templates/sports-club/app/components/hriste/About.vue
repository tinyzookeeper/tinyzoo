<script setup lang="ts">
// Hřiště's club page: the photograph of the ground with its caption beside the story and three
// figures in soft tiles; under them the ground as a list of facts and the committee.
import type { Committee } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'about'>; first?: boolean; anchor?: string; committee: Committee[] }>()
const { settings, words } = await useClub()
const rows = computed(() => [
  ...(settings.value?.address ? [{ label: words.value.address, value: settings.value.address }] : []),
  ...props.block.groundFacts,
])
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-4 py-16 lg:py-28">
    <div class="grid items-center gap-x-12 gap-y-7 lg:grid-cols-12">
      <figure v-if="block.image" class="lg:col-span-7">
        <div class="photo"><CmsImage :media="block.image" sizes="(min-width: 1024px) 45rem, 100vw" class="aspect-[3/2] w-full object-cover lg:aspect-[16/10]" /></div>
        <figcaption v-if="block.imageCaption" class="mt-3 text-[14.5px] text-quiet">{{ tidyText(block.imageCaption) }}</figcaption>
      </figure>
      <div :class="block.image ? 'lg:col-span-5' : 'lg:col-span-12'">
        <component :is="first ? 'h1' : 'h2'" class="disp h2"><span class="slash" aria-hidden="true" /><KitMarked :text="block.heading" plain /></component>
        <p v-if="block.text" class="mt-5 text-[18px] text-quiet">{{ tidyText(block.text) }}</p>
        <dl v-if="block.facts.length" class="mt-7 grid grid-cols-3 gap-3">
          <div v-for="f in block.facts" :key="f.id" class="flex flex-col-reverse justify-end rounded-2xl bg-tint px-4 py-4"><dt class="mt-1.5 text-[14px] leading-tight text-quiet">{{ f.label }}</dt><dd class="num text-[30px] lg:text-[36px]">{{ f.value }}</dd></div>
        </dl>
      </div>
    </div>
    <div class="mt-14 grid gap-x-16 gap-y-12 lg:mt-20 lg:grid-cols-2">
      <div>
        <h3 class="disp text-[26px] lg:text-[30px]">{{ block.groundHeading || settings?.groundName }}</h3>
        <dl v-if="rows.length" class="mt-4 border-t border-line text-[16.5px]">
          <div v-for="r in rows" :key="r.label" class="flex items-baseline justify-between gap-6 border-b border-line py-3"><dt class="text-quiet">{{ r.label }}</dt><dd class="text-right font-semibold">{{ r.value }}</dd></div>
        </dl>
        <p v-if="!block.groundFacts.length && block.groundText" class="mt-4 text-quiet">{{ tidyText(block.groundText) }}</p>
        <a v-if="settings?.mapUrl" class="btn btn-soft mt-6" :href="settings.mapUrl" target="_blank" rel="noopener"><UIcon name="i-lucide-map-pin" class="text-lg" aria-hidden="true" />{{ words.openMap }}</a>
      </div>
      <div v-if="committee.length">
        <h3 class="disp text-[26px] lg:text-[30px]">{{ block.committeeHeading }}</h3>
        <ul class="mt-4 border-t border-line text-[16.5px]">
          <li v-for="c in committee" :key="c.id" class="flex flex-wrap items-center justify-between gap-x-6 border-b border-line py-2">
            <p class="py-1"><span class="block text-[14px] leading-tight text-quiet lowercase">{{ c.role }}</span><span class="font-semibold">{{ c.name }}</span></p>
            <a v-if="c.contact" class="link inline-flex min-h-11 items-center" :href="contactHref(c.contact)">{{ c.contact }}</a>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
