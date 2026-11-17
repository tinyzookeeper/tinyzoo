<script setup lang="ts">
// Beside a field while translating. What an empty translated field shows is said once for the whole translation
// (the editor's note at the top: "Empty fields show the Czech text in grey until you translate them"): the default
// language's text greyed inside the field (the placeholder of a text, the original behind an empty rich text, CmsField's
// `fallback`). So an empty field only gets its action here, right at the field — above a text body (so it is seen
// before the long text), under a short field:
//
//   Use it as a start
//
// A field already translated shows the default language's words quietly for reference (a line of text), and a
// long text can show the original beside it (`compare`, wide screens only).
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
const hasValue = computed(() => !cmsBlank(props.value))
// A field this person may not change offers nothing to copy into it.
const copyable = computed(() => props.empty && !props.field.readOnly)
const referenced = computed(() => !props.empty && isText.value)
</script>

<template>
  <div v-if="hasValue && (copyable || referenced || canCompare)" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted min-w-0" :class="above ? 'mb-2' : 'mt-1.5'">
    <button
      v-if="copyable"
      type="button" class="inline-flex items-center gap-1 underline underline-offset-2 hover:text-highlighted"
      :title="t('translation.copyFrom', { lang })" :aria-label="t('translation.copyFrom', { lang })" @click="emit('copy')"
    >
      <UIcon name="i-lucide-copy" class="size-3.5 shrink-0" aria-hidden="true" />{{ t('translation.useAsStart') }}
    </button>
    <span v-else-if="referenced" class="truncate min-w-0 max-w-full">{{ t('translation.reference', { lang: cmsCapitalize(lang, locale), value: String(value) }) }}</span>
    <!-- it only changes the view: an <a role="button">, so a read-only form (a disabled fieldset) keeps it -->
    <a
      v-if="canCompare"
      href="#" role="button" class="inline-flex items-center gap-1 underline underline-offset-2 hover:text-highlighted" :aria-pressed="compare"
      @click.prevent="compare = !compare" @keydown.space.prevent="compare = !compare"
    >
      <UIcon name="i-lucide-columns-2" class="size-3.5" aria-hidden="true" />{{ compare ? t('translation.hideOriginal') : t('translation.showOriginal') }}
    </a>
  </div>
</template>
