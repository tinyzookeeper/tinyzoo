<script setup lang="ts">
// Portál's last section: the week as rows with dotted leaders (today's in brass), the front of
// the shop, the address and the way there, and the street drawn as a row of houses with the
// shop's house filled in.
defineProps<{ block: BlockOf<'where'>; first?: boolean; anchor?: string }>()
const { settings, name, words, week, place } = await useShop()
const opening = useOpening(week)
</script>

<template>
  <section :id="anchor" class="wrap scroll-mt-6 py-20 md:py-28">
    <div class="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div class="lg:col-span-5">
        <p v-if="block.eyebrow" class="caps text-brass">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="mt-4 text-[2.2rem] md:text-[3.1rem]"><KitMarked :text="block.heading" /></component>
        <ul class="panel mt-8 p-3" data-hours>
          <li v-for="(day, i) in words.days" :key="i" class="day" :class="{ 'is-today': opening?.day === i }" :data-day="i">
            <span class="font-display text-[1.25rem] font-semibold">{{ day }}</span><span class="today-mark caps">{{ words.todayMark }}</span><span class="leader" /><span class="fig text-[1.2rem]">{{ dayText(week[i]!, words.closedDay) }}</span>
          </li>
        </ul>
        <p v-if="settings?.hoursNote" class="mt-4 text-[0.95rem] text-cream/75">{{ tidyText(settings.hoursNote) }}</p>
      </div>
      <div class="lg:col-span-7">
        <div v-if="block.image" class="frame"><CmsImage :media="block.image" sizes="(min-width: 1024px) 44rem, 100vw" class="aspect-[16/10] object-cover" /></div>
        <div class="mt-8 grid gap-8 sm:grid-cols-3">
          <div>
            <p class="caps text-brass">{{ words.address }}</p>
            <p class="mt-2 font-display text-[1.25rem] font-semibold leading-snug">{{ settings?.address }}<br>{{ [settings?.postalCode, settings?.town].filter(Boolean).join(' ') }}</p>
          </div>
          <div v-for="(w, i) in block.ways" :key="i">
            <p class="caps text-brass">{{ w.label }}</p>
            <p class="mt-2 text-[0.97rem] text-cream/85">{{ tidyText([w.title, w.text].filter(Boolean).join(' ')) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- the street, drawn: no map -->
    <figure class="mt-14 md:mt-20">
      <div class="overflow-hidden">
        <svg viewBox="0 0 1200 250" class="h-auto w-[52rem] max-w-none -translate-x-[13.5rem] sm:w-full sm:translate-x-0" role="img" :aria-label="words.sketch(name, place)">
          <g fill="none" stroke="currentColor" stroke-width="1.5" class="text-cream/45">
            <path d="M0 226h1200" />
            <path d="M40 226V96l75-46 75 46v130" /><path d="M70 120h28v38H70zM132 120h28v38h-28zM70 180h28v46H70zM132 180h28v32h-28z" />
            <path d="M190 226V78h170v148M182 78h186" /><path d="M214 102h26v40h-26zM262 102h26v40h-26zM310 102h26v40h-26zM214 172h50v54h-50zM288 172h48v40h-48z" />
            <path d="M360 226V110l65-34 65 34v116" /><path d="M386 128h26v34h-26zM438 128h26v34h-26zM386 184h26v42h-26zM438 184h26v28h-26z" />
            <path d="M700 226V88h150v138M692 88h166M716 88l14-30h90l14 30" /><path d="M724 110h26v38h-26zM762 110h26v38h-26zM800 110h26v38h-26zM724 176h40v50h-40zM786 176h40v36h-40z" />
            <path d="M850 226V104l70-40 70 40v122" /><path d="M878 124h26v36h-26zM936 124h26v36h-26zM878 182h26v44h-26zM936 182h26v30h-26z" />
            <path d="M990 226V84h170v142M982 84h186" /><path d="M1014 108h26v40h-26zM1062 108h26v40h-26zM1110 108h26v40h-26zM1014 176h50v50h-50zM1088 176h48v36h-48z" />
          </g>
          <g>
            <path d="M490 226V70h210v156z" fill="var(--cream)" />
            <path d="M480 70h230M500 70l18-34h154l18 34" fill="none" stroke="var(--cream)" stroke-width="1.5" />
            <path d="M518 92h30v44h-30zM566 92h30v44h-30zM614 92h30v44h-30zM652 92h30v44h-30z" fill="var(--wood)" />
            <path d="M506 160h178v66H506z" fill="var(--wood)" />
            <path d="M506 160h178v12H506z" fill="var(--brass)" />
            <path d="M518 182h92v36h-92zM626 182h44v44h-44z" fill="var(--cream)" opacity=".9" />
          </g>
        </svg>
      </div>
      <figcaption class="mt-5 grid gap-x-8 gap-y-2 border-t border-brass/35 pt-5 text-[0.95rem] sm:grid-cols-3">
        <p class="text-cream/80"><UIcon name="i-lucide-arrow-left" class="mr-2 align-[-2px] text-brass" aria-hidden="true" />{{ [block.landmark, block.walk].filter(Boolean).join(', ') }}</p>
        <p class="font-semibold sm:text-center">{{ [name, settings?.address, block.across].filter(Boolean).join(', ') }}</p>
        <p class="text-cream/80 sm:text-right">{{ [block.parking && `${words.parking} ${block.parking}`, block.parkingDistance].filter(Boolean).join(', ') }}<UIcon name="i-lucide-arrow-right" class="ml-2 align-[-2px] text-brass" aria-hidden="true" /></p>
      </figcaption>
    </figure>
  </section>
</template>
