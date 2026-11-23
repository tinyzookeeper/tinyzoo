<script setup lang="ts">
// Patra's developer: who builds with a photograph of a finished building, and the finished
// buildings as ruled rows with the year in the brand colour.
import type { Reference } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'developer'>; first?: boolean; anchor?: string; references: Reference[] }>()
</script>

<template>
  <section :id="anchor" class="wrap pt-24 lg:pt-32 scroll-mt-2">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10">
      <div class="lg:col-span-6">
        <p v-if="block.eyebrow" class="label">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2 mt-3">{{ block.heading }}</component>
        <p v-if="block.text" class="lead mt-5">{{ tidyText(block.text) }}</p>
        <figure v-if="block.image" class="mt-9">
          <div class="aspect-[3/2]"><CmsImage :media="block.image" class="photo" sizes="(min-width: 1024px) 38rem, 100vw" /></div>
          <figcaption v-if="block.imageCaption" class="cap">{{ block.imageCaption }}</figcaption>
        </figure>
      </div>
      <div class="lg:col-span-5 lg:col-start-8 lg:self-end">
        <table v-if="references.length" class="w-full">
          <caption class="label text-left pb-3 border-b border-line">{{ block.listLabel }}</caption>
          <tbody>
            <tr v-for="r in references" :key="r.id" class="border-b border-line">
              <td class="serif text-[2rem] text-brand py-4 pr-6 num w-[6.5rem]">{{ r.year }}</td>
              <th scope="row" class="text-left font-medium py-4">{{ r.name }}<span v-if="r.size" class="block font-light text-quiet text-[0.94rem]">{{ r.size }}</span></th>
            </tr>
          </tbody>
        </table>
        <p v-if="block.note" class="mt-5 text-[0.94rem] text-quiet">{{ tidyText(block.note) }}</p>
      </div>
    </div>
  </section>
</template>
