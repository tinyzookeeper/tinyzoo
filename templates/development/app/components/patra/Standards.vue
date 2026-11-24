<script setup lang="ts">
// Patra's standards: a soft band across the page, the heading and a photograph on the left, the
// standards as ruled pairs of columns on the right, and the closing one as a single line under
// them.
import type { Standard } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'standards'>; first?: boolean; anchor?: string; standards: Standard[] }>()
const photo = computed(() => props.block.photos.find((p) => p.image) ?? null)
const list = computed(() => props.standards.filter((s) => !s.closing))
const closing = computed(() => props.standards.filter((s) => s.closing))
</script>

<template>
  <section :id="anchor" class="mt-24 lg:mt-32 bg-soft scroll-mt-2">
    <div class="wrap py-20 lg:py-28 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3">{{ block.heading }}</component>
        <p v-if="block.text" class="lead mt-5">{{ tidyText(block.text) }}</p>
        <figure v-if="photo" class="mt-9">
          <div class="aspect-[4/3]"><CmsImage :media="photo.image!" class="photo" sizes="(min-width: 1024px) 34rem, 100vw" /></div>
          <figcaption v-if="photo.caption" class="cap">{{ photo.caption }}</figcaption>
        </figure>
      </div>
      <div class="lg:col-span-6 lg:col-start-7">
        <dl class="grid sm:grid-cols-2 gap-x-10">
          <div v-for="s in list" :key="s.id" class="py-5 border-t border-line">
            <dt class="font-medium text-[1.05rem]">{{ s.title }}<template v-if="s.note">{{ ' ' }}<span class="font-light text-quiet">· {{ s.note }}</span></template></dt>
            <dd class="mt-1.5 text-[0.96rem] text-quiet">{{ tidyText(s.text) }}</dd>
          </div>
        </dl>
        <p v-for="s in closing" :key="s.id" class="py-5 border-t border-line text-[0.96rem] text-quiet"><strong class="text-ink">{{ s.title }}.</strong> {{ tidyText(s.text) }}</p>
      </div>
    </div>
  </section>
</template>
