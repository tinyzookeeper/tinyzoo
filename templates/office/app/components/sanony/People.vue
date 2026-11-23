<script setup lang="ts">
// Šanony's people, on black: every person a portrait with a spine beside it that carries the
// name, the role, a large direct phone number and the e-mail. A row to swipe on a phone; from xl
// up all of them stand side by side.
import type { Person } from '~/lib/cms-content'

defineProps<{ block: BlockOf<'people'>; first?: boolean; anchor?: string; items: Person[] }>()
</script>

<template>
  <section :id="anchor" class="on-dark bg-ink text-paper">
    <div class="wrap py-16 lg:py-28">
      <div class="grid items-end gap-6 lg:grid-cols-12 lg:gap-8">
        <component :is="first ? 'h1' : 'h2'" class="display lg:col-span-8" :class="displaySize(block.heading)"><KitMarked :text="block.heading" as="span" :attrs="{ class: 'text-soft' }" /></component>
        <p v-if="block.text" class="max-w-[44ch] text-[17px] leading-[1.55] text-paper/85 lg:col-span-4">{{ tidyText(block.text) }}</p>
      </div>

      <div v-if="items.length" class="-mx-5 mt-12 xl:mx-0 lg:mt-16">
        <UCarousel
          v-slot="{ item }" :items="items" align="start" contain-scroll="trimSnaps" drag-free
          :ui="{ viewport: 'px-5 xl:px-0', container: 'items-stretch -ms-4 xl:-ms-5', item: 'basis-[77%] max-w-[316px] ps-4 xl:max-w-none xl:basis-0 xl:grow xl:ps-5' }"
        >
          <div class="flex h-full flex-col" data-person>
            <div class="grid grid-cols-[42px_1fr]">
              <h3 class="namespine"><span>{{ item.name }}</span></h3>
              <CmsImage v-if="item.photo" :media="item.photo" sizes="(min-width: 1280px) 15rem, 16rem" class="aspect-[3/4] w-full object-cover" />
              <div v-else class="aspect-[3/4] w-full bg-paper/10" aria-hidden="true" />
            </div>
            <p v-if="item.role" class="kicker mt-4 text-[12px] text-soft">{{ item.role }}</p>
            <p v-if="item.text" class="mt-2 text-[15.5px] leading-[1.5] text-paper/85">{{ tidyText(item.text) }}</p>
            <a v-if="item.phone" :href="telHref(item.phone)" class="mt-auto block pt-4 font-display text-[24px] font-bold tracking-[-0.01em] hover:text-soft">{{ phoneText(item.phone) }}</a>
            <a v-if="item.email" :href="`mailto:${item.email}`" class="mt-1 inline-flex min-h-8 items-center self-start text-[14px] underline decoration-paper/40 underline-offset-4 hover:decoration-paper">{{ item.email }}</a>
          </div>
        </UCarousel>
      </div>
    </div>
  </section>
</template>
