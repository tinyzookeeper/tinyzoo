<script setup lang="ts">
// Beside a field while translating: what the default language says there. An empty field shows the
// default language's text greyed inside it (the field's placeholder, or the rich text behind the
// editor: CmsField's `fallback`), and this line says what that is and offers it as a start, right at
// the field — above a text body (so it is seen before the long text), under a short field:
//
//   Shown in Czech until you translate it · Use it as a start
//
// A field already translated shows the default language's words quietly for reference (a line of
// text), and a long text can show the original beside it (`compare`, wide screens only).
const props = defineProps<{
  field: any
  value: unknown
  lang: string
  empty: boolean
  /** Above the field (a text body) or under it. */
  above?: boolean
  /** Offer "Show the original beside it" (the main text, on a wide screen). */
  canCompare?: boolean
}>()
const emit = defineEmits<{ copy: [] }>()
const compare = defineModel<boolean>('compare', { default: false })
const { t, locale } = useCmsI18n()
const isText = computed(() => props.field.type === 'text' || props.field.type === 'slug')
const hasValue = computed(() => {
  const v = props.value
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object' && (v as any).type === 'doc') return !isEmptyRichText(v)
  return true
})
</script>

<template>
  <div v-if="hasValue" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted min-w-0" :class="above ? 'mb-2' : 'mt-1.5'">
    <template v-if="empty">
      <UIcon name="i-lucide-languages" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
      <span>{{ t('translation.shownUntil', { lang }) }}</span>
      <!-- a field this person may not change offers nothing to copy into it -->
      <span v-if="!field.readOnly" class="text-dimmed" aria-hidden="true">·</span>
      <button
        v-if="!field.readOnly"
        type="button" class="underline underline-offset-2 hover:text-highlighted"
        :aria-label="t('translation.copyFrom', { lang })" @click="emit('copy')"
      >{{ t('translation.useAsStart') }}</button>
    </template>
    <span v-else-if="isText" class="truncate min-w-0 max-w-full">{{ t('translation.reference', { lang: cmsCapitalize(lang, locale), value: String(value) }) }}</span>
    <template v-if="canCompare">
      <span v-if="empty" class="text-dimmed" aria-hidden="true">·</span>
      <!-- it only changes the view: an <a role="button">, so a read-only form (a disabled fieldset) keeps it -->
      <a
        href="#" role="button" class="inline-flex items-center gap-1 underline underline-offset-2 hover:text-highlighted" :aria-pressed="compare"
        @click.prevent="compare = !compare" @keydown.space.prevent="compare = !compare"
      >
        <UIcon name="i-lucide-columns-2" class="size-3.5" aria-hidden="true" />{{ compare ? t('translation.hideOriginal') : t('translation.showOriginal') }}
      </a>
    </template>
  </div>
</template>
