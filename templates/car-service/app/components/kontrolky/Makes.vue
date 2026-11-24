<script setup lang="ts">
// Kontrolky's makes: the makes as text (a heading that is the same as the first group's makes is
// written once), and "what we do not do" as a list with red crosses under hairlines.
const props = defineProps<{ block: BlockOf<'makes'>; first?: boolean; anchor?: string }>()
const asHeading = (names: string) => plainEmphasis(props.block.heading).trim() === names.trim()
</script>

<template>
  <section :id="anchor" class="blk-makes scroll-mt-2">
    <div class="wrap grid lg:grid-cols-12 gap-x-14 gap-y-12">
      <div class="lg:col-span-7">
        <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[38px] sm:text-[50px]">{{ plainEmphasis(block.heading) }}</component>
        <template v-for="(g, i) in block.groups" :key="g.id">
          <p v-if="!asHeading(g.names)" class="dig font-medium text-[23px] sm:text-[26px] leading-[1.35]" :class="i === 0 ? 'mt-5' : 'mt-10'">{{ g.names }}</p>
          <p v-if="g.text" class="text-quiet max-w-[34em]" :class="asHeading(g.names) ? 'mt-5' : 'mt-3'">{{ tidyText(g.text) }}</p>
        </template>
      </div>
      <div v-if="block.notDoing.length" class="lg:col-span-5">
        <h3 v-if="block.notHeading" class="text-[26px]">{{ block.notHeading }}</h3>
        <ul class="mt-5 text-[16.5px] leading-snug">
          <li v-for="n in block.notDoing" :key="n.id" class="flex gap-3.5 py-4 border-t border-line">
            <UIcon name="i-lucide-x" class="text-signal-red size-5 flex-none mt-0.5" aria-hidden="true" />
            <span>{{ tidyText(n.text) }}<template v-if="n.note">{{ ' ' }}<span class="text-quiet">{{ tidyText(n.note) }}</span></template></span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
