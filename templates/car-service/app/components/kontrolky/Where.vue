<script setup lang="ts">
// Kontrolky's "where": turn-by-turn directions with distances instead of a map, a photograph of
// the yard, the week's hours as a table (today lit in the brand colour) and the address.
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, week, today, words } = await useGarage()
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
</script>

<template>
  <section :id="anchor" class="wrap py-16 lg:py-28 scroll-mt-2">
    <p v-if="block.eyebrow" class="cap">{{ block.eyebrow }}</p>
    <component :is="first ? 'h1' : 'h2'" class="mt-3 text-[38px] sm:text-[50px] max-w-[14em]">{{ plainEmphasis(block.heading) }}</component>
    <div class="mt-12 grid lg:grid-cols-12 gap-x-14 gap-y-12">
      <div class="lg:col-span-7">
        <ol v-if="block.turns.length" class="text-[18px]">
          <li v-for="(t, i) in block.turns" :key="t.id" class="flex items-center gap-5 py-5 border-t border-line" :class="i === block.turns.length - 1 ? 'border-b text-brand' : ''">
            <UIcon :name="TURN_ICONS[t.icon ?? 'arrow-up']" class="size-[30px] flex-none" :class="i === block.turns.length - 1 ? '' : 'text-quiet'" aria-hidden="true" />
            <span class="flex-1 leading-snug" :class="i === block.turns.length - 1 ? 'font-medium' : ''">{{ t.text }}</span>
            <span v-if="t.distance" class="dig text-[22px] font-semibold whitespace-nowrap">{{ t.distance }}</span>
          </li>
        </ol>
        <p v-if="block.keys || block.transit" class="mt-6 text-[16px] text-quiet max-w-[38em]">{{ tidyText([block.keys, block.transit].filter(Boolean).join(' ')) }}</p>
        <CmsImage v-if="block.photo" :media="block.photo" sizes="(min-width: 1024px) 44rem, 100vw" class="mt-10 w-full aspect-[16/9] object-cover rounded-[22px]" />
      </div>
      <div class="lg:col-span-5">
        <h3 class="text-[26px]">{{ words.hoursHeading.kontrolky }}</h3>
        <table class="mt-4 w-full text-[18px]">
          <tbody>
            <tr v-for="(h, i) in week" :key="i" :class="h && today.weekday === i ? 'text-brand' : [i ? 'border-t border-line' : '', h ? '' : 'text-quiet']">
              <th scope="row" class="text-left py-3" :class="h && today.weekday === i ? 'font-medium' : 'font-normal'">{{ cap(words.weekdays[i]!) }}<span v-if="h && today.weekday === i" class="text-[14px] ml-1.5"> {{ words.todayBadge }}</span></th>
              <td v-if="h" class="dig text-right text-[20px] py-3" :class="today.weekday === i ? 'font-semibold' : ''">{{ h.from }}–{{ h.to }}</td>
              <td v-else class="text-right py-3">{{ words.closed }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="block.hoursNote" class="mt-4 text-[15.5px] text-quiet">{{ tidyText(block.hoursNote) }}</p>
        <h3 class="mt-11 text-[26px]">{{ words.addressHeading }}</h3>
        <p class="mt-3 leading-[1.65]">{{ settings?.siteName }}<br>{{ [settings?.street, [settings?.zip, settings?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') }}<template v-if="settings?.email"><br><a :href="`mailto:${settings.email}`" class="underline underline-offset-4 hover:text-brand">{{ settings.email }}</a></template></p>
      </div>
    </div>
  </section>
</template>
