<script setup lang="ts">
// Po slunci's surroundings: the minutes as round stops on a dotted path (the walk in yellow, the
// car outlined), and two photographs laid in one frame of fixed shape: a rounded rectangle with a
// circle over its corner.
import type { Place } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'surroundings'>; first?: boolean; anchor?: string; places: Place[] }>()
const w = useSiteWords().value.poSlunci
const walk = computed(() => props.places.filter((p) => p.mode === 'walk'))
const car = computed(() => props.places.filter((p) => p.mode === 'car'))
const photos = computed(() => props.block.photos.filter((p) => p.image).slice(0, 2))
</script>

<template>
  <section :id="anchor" class="wrap sec scroll-mt-4">
    <div class="grid lg:grid-cols-12 gap-x-12 gap-y-10 items-start">
      <div :class="photos.length ? 'lg:col-span-7 lg:order-2' : 'lg:col-span-12'">
        <p v-if="block.eyebrow" class="eyebrow">{{ block.eyebrow }}</p>
        <component :is="first ? 'h1' : 'h2'" class="h2">{{ block.heading }}</component>
        <p v-if="block.text" class="lead mt-5">{{ tidyText(block.text) }}</p>

        <template v-if="walk.length">
          <h3 class="gap-head font-sans! text-[0.9rem] font-semibold text-quiet">{{ w.walk }}</h3>
          <ul class="stops sm:grid-cols-6! mt-4">
            <li v-for="p in walk" :key="p.id" class="stop"><i><b class="num">{{ p.minutes }}</b><small>{{ w.min }}</small></i><p>{{ p.name }}</p></li>
          </ul>
        </template>
        <template v-if="car.length">
          <h3 class="font-sans! text-[0.9rem] font-semibold text-quiet" :class="walk.length ? 'mt-9' : 'gap-head'">{{ w.car }}</h3>
          <ul class="stops stops-car grid-cols-4! sm:grid-cols-6! mt-4">
            <li v-for="p in car" :key="p.id" class="stop"><i><b class="num">{{ p.minutes }}</b><small>{{ w.min }}</small></i><p>{{ p.name }}</p></li>
          </ul>
        </template>
        <p v-if="block.note" class="mt-5 text-[0.94rem] text-quiet">{{ tidyText(block.note) }}</p>
      </div>
      <!-- two photographs in one frame of a fixed shape -->
      <div v-if="photos.length" class="lg:col-span-5 lg:order-1 relative aspect-[10/9] lg:aspect-[10/11] w-full max-lg:max-w-[32rem] max-lg:mx-auto">
        <div class="absolute left-0 top-0 w-[84%] h-[76%]"><CmsImage :media="photos[0]!.image!" class="photo" sizes="(min-width: 1024px) 28rem, 90vw" /></div>
        <div v-if="photos[1]" class="absolute right-0 bottom-0 w-[50%] aspect-square rounded-full overflow-hidden" style="box-shadow:0 0 0 8px var(--paper)"><CmsImage :media="photos[1].image!" class="w-full h-full object-cover" sizes="(min-width: 1024px) 18rem, 50vw" /></div>
      </div>
    </div>
  </section>
</template>
