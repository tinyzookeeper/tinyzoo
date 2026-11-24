<script setup lang="ts">
// Modrotisk's developer: who builds, the finished buildings as a ruled table (year, name, size),
// and a photograph of one of them in its print frame.
import type { Reference } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'developer'>; first?: boolean; index?: number; anchor?: string; references: Reference[] }>()
const caption = computed(() => captionPair(props.block.imageCaption))
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-4">
    <p class="label sheet"><b>{{ sectionNo(index) }}</b> {{ block.eyebrow }}</p>
    <div class="mt-8 grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div :class="block.image ? 'lg:col-span-6' : 'lg:col-span-12'">
        <component :is="first ? 'h1' : 'h2'" class="text-[2.5rem] lg:text-[3.6rem]">{{ block.heading }}</component>
        <p v-if="block.text" class="mt-6 text-quiet max-w-[34rem]">{{ tidyText(block.text) }}</p>
        <table v-if="references.length" class="mt-9 w-full num border-t border-ink">
          <caption class="sr-only">{{ block.listLabel }}</caption>
          <tbody>
            <tr v-for="r in references" :key="r.id" class="border-b" style="border-color:var(--line-soft)">
              <td class="py-3.5 pr-4 text-quiet w-16">{{ r.year }}</td><th scope="row" class="py-3.5 pr-4 text-left font-medium">{{ r.name }}</th><td class="py-3.5 text-right text-quiet whitespace-nowrap">{{ r.size }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="block.note" class="mt-5 text-[0.94rem] text-quiet">{{ tidyText(block.note) }}</p>
      </div>
      <figure v-if="block.image" class="lg:col-span-6">
        <div class="frame aspect-[3/2]"><CmsImage :media="block.image" sizes="(min-width: 1024px) 40rem, 100vw" /></div>
        <figcaption v-if="caption[0]" class="cap"><span>{{ caption[0] }}</span><span>{{ caption[1] }}</span></figcaption>
      </figure>
    </div>
  </section>
</template>
