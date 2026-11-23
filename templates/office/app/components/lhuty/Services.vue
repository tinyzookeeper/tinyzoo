<script setup lang="ts">
// Lhůty's price list: three groups, each a name and a note on the left and a table of services
// with figures in mono on the right, between rules.
import type { Service, ServiceGroup } from '~/lib/cms-content'

const props = defineProps<{ block: BlockOf<'services'>; first?: boolean; anchor?: string; groups: ServiceGroup[]; services: Service[] }>()
const grouped = computed(() => groupServices(props.groups, props.services))
// A row's rules by its place in the group: a line under all but the last.
const rowClass = (i: number, n: number) => (n === 1 ? '' : i === 0 ? 'border-b border-line pb-5' : i === n - 1 ? 'pt-5' : 'border-b border-line py-5')
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-24">
    <div class="grid gap-6 lg:grid-cols-12 lg:gap-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="label text-quiet"><span class="ticks" />{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="font-display text-[32px] leading-[1.15] sm:text-[42px]" :class="block.eyebrow ? 'mt-5' : ''"><KitMarked :text="block.heading" /></component>
      </div>
      <p v-if="block.text" class="max-w-[52ch] self-end text-[16.5px] leading-[1.6] text-ink/85 lg:col-span-5">{{ tidyText(block.text) }}</p>
    </div>

    <div class="mt-12 border-t border-ink">
      <div v-for="g in grouped" :key="g.group.id" class="grid gap-x-12 gap-y-4 border-b border-ink py-7 lg:grid-cols-12">
        <div class="lg:col-span-3">
          <h3 class="font-display text-[24px] leading-tight">{{ tidyText(g.group.name) }}</h3>
          <p v-if="g.group.note" class="mt-2 text-[14.5px] leading-[1.5] text-quiet">{{ tidyText(g.group.note) }}</p>
        </div>
        <dl class="lg:col-span-9">
          <div v-for="(s, i) in g.items" :key="s.id" class="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-[1fr_auto]" :class="rowClass(i, g.items.length)">
            <div>
              <dt class="text-[18px] font-semibold">{{ tidyText(s.name) }}</dt>
              <dd v-if="s.text" class="mt-1 max-w-[60ch] text-[15.5px] leading-[1.55] text-ink/85">{{ tidyText(s.text) }}</dd>
            </div>
            <dd class="num text-[17px] sm:text-right">
              <span class="font-medium">{{ tidyText(s.price) }}</span>
              <span v-if="s.priceNote" class="block text-[13px] text-quiet">{{ tidyText(s.priceNote) }}</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
