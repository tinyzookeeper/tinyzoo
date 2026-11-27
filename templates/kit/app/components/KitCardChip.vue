<script setup lang="ts">
// The words of a card's placeholder (only while an editor works on the page): why the block shows
// nothing, in the admin's language, in a dashed chip in the look's text colour. `unbound`: choose a
// field; `missing` / `unfit`: the field's name and what is wrong; `label`: the block's type name.
// Without a word from the admin (useCmsEditingWords()) the block type's name, else a quiet bar.
import type { CardState } from '../utils/card'

const props = defineProps<{ state?: CardState; name?: string; type: string }>()
const words = useCmsEditingWords()
const typeName = useCmsEditingLabel(() => props.type)
const text = computed(() => {
  const w = words.value
  const own = props.state === 'unbound' ? w.chooseField : props.state === 'missing' ? w.fieldMissing(props.name ?? '') : props.state === 'unfit' ? w.fieldUnfit(props.name ?? '') : ''
  return own || typeName.value
})
</script>

<template>
  <span class="kit-card-chip" aria-hidden="true">
    <svg v-if="state === 'missing' || state === 'unfit'" class="kit-card-chip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 7v6" /><path d="M12 17h.01" /></svg>
    <svg v-else-if="state === 'unbound'" class="kit-card-chip-icon" viewBox="0 0 24 24"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
    <template v-if="text">{{ text }}</template>
    <span v-else class="kit-card-chip-bar" />
  </span>
</template>
