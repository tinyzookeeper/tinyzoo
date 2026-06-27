<script setup lang="ts">
// Slice-level richtext editor: a plain-text ⇄ TipTap-JSON proxy. A real TipTap
// editor can be dropped in by overriding `cms.fields.richtext.edit` in app.config.
defineProps<{ field: any; entity?: string }>()
const model = defineModel<any>()

const text = computed({
  get: () => model.value?.content?.[0]?.content?.[0]?.text ?? '',
  set: (v: string) => {
    model.value = v
      ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: v }] }] }
      : { type: 'doc', content: [] }
  },
})
</script>

<template>
  <UTextarea v-model="text" :rows="4" autoresize class="w-full" />
</template>
