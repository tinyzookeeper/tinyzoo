<script setup lang="ts">
import type { TemplateDef } from '#shared/templates'

// One template in the gallery. A ready one is a choice (a radio button drawn as a card); a
// planned one is only shown, dimmed and marked, and cannot be picked.
const props = defineProps<{ template: TemplateDef; selected: boolean }>()
const emit = defineEmits<{ pick: [id: string] }>()
const t = useT()
const l = useL()
const pick = () => { if (props.template.ready) emit('pick', props.template.id) }
</script>

<template>
  <component
    :is="template.ready ? 'button' : 'div'"
    :type="template.ready ? 'button' : undefined"
    :role="template.ready ? 'radio' : undefined"
    :aria-checked="template.ready ? selected : undefined"
    :aria-disabled="template.ready ? undefined : 'true'"
    class="tpl group flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-(--z-surface) text-left transition"
    :class="[
      template.ready ? 'cursor-pointer' : 'tpl--planned',
      selected ? 'border-(--ui-primary) ring-2 ring-(--ui-primary)' : 'border-default',
      template.ready && !selected ? 'hover:border-(--ui-border-accented)' : '',
    ]"
    :data-template="template.id"
    @click="pick"
  >
    <!-- The picture: the finished website when there is one, else the template's animal on cream. -->
    <div class="tpl__art relative flex aspect-[16/9] items-end justify-center overflow-hidden bg-(--z-moment-bg)">
      <img v-if="template.preview" :src="template.preview" alt="" loading="lazy" class="absolute inset-0 size-full object-cover object-top">
      <template v-else>
        <div class="tpl__lines" aria-hidden="true"><i /><i /><i /></div>
        <ZAnimal :name="template.animal" class="relative h-[62%] w-auto translate-y-px" />
      </template>
      <span v-if="selected" class="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full bg-(--ui-primary) text-inverted shadow-sm">
        <UIcon name="i-lucide-check" class="size-4" />
      </span>
      <span v-if="!template.ready" class="absolute top-3 left-3 rounded-full bg-(--z-surface) px-2.5 py-1 text-[0.6875rem] font-semibold text-toned shadow-sm">{{ t('new.planned') }}</span>
    </div>
    <div class="flex flex-1 flex-col p-4 sm:p-5">
      <h3 class="z-title text-[1.0625rem] leading-snug text-highlighted">{{ l(template.name) }}</h3>
      <p class="mt-1 text-sm leading-relaxed text-pretty text-muted">{{ l(template.description) }}</p>
      <ul class="mt-3 flex flex-wrap gap-1.5">
        <li v-for="f in template.features" :key="f.en" class="rounded-full bg-(--ui-bg-elevated) px-2 py-0.5 text-xs text-toned">{{ l(f) }}</li>
      </ul>
    </div>
  </component>
</template>

<style scoped>
/* A planned template is there to be seen, not chosen: quieter, and its animal a little faded. */
.tpl--planned { cursor: default; }
.tpl--planned .tpl__art :deep(img) { opacity: .55; filter: saturate(.7); }
.tpl--planned h3, .tpl--planned p { color: var(--ui-text-dimmed); }
.tpl__lines { position: absolute; inset: 18% 12% auto 12%; display: flex; flex-direction: column; gap: 7px; opacity: .9; }
.tpl__lines i { display: block; height: 6px; border-radius: 99px; background: var(--z-moment-line); }
.tpl__lines i:nth-child(1) { width: 46%; }
.tpl__lines i:nth-child(2) { width: 78%; opacity: .7; }
.tpl__lines i:nth-child(3) { width: 62%; opacity: .5; }
</style>
