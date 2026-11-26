<script setup lang="ts">
// A choice. A few options in the content column are buttons (with the developer's
// icons, see `f.select({ icons })`), so every option is visible at once; elsewhere
// and for longer lists, a dropdown. With `f.select({ segments: true })` two to four
// options are one row of segments (a radio group: arrow keys move the choice), wherever
// the field sits; an empty value has none chosen.
//
// With `f.select({ optionsBy })` the options follow another choice of the same form (the
// colours of the chosen look): only those are offered, and when the other choice changes
// the value moves to the first option that is still offered. `swatches` draws a few
// colours beside each option.
const props = defineProps<{ field: any; entity?: string; id?: string; readOnly?: boolean }>()
const model = defineModel<any>()
const { t, tl } = useCmsI18n()
const placement = inject<Ref<'main' | 'sidebar'> | null>('cmsFieldPlacement', null)
const injected = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const variant = computed(() => injected?.value ?? 'outline')
const form = inject<{ state?: Record<string, any> } | null>('cmsForm', null)

const otherValue = computed(() => (props.field.meta.optionsBy ? form?.state?.[props.field.meta.optionsBy.field] : undefined))
// A choice that is no longer offered stays in sight for the entry that holds it, also after
// someone picked another one here (so it can be picked back before saving).
const held = ref<string | null>(null)
watch(model, (v) => { if (cmsSelectRemoved(props.field, v)) held.value = v }, { immediate: true })
const offered = computed(() => cmsSelectOffered(props.field, otherValue.value, held.value ?? model.value))
const labelOf = (value: string) => {
  const label = tl(props.field.meta.labels?.[value], value)
  return cmsSelectRemoved(props.field, value) ? t('model.choiceRemoved', { label }) : label
}
const items = computed(() => offered.value.map((value) => ({
  value,
  label: labelOf(value),
  symbol: props.field.meta.icons?.[value] as string | undefined,
  swatches: props.field.meta.swatches?.[value] as string[] | undefined,
})))
// The other choice was changed here, by this person: a value it no longer offers gives way to
// the first one it does. (Not on load: what is stored is shown as it is until someone chooses.)
watch(otherValue, () => {
  if (props.readOnly || model.value == null || offered.value.includes(model.value)) return
  model.value = offered.value[0]
})

const asSegments = computed(() => cmsSelectAsSegments(props.field))
const asButtons = computed(() => cmsSelectAsButtons(props.field, placement?.value ?? 'main'))
// No segment is chosen while the value is empty (null keeps the group controlled; undefined would not).
const segment = computed({
  get: () => model.value ?? null,
  set: (v: string | null) => { model.value = v },
})
// An optional choice can be left empty again ("None" stands for no value).
const NONE = '\u0000none'
const choices = computed(() => (props.field.optional ? [...items.value, { value: NONE, label: t('fields.noChoice'), symbol: undefined, swatches: undefined }] : items.value))
const choice = computed({
  get: () => model.value ?? NONE,
  set: (v: string) => { model.value = v === NONE ? null : v },
})
const menuItems = computed(() => items.value.map((i) => ({ ...i, icon: i.symbol })))
const current = computed(() => items.value.find((i) => i.value === model.value))
</script>

<template>
  <URadioGroup
    v-if="asSegments" :id="id" v-model="segment" :items="items" orientation="horizontal" variant="card" indicator="hidden" class="cms-segments"
  >
    <template #label="{ item }">
      <span class="cms-segments__label">
        <UIcon v-if="(item as any).symbol" :name="(item as any).symbol" class="size-4 shrink-0" />
        <span v-if="(item as any).swatches?.length" class="cms-swatches" aria-hidden="true">
          <span v-for="(c, i) in (item as any).swatches" :key="i" :style="{ background: c }" />
        </span>
        {{ (item as any).label }}
      </span>
    </template>
  </URadioGroup>
  <URadioGroup
    v-else-if="asButtons" :id="id" v-model="choice" :items="choices" orientation="horizontal" variant="card" indicator="hidden" class="cms-choice"
    :ui="{ fieldset: 'flex-wrap gap-2', item: 'py-2 px-3 rounded-(--ui-radius) has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-inset has-data-[state=checked]:ring-(--ui-primary)', label: 'flex items-center gap-2 font-normal has-data-[state=checked]:font-medium' }"
  >
    <template #label="{ item }">
      <span class="inline-flex items-center gap-2 text-sm">
        <UIcon v-if="(item as any).symbol" :name="(item as any).symbol" class="size-4 shrink-0 text-muted" />
        <span v-if="(item as any).swatches?.length" class="cms-swatches" aria-hidden="true">
          <span v-for="(c, i) in (item as any).swatches" :key="i" :style="{ background: c }" />
        </span>
        {{ (item as any).label }}
      </span>
    </template>
  </URadioGroup>
  <USelect v-else :id="id" v-model="model" :items="menuItems" :variant="variant" :icon="current?.symbol" class="w-full">
    <template v-if="current?.swatches?.length" #leading>
      <span class="cms-swatches" aria-hidden="true"><span v-for="(c, i) in current.swatches" :key="i" :style="{ background: c }" /></span>
    </template>
    <template #item-leading="{ item }">
      <span v-if="(item as any).swatches?.length" class="cms-swatches" aria-hidden="true">
        <span v-for="(c, i) in (item as any).swatches" :key="i" :style="{ background: c }" />
      </span>
      <UIcon v-else-if="(item as any).icon" :name="(item as any).icon" class="size-4 shrink-0 text-dimmed" />
    </template>
  </USelect>
</template>

<style>
/* A palette beside its name: a few overlapping dots, each with a hairline so a white one shows on white. */
.cms-swatches { display: inline-flex; flex: none; align-items: center; padding-inline-start: 4px; }
.cms-swatches > span { width: 14px; height: 14px; margin-inline-start: -4px; border-radius: 999px; box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent), 0 0 0 2px var(--ui-bg); }

/* Segments: one quiet track with a thin line; the chosen one is lifted onto the page colour. It wraps onto a
   second row on a narrow screen rather than squeezing its labels. Arrow keys move the choice (a radio group). */
.cms-segments [data-slot='fieldset'] {
  display: flex; flex-wrap: wrap; gap: 2px; width: fit-content; max-width: 100%; padding: 2px;
  border: 1px solid var(--ui-border-accented); border-radius: var(--ui-radius);
  background: var(--cms-field-bg, var(--ui-bg-elevated));
}
.cms-segments [data-slot='item'] {
  flex: 1 1 auto; display: flex; align-items: center; justify-content: center; min-height: 2rem; padding: 0.25rem 0.75rem;
  border: 0; border-radius: calc(var(--ui-radius) - 2px); color: var(--ui-text-muted); cursor: pointer;
  transition: background-color 150ms ease-out, color 150ms ease-out, box-shadow 150ms ease-out;
}
.cms-segments [data-slot='wrapper'] { width: auto; }
.cms-segments [data-slot='label'] { color: inherit; font-weight: 500; cursor: inherit; }
.cms-segments__label { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; line-height: 1.25rem; white-space: nowrap; }
.cms-segments [data-slot='item']:hover:not(:has([data-state='checked'])) { background: color-mix(in srgb, var(--ui-text) 7%, transparent); color: var(--ui-text-highlighted); }
.cms-segments [data-slot='item']:has([data-state='checked']) {
  background: var(--ui-bg); color: var(--ui-text-highlighted);
  box-shadow: 0 0 0 1px var(--ui-border-accented), 0 1px 2px rgb(0 0 0 / 0.08);
}
.cms-segments [data-slot='item']:has(:focus-visible) { outline: 2px solid var(--ui-primary); outline-offset: 1px; }
.cms-segments [data-slot='item']:has(:disabled) { cursor: not-allowed; opacity: 0.75; }
@media (pointer: coarse) { .cms-segments [data-slot='item'] { min-height: 2.75rem; } }
@media (prefers-reduced-motion: reduce) { .cms-segments [data-slot='item'] { transition: none; } }
</style>
