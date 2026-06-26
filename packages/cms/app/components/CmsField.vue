<script setup lang="ts">
// Generic field renderer: graph field node → a Nuxt UI input.
const props = defineProps<{ field: any; entity: string; error?: string }>()
const model = defineModel<any>()

const options = ref<{ id: string; label: string }[]>([])
const loading = ref(false)
async function loadOptions(q = '') {
  if (!props.field.relation) return
  loading.value = true
  try {
    const selected = Array.isArray(model.value) ? model.value.join(',') : (model.value ?? '')
    options.value = await $fetch(`/api/cms/${props.field.relation.to}/options`, { query: { q, selected } })
  } finally {
    loading.value = false
  }
}
onMounted(() => { if (props.field.type === 'relation') loadOptions() })

// richtext ⇄ plain text proxy (slice-level; TipTap editor lands later)
const richText = computed({
  get: () => model.value?.content?.[0]?.content?.[0]?.text ?? '',
  set: (v: string) => {
    model.value = v
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: v }] }] }
      : { type: 'doc', content: [] }
  },
})
const isManyRel = computed(() => props.field.relation?.kind === 'many-to-many')
const hint = computed(() => {
  if (props.field.type === 'slug') return 'lowercase-with-dashes'
  return undefined
})
</script>

<template>
  <UFormField
    :label="field.key" :name="field.key" :required="field.required" :error="error"
    :hint="field.optional ? 'optional' : undefined"
    :ui="{ label: 'capitalize' }"
  >
    <UInput v-if="['text', 'slug'].includes(field.type)" v-model="model" :placeholder="hint" class="w-full" />
    <UInput v-else-if="field.type === 'number'" v-model.number="model" type="number" class="w-full" />
    <USwitch v-else-if="field.type === 'boolean'" v-model="model" />
    <USelect v-else-if="field.type === 'select'" v-model="model" :items="field.meta.options" class="w-full" />
    <UInput v-else-if="field.type === 'datetime'" v-model="model" type="datetime-local" class="w-full" />
    <UTextarea v-else-if="field.type === 'richtext'" v-model="richText" :rows="4" autoresize class="w-full" />
    <USelectMenu
      v-else-if="field.type === 'relation' && !isManyRel"
      v-model="model" :items="options" value-key="id" :loading="loading" placeholder="Select…"
      class="w-full" @update:open="(o: boolean) => o && loadOptions()"
    />
    <USelectMenu
      v-else-if="field.type === 'relation'"
      v-model="model" multiple :items="options" value-key="id" :loading="loading" placeholder="Select…"
      class="w-full" @update:open="(o: boolean) => o && loadOptions()"
    />
    <CmsFieldMedia v-else-if="field.type === 'media'" v-model="model" :field="field" />
    <p v-else class="text-sm text-error">Unknown field type: {{ field.type }}</p>
  </UFormField>
</template>
