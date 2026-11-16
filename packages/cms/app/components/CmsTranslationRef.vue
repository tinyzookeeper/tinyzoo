<script setup lang="ts">
// Under a field while translating: what the default language says. Text is shown as
// a quiet reference line; rich text and blocks offer to copy it over as a start.
const props = defineProps<{ field: any; value: unknown; lang: string; empty: boolean }>()
const emit = defineEmits<{ copy: [] }>()
const { t } = useCmsI18n()
const isText = computed(() => props.field.type === 'text' || props.field.type === 'slug')
const hasValue = computed(() => {
  const v = props.value
  if (v === null || v === undefined || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object' && (v as any).type === 'doc') return !!(v as any).content?.length
  return true
})
</script>

<template>
  <div v-if="hasValue" class="mt-1.5 flex items-center gap-2 text-xs text-muted min-w-0">
    <span v-if="isText" class="truncate">{{ t('translation.reference', { lang, value: String(value) }) }}</span>
    <template v-else>
      <span v-if="empty">{{ t('translation.fallback', { lang }) }}</span>
      <button type="button" class="underline underline-offset-2 hover:text-highlighted" @click="emit('copy')">
        {{ t('translation.copyFrom', { lang }) }}
      </button>
    </template>
  </div>
</template>
