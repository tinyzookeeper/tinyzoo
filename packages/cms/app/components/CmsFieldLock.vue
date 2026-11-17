<script setup lang="ts">
// A field its role may read but not change (`.access({ edit })`): it looks locked and says why, once.
// Everything inside is disabled (a `fieldset` disables its controls, and the rich-text editor is told
// through `cmsReadOnly`); the controls get a muted fill with a lock in them (cms-admin.css), and one
// sentence under the field names who can change it: "Only Editor and Administrator can change this."
// Not locked, it adds nothing around the field.
const props = defineProps<{
  locked?: boolean
  /** The roles that may change it (`field.editableBy` from the admin's schema), administrator last. */
  editableBy?: { name: string; label?: unknown }[] | null
  /** The field's DOM id, so the sentence can describe it. */
  id?: string
}>()
const { t, tl, locale } = useCmsI18n()
const BUILT_IN = ['admin', 'editor', 'author']
const why = computed(() => {
  const names = (props.editableBy ?? []).map((r) => (r.label ? tl(r.label as any, r.name) : BUILT_IN.includes(r.name) ? t(`roles.${r.name as 'admin'}.name`) : r.name))
  return names.length ? cmsLockedSentence(names, locale.value, t as any) : t('readOnly.fieldTitle')
})
const whyId = computed(() => (props.id ? `${props.id}-locked` : undefined))
</script>

<template>
  <div v-if="locked" class="cms-field-locked">
    <fieldset class="cms-field-locked__set" disabled :aria-describedby="whyId"><slot /></fieldset>
    <p :id="whyId" class="cms-field-locked__why">
      <UIcon name="i-lucide-lock" class="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{{ why }}</span>
    </p>
  </div>
  <slot v-else />
</template>
