<script setup lang="ts">
// A choice. A few options in the content column are buttons (with the developer's
// icons, see `f.select({ icons })`), so every option is visible at once; elsewhere
// and for longer lists, a dropdown.
const props = defineProps<{ field: any; entity?: string; id?: string }>()
const model = defineModel<any>()
const { t, tl } = useCmsI18n()
const placement = inject<Ref<'main' | 'sidebar'> | null>('cmsFieldPlacement', null)
const injected = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const variant = computed(() => injected?.value ?? 'outline')
const asButtons = computed(() => cmsSelectAsButtons(props.field, placement?.value ?? 'main'))
const items = computed(() => (props.field.meta.options as string[]).map((value) => ({
  value,
  label: tl(props.field.meta.labels?.[value], value),
  symbol: props.field.meta.icons?.[value] as string | undefined,
})))
// An optional choice can be left empty again ("None" stands for no value).
const NONE = '\u0000none'
const choices = computed(() => (props.field.optional ? [...items.value, { value: NONE, label: t('fields.noChoice'), symbol: undefined }] : items.value))
const choice = computed({
  get: () => model.value ?? NONE,
  set: (v: string) => { model.value = v === NONE ? null : v },
})
const menuItems = computed(() => items.value.map((i) => ({ ...i, icon: i.symbol })))
const current = computed(() => items.value.find((i) => i.value === model.value))
</script>

<template>
  <URadioGroup
    v-if="asButtons" :id="id" v-model="choice" :items="choices" orientation="horizontal" variant="card" indicator="hidden"
    :ui="{ fieldset: 'flex-wrap gap-2', item: 'py-2 px-3 rounded-(--ui-radius) has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-inset has-data-[state=checked]:ring-(--ui-primary)', label: 'flex items-center gap-2 font-normal has-data-[state=checked]:font-medium' }"
  >
    <template #label="{ item }">
      <span class="inline-flex items-center gap-2 text-sm">
        <UIcon v-if="(item as any).symbol" :name="(item as any).symbol" class="size-4 shrink-0 text-muted" />
        {{ (item as any).label }}
      </span>
    </template>
  </URadioGroup>
  <USelect v-else :id="id" v-model="model" :items="menuItems" :variant="variant" :icon="current?.symbol" class="w-full" />
</template>
