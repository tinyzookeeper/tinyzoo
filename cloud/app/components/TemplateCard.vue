<script setup lang="ts">
import { pictureLooks, pictureOf, type TemplateDef } from '#shared/templates'

// One template in the gallery: the real first screen of its look, its name and what it holds.
// A template with several looks shows them as small pictures under the text; pointing at one
// (or tapping it) shows that look large. A ready template is a choice (a radio button drawn as
// a card), and choosing one of its small pictures chooses that look with it. A planned one is
// shown just the same, marked, and cannot be picked.
const props = defineProps<{ template: TemplateDef; selected: boolean; look?: string | null }>()
const emit = defineEmits<{ pick: [id: string, look: string | null] }>()
const t = useT()
const l = useL()

const looks = computed(() => pictureLooks(props.template))
const many = computed(() => looks.value.length > 1)
// Where the card rests: the chosen look of a chosen template, else the first.
const home = computed(() => (props.selected && props.look ? Math.max(0, looks.value.findIndex((x) => x.id === props.look)) : 0))
const shown = ref(home.value)
watch(home, (i) => { shown.value = i })
// The other looks' pictures are fetched once somebody shows interest in the card.
const armed = ref(false)
function show(i: number) { armed.value = true; shown.value = i }
const rest = (e: PointerEvent) => { if (e.pointerType === 'mouse') shown.value = home.value }

const pick = () => { if (props.template.ready) emit('pick', props.template.id, many.value ? looks.value[shown.value]!.id : null) }
function pickLook(i: number) {
  show(i)
  if (props.template.ready) emit('pick', props.template.id, looks.value[i]!.id)
}
</script>

<template>
  <article
    class="tpl group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-(--z-surface) text-left transition"
    :class="[
      selected ? 'border-(--ui-primary) ring-2 ring-(--ui-primary)' : 'border-default',
      template.ready && !selected ? 'hover:border-(--ui-border-accented)' : '',
    ]"
    :data-template="template.id" :data-ready="template.ready" :data-shown-look="looks[shown]?.id"
    @pointerenter="armed = true" @pointerleave="rest"
  >
    <div class="tpl__art relative aspect-[16/10] overflow-hidden bg-(--z-moment-bg)">
      <template v-for="(x, i) in looks" :key="x.id">
        <img
          v-if="i === 0 || armed" :src="pictureOf(template.id, x.id, 'card')" alt="" width="800" height="500" :loading="i === 0 ? 'lazy' : 'eager'" draggable="false"
          class="tpl__shot absolute inset-0 size-full object-cover object-top" :class="i === shown ? 'is-shown' : ''"
        >
      </template>
      <span v-if="selected" class="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full bg-(--ui-primary) text-inverted shadow-sm">
        <UIcon name="i-lucide-check" class="size-4" />
      </span>
      <span v-if="!template.ready" class="tpl__planned absolute top-3 left-3 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold shadow-sm">{{ t('new.planned') }}</span>
    </div>

    <div class="flex flex-1 flex-col p-4 sm:p-5">
      <h3 class="z-title text-[1.0625rem] leading-snug text-highlighted">
        <!-- The whole card is the button of a ready template (its small pictures lie above it). -->
        <button v-if="template.ready" type="button" role="radio" :aria-checked="selected" class="tpl__pick cursor-pointer text-left" @click="pick">{{ l(template.name) }}</button>
        <template v-else>{{ l(template.name) }}</template>
      </h3>
      <p class="mt-1 text-sm leading-relaxed text-pretty text-muted">{{ l(template.description) }}</p>
      <p class="mt-2 truncate text-xs text-dimmed">{{ template.features.map((f) => l(f)).join(' · ') }}</p>

      <div v-if="many" class="relative z-10 mt-auto flex items-center gap-3 pt-4">
        <ul class="flex gap-1.5" :aria-label="t('new.looksOf', { n: looks.length })">
          <li v-for="(x, i) in looks" :key="x.id">
            <button
              type="button" class="tpl__thumb block cursor-pointer overflow-hidden rounded-md" :class="i === shown ? 'is-shown' : ''"
              :aria-label="x.name ? l(x.name) : undefined" :aria-pressed="i === shown" :data-look-thumb="x.id"
              @pointerenter="$event.pointerType === 'mouse' && show(i)" @focus="show(i)" @click="pickLook(i)"
            >
              <img :src="pictureOf(template.id, x.id, 'thumb')" alt="" width="240" height="150" loading="lazy" draggable="false" class="block h-[2.125rem] w-[3.375rem] object-cover object-top">
            </button>
          </li>
        </ul>
        <p class="min-w-0 truncate text-xs text-muted" aria-live="off">
          <span class="font-medium text-highlighted">{{ looks[shown]?.name ? l(looks[shown]!.name!) : '' }}</span>
          <span class="text-dimmed"> · {{ t('new.looksOf', { n: looks.length }) }}</span>
        </p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.tpl__shot { opacity: 0; transition: opacity 280ms ease; }
.tpl__shot.is-shown { opacity: 1; }
/* The button's reach is the whole card. */
.tpl__pick::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
.tpl__pick:focus-visible { outline: none; }
.tpl__pick:focus-visible::after { outline: 2px solid var(--ui-primary); outline-offset: 2px; border-radius: 1rem; }
.tpl__planned { background: color-mix(in oklab, var(--z-surface) 92%, transparent); color: var(--ui-text-highlighted); backdrop-filter: blur(6px); }
.tpl__thumb { box-shadow: 0 0 0 1px var(--ui-border); opacity: 0.72; transition: opacity 160ms, box-shadow 160ms, transform 160ms; }
.tpl__thumb:hover, .tpl__thumb:focus-visible { opacity: 1; }
.tpl__thumb.is-shown { opacity: 1; box-shadow: 0 0 0 2px var(--z-surface), 0 0 0 3.5px var(--ui-text-highlighted); }
.tpl__thumb:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 3px; }
/* A planned template is not a choice: nothing on it invites a click, but it is shown in full. */
.tpl[data-ready="false"] { cursor: default; }
</style>
