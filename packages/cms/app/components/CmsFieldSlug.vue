<script setup lang="ts">
const { t } = useCmsI18n()
// Slug field. Auto-derives from its source field (`from`, set in cms.config) until
// the editor types in it manually — and never clobbers a slug that already exists
// on a record being edited.
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()

const form = inject<{ state: Record<string, any>, isNew: { value: boolean } } | null>('cmsForm', null)
const from = props.field.meta?.from as string | undefined
const injected = inject<Ref<'outline' | 'ghost'> | null>('cmsFieldVariant', null)
const variant = computed(() => injected?.value ?? 'outline')

function slugify(s: unknown): string {
  return String(s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const touched = ref(false)
let lastAuto: string | undefined

if (form && from) {
  watch(() => form.state[from], (val) => {
    if (touched.value) return
    // Fill only an empty slug or one we filled ourselves: a saved slug (an existing
    // entry, a saved translation) is kept. A new translation of an existing entry
    // starts empty, so it auto-fills like a new entry does.
    if (model.value && model.value !== lastAuto) return
    lastAuto = slugify(val)
    model.value = lastAuto
  })
  // Any value the user (not our auto-fill) puts in disables further auto-generation.
  watch(model, (val) => { if (val && val !== lastAuto) touched.value = true })
}
</script>

<template>
  <!-- an address can be long: it wraps instead of being cut off -->
  <UTextarea
    v-model="model" :variant="variant" :placeholder="t('fields.slugPlaceholder')" class="w-full" :rows="1" autoresize :maxrows="5"
    :ui="{ base: 'font-mono text-[0.8125rem] resize-none [overflow-wrap:anywhere]' }" @keydown.enter.prevent
  />
</template>
