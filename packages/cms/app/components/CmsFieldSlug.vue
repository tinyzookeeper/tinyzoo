<script setup lang="ts">
// Slug field. Auto-derives from its source field (`from`, set in cms.config) until
// the editor types in it manually — and never clobbers a slug that already exists
// on a record being edited.
const props = defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()

const form = inject<{ state: Record<string, any>, isNew: { value: boolean } } | null>('cmsForm', null)
const from = props.field.meta?.from as string | undefined

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
    if (model.value && !form.isNew?.value) return // keep an existing record's slug
    lastAuto = slugify(val)
    model.value = lastAuto
  })
  // Any value the user (not our auto-fill) puts in disables further auto-generation.
  watch(model, (val) => { if (val !== lastAuto) touched.value = true })
}
</script>

<template>
  <UInput v-model="model" placeholder="lowercase-with-dashes" class="w-full" />
</template>
