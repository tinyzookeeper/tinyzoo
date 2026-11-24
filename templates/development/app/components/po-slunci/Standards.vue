<script setup lang="ts">
// Po slunci's standards: two rounded photographs side by side, then every standard with its icon
// in a yellow circle, four to a row, and the closing line on a soft rounded strip.
import type { Standard } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'standards'>; first?: boolean; anchor?: string; standards: Standard[] }>()
const photos = computed(() => props.block.photos.filter((p) => p.image).slice(0, 2))
const list = computed(() => props.standards.filter((s) => !s.closing))
const closing = computed(() => props.standards.filter((s) => s.closing))
</script>

<template>
  <section :id="anchor" class="wrap sec scroll-mt-4">
    <div class="head">
      <div>
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
      </div>
      <p v-if="block.text" class="lead">{{ tidyText(block.text) }}</p>
    </div>
    <div v-if="photos.length" class="gap-head grid grid-cols-3 lg:grid-cols-12 gap-3 lg:gap-5">
      <figure v-for="(p, i) in photos" :key="i" class="relative col-span-3 aspect-[3/2] lg:aspect-auto lg:h-[30rem]" :class="photos.length === 1 ? 'lg:col-span-12' : i === 0 ? 'lg:col-span-8' : 'lg:col-span-4'">
        <CmsImage :media="p.image!" class="photo" :sizes="photos.length === 1 ? '(min-width: 1024px) 76rem, 100vw' : i === 0 ? '(min-width: 1024px) 50rem, 100vw' : '(min-width: 1024px) 26rem, 100vw'" /><figcaption v-if="p.caption" class="pill-cap">{{ p.caption }}</figcaption>
      </figure>
    </div>
    <dl class="gap-head grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-9">
      <div v-for="s in list" :key="s.id">
        <dt class="flex items-center gap-3 serif text-[1.4rem]"><span class="w-11 h-11 rounded-full bg-sun flex items-center justify-center flex-none"><UIcon :name="STANDARD_ICONS[s.icon]" class="size-5" aria-hidden="true" /></span>{{ s.title }}</dt>
        <dd class="mt-3 text-[0.96rem] text-quiet">{{ tidyText(s.text) }}</dd>
      </div>
    </dl>
    <p v-for="s in closing" :key="s.id" class="mt-9 rounded-2xl bg-soft px-6 py-4 text-[0.96rem]"><strong class="font-semibold">{{ s.title }}:</strong> {{ tidyText(s.text) }}</p>
  </section>
</template>
