<script setup lang="ts">
// The map of the district: the town of the agency in the middle, two rings (10 and 25 km),
// four rivers and a few towns for orientation, all fixed; the towns the agency works in are
// its own (the block's list): lit where something is on offer, hollow where it takes a
// property on by arrangement. Drawn on a grid of 520 × 500 points.
const props = defineProps<{ towns: BlockOf<'areas'>['towns'] }>()
const words = useSiteWords()
const m = words.value.katastr.map

type Town = BlockOf<'areas'>['towns'][number]
/** Where a town's name stands: its own place, else right of the dot. */
function labelOf(t: Town) {
  const r = t.kind === 'main' ? 6.5 : t.kind === 'request' ? 4.2 : 4.8
  const x = t.labelX ?? (t.x ?? 0) + (t.kind === 'main' ? 18 : r + 5)
  const y = t.labelY ?? (t.y ?? 0) + (t.kind === 'main' ? 8 : 5)
  return { x, y, anchor: t.labelX == null ? 'start' : t.anchor ?? 'start' }
}
/** A long name stands on two lines: "Albrechtice" over "nad Vltavou". */
const lines = (name: string): string[] => {
  const words = name.split(' ')
  return words.length >= 3 ? [words[0]!, words.slice(1).join(' ')] : [name]
}
const placed = computed(() => props.towns.filter((t) => t.x != null && t.y != null).map((t) => ({ t, label: labelOf(t), lines: lines(t.name) })))
const main = computed(() => placed.value.filter((p) => p.t.kind === 'main'))
const on = computed(() => placed.value.filter((p) => p.t.kind === 'offer'))
const off = computed(() => placed.value.filter((p) => p.t.kind === 'request'))
</script>

<template>
  <svg class="map w-full max-w-[34rem] mx-auto" viewBox="0 0 520 500" role="img" :aria-label="m.label">
    <defs>
      <clipPath id="map-clip"><rect width="520" height="500" /></clipPath>
      <path id="map-otava" d="M-6 319C28 318 62 303 97 309S142 297 163 303S197 311 213 304S234 302 240 292S243 271 250 262S252 240 256 228S264 204 260 190S262 162 277 136" />
      <path id="map-vltava" d="M433 506C436 474 424 446 427 410S430 362 421 346S398 332 384 322S368 302 360 290S344 258 337 242S332 222 325 211S302 184 296 168S288 144 277 136S262 108 264 86S270 40 284-6" />
      <path id="map-blanice" d="M197 506C200 472 212 452 232 442S262 434 268 416S298 384 296 368S272 350 252 340S241 322 241 310S242 298 240 292" />
      <path id="map-lomnice" d="M-6 141C24 152 58 146 85 153S140 162 181 149S224 150 238 161S252 174 259 177" />
    </defs>
    <g clip-path="url(#map-clip)">
      <!-- 10 and 25 km from the square -->
      <g class="ring"><circle cx="250" cy="262" r="86" /><circle cx="250" cy="262" r="215" /></g>
      <g class="river">
        <use href="#map-lomnice" stroke-width="1.3" />
        <use href="#map-blanice" stroke-width="1.5" />
        <use href="#map-otava" stroke-width="2.4" />
        <use href="#map-vltava" stroke-width="3.6" />
      </g>
      <text class="water" dy="-6"><textPath href="#map-otava" startOffset="4%">{{ m.rivers.otava }}</textPath></text>
      <text class="water" dy="-7"><textPath href="#map-vltava" startOffset="8%">{{ m.rivers.vltava }}</textPath></text>
      <text class="water sm" dy="-5"><textPath href="#map-blanice" startOffset="45%">{{ m.rivers.blanice }}</textPath></text>
      <text class="water sm" dy="-5"><textPath href="#map-lomnice" startOffset="3%">{{ m.rivers.lomnice }}</textPath></text>
      <text class="scale" x="164" y="266" text-anchor="middle">10 km</text>
      <text class="scale" x="35" y="266" text-anchor="middle">25 km</text>
      <!-- places for orientation -->
      <g class="refpt"><circle cx="97" cy="309" r="3" /><circle cx="85" cy="153" r="3" /><circle cx="421" cy="346" r="3" /><circle cx="279" cy="134" r="3" /></g>
      <template v-for="(r, i) in m.refs" :key="i">
        <text v-for="(line, j) in r.lines" :key="j" class="ref" :x="r.x" :y="r.y + j * 15" :text-anchor="r.anchor">{{ line }}</text>
      </template>
      <!-- towns where something is on offer now -->
      <circle v-for="p in main" :key="`ring-${p.t.id}`" class="on-ring" :cx="p.t.x!" :cy="p.t.y!" r="11" />
      <g class="on">
        <circle v-for="p in main" :key="p.t.id" :cx="p.t.x!" :cy="p.t.y!" r="6.5" />
        <circle v-for="p in on" :key="p.t.id" :cx="p.t.x!" :cy="p.t.y!" r="4.8" />
      </g>
      <!-- towns the agency takes on by arrangement -->
      <g class="off"><circle v-for="p in off" :key="p.t.id" :cx="p.t.x!" :cy="p.t.y!" r="4.2" /></g>
      <template v-for="p in placed" :key="`name-${p.t.id}`">
        <text v-for="(line, j) in p.lines" :key="j" :class="p.t.kind === 'main' ? 'town-main' : undefined" :x="p.label.x" :y="p.label.y + j * 17" :text-anchor="p.label.anchor">{{ line }}</text>
      </template>
      <!-- key -->
      <circle class="on" cx="30" cy="463.5" r="4.8" />
      <text class="scale" x="42" y="468">{{ m.keyOffer }}</text>
      <circle class="off" cx="30" cy="481.5" r="4.2" />
      <text class="scale" x="42" y="486">{{ m.keyRequest }}</text>
      <!-- north -->
      <g class="north" transform="translate(486 48)"><path d="M0 18V-14" /><path d="M0-16L-4.5-4H4.5Z" style="fill:var(--ink)" /></g>
      <text class="scale" x="486" y="24" text-anchor="middle">{{ m.north }}</text>
    </g>
    <rect class="frame" x=".5" y=".5" width="519" height="499" />
  </svg>
</template>
