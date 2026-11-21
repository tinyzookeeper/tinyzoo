<script setup lang="ts">
import type { Incident } from '#keeper/types/keeper'

// A site's incidents, next to its Uptime card: newest first, one still going on top in the error
// tone. Simple says the cause in words (the raw cause on hover), Detailed shows it as recorded.
// Nothing to show: a small cream moment.
//
// On wide screens the Uptime card sets the row's height and this card fills exactly that: it takes
// no height of its own (contain: size), shows the newest incidents that fit whole, and ends with
// "All N incidents", which opens the full list in place: it scrolls inside the same height, so the
// two cards stay level. On phones it takes its own height and shows the newest 5.
const props = defineProps<{ incidents: Incident[]; simple: boolean }>()
const now = useNow()

const PHONE = 5
const items = computed(() => [...props.incidents].sort((a, b) => Number(!b.endedAt) - Number(!a.endedAt) || b.startedAt.localeCompare(a.startedAt)))
const expanded = ref(false)
watch(() => props.incidents.length, (n) => { if (n <= PHONE) expanded.value = false })

// Wide: the card follows the Uptime card's height (Tailwind's lg).
const wide = ref(false)
let mq: MediaQueryList | undefined
const onMq = () => { wide.value = !!mq?.matches }
const follow = computed(() => wide.value && !expanded.value)
/** Wide and opened: every incident, scrolling inside the Uptime card's height. */
const scrolls = computed(() => wide.value && expanded.value)

const shown = computed(() => (expanded.value ? items.value : follow.value ? items.value.slice(0, 50) : items.value.slice(0, PHONE)))
/** How many rows fit whole (wide, measured); null before the first measure. */
const fit = ref<number | null>(null)
const visible = computed(() => (follow.value ? Math.min(fit.value ?? shown.value.length, shown.value.length) : shown.value.length))
const hidden = computed(() => items.value.length - visible.value)

const box = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)
const more = ref<HTMLElement | null>(null)
function measure() {
  if (!follow.value || !box.value || !list.value) return
  const avail = box.value.clientHeight
  // Where each row's text ends (its bottom padding is only air before the next row).
  const bottoms = [...list.value.children].map((el) => {
    const li = el as HTMLElement
    return li.offsetTop + li.offsetHeight - (Number.parseFloat(getComputedStyle(li).paddingBottom) || 0)
  })
  if ((bottoms.at(-1) ?? 0) <= avail + 0.5 && bottoms.length === items.value.length) {
    fit.value = bottoms.length
    return
  }
  const room = avail - (more.value?.offsetHeight || 34)
  fit.value = Math.max(1, bottoms.filter((b) => b <= room + 0.5).length)
}

let ro: ResizeObserver | undefined
onMounted(() => {
  mq = window.matchMedia('(min-width: 64rem)')
  onMq()
  mq.addEventListener('change', onMq)
  ro = new ResizeObserver(() => measure())
  watch(box, (el, old) => {
    if (old) ro?.unobserve(old)
    if (el) ro?.observe(el)
  }, { immediate: true })
})
onBeforeUnmount(() => {
  mq?.removeEventListener('change', onMq)
  ro?.disconnect()
})
watch([follow, () => props.incidents, () => props.simple], () => nextTick(measure), { deep: true })

function toggle() {
  expanded.value = !expanded.value
  if (!expanded.value && box.value) box.value.scrollTop = 0
}
const lasted = (i: Incident) => minutesInWords((i.endedAt ? Date.parse(i.endedAt) : now.value) - Date.parse(i.startedAt))
</script>

<template>
  <section class="flex min-w-0 flex-col" :class="wide ? 'lg:[contain:size]' : ''" aria-labelledby="incidents-heading">
    <header class="mb-2 flex min-h-6 items-center gap-2">
      <h2 id="incidents-heading" class="k-label">Incidents</h2>
    </header>

    <div v-if="!items.length" class="k-moment flex flex-1 flex-col justify-center gap-2.5 border border-(--k-moment-line) p-[18px]">
      <span class="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] border border-(--k-moment-line) bg-(--k-surface)">
        <UIcon name="i-lucide-shield-check" class="size-[17px] text-(--k-up)" />
      </span>
      <div>
        <p class="font-display text-[0.9375rem] font-bold text-highlighted">Nothing to report</p>
        <p class="k-moment__muted mt-0.5 text-[0.8125rem]">The site answered every check in the last 30 days.</p>
      </div>
    </div>

    <div v-else class="k-card flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      <div ref="box" class="relative min-h-0 flex-1" :class="follow ? 'overflow-hidden' : scrolls ? 'overflow-y-auto overscroll-contain' : ''">
        <ul ref="list" class="flex flex-col">
          <li
            v-for="(i, k) in shown" :key="i.id"
            class="grid gap-px border-t border-(--ui-border-muted) py-2.5 first:border-t-0 first:pt-0" :class="k >= visible ? 'invisible' : ''" :aria-hidden="k >= visible || undefined"
          >
            <p class="font-display text-sm font-semibold" :class="i.endedAt ? 'text-highlighted' : 'text-error'">
              Down for {{ lasted(i) }}<template v-if="!i.endedAt">, still going</template>
            </p>
            <p class="text-[0.78125rem] text-muted tabular"><ClientOnly>{{ incidentWhen(i.startedAt, now) }}<template #fallback>&nbsp;</template></ClientOnly></p>
            <p v-if="simple" class="mt-0.5 text-[0.8125rem] text-toned" :title="i.cause || undefined">{{ causeInWords(i.cause) }}</p>
            <p v-else class="mt-0.5 truncate font-mono text-xs text-toned" :title="i.cause">{{ i.cause || 'unknown' }}</p>
          </li>
        </ul>
        <div v-if="hidden > 0 || expanded" ref="more" :class="follow ? 'absolute inset-x-0 bottom-0 bg-(--k-surface) pt-2.5' : scrolls ? 'sticky bottom-0 border-t border-(--ui-border-muted) bg-(--k-surface) pt-2.5 pb-1' : 'pt-3'">
          <button
            type="button" :aria-expanded="expanded"
            class="rounded-sm text-[0.8125rem] font-medium text-highlighted hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-primary)"
            @click="toggle"
          >
            {{ expanded ? 'Show fewer' : `All ${items.length} incidents →` }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
