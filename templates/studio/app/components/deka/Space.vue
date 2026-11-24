<script setup lang="ts">
// Deka's space: a strip of the blanket, then the text and a list of the rooms with a colour for
// each on the left, three photographs on the right.
defineProps<{ block: BlockOf<'space'>; first?: boolean; anchor?: string }>()
// The colours of the rows: the kinds' threads in turn, leaving out the fourth.
const rowThread = (i: number) => `th${[1, 2, 3, 5, 4][i % 5]}`
</script>

<template>
  <section :id="anchor">
    <div class="stripes" aria-hidden="true" />
    <div class="wrap pt-16 md:pt-24">
      <div class="grid lg:grid-cols-12 gap-x-10 gap-y-10 items-start">
        <div class="lg:col-span-5 lg:pt-6">
          <p v-if="block.eyebrow" class="eyebrow mb-3">{{ block.eyebrow }}</p>
          <component :is="first ? 'h1' : 'h2'" class="h2"><KitMarked :text="block.heading" /></component>
          <p v-for="(p, i) in paragraphs(block.text)" :key="i" :class="i ? 'mt-4' : 'mt-5'">{{ tidyText(p) }}</p>
          <dl v-if="block.facts.length" class="mt-8 text-[0.975rem]">
            <div v-for="(fact, i) in block.facts" :key="fact.id" class="flex items-baseline justify-between gap-4 py-3 border-[var(--rule)]" :class="i === block.facts.length - 1 ? 'border-y' : 'border-t'">
              <dt class="flex items-center gap-3 text-ink font-semibold"><span class="sw" :class="rowThread(i)" />{{ fact.label }}</dt><dd>{{ fact.value }}</dd>
            </div>
          </dl>
        </div>
        <div v-if="spacePhotos(block).length" class="lg:col-span-7 grid grid-cols-12 gap-3 md:gap-4">
          <div class="ph col-span-12 aspect-[16/9]"><CmsImage :media="spacePhotos(block)[0]!.image" sizes="(min-width: 1024px) 45rem, 100vw" /></div>
          <div v-if="spacePhotos(block)[1]" class="ph col-span-7 aspect-[4/3]"><CmsImage :media="spacePhotos(block)[1]!.image" sizes="(min-width: 1024px) 26rem, 58vw" /></div>
          <div v-if="spacePhotos(block)[2]" class="ph col-span-5 aspect-auto"><CmsImage :media="spacePhotos(block)[2]!.image" sizes="(min-width: 1024px) 19rem, 42vw" class="object-[38%_50%]" /></div>
        </div>
      </div>
    </div>
  </section>
</template>
