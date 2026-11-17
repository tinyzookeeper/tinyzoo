<script setup lang="ts">
// A field its role may read but not change (`.access({ edit })`): everything inside is disabled
// (a `fieldset` disables its controls, and the rich-text editor is told through `cmsReadOnly`).
// Not locked, it adds nothing around the field.
defineProps<{ locked?: boolean }>()
</script>

<template>
  <fieldset v-if="locked" class="cms-field-locked" disabled><slot /></fieldset>
  <slot v-else />
</template>

<style>
.cms-field-locked { min-width: 0; margin: 0; padding: 0; border: 0; }
/* Still easy to read (the browser dims disabled controls a lot). */
.cms-field-locked :is(input, textarea, select, button):disabled { opacity: 0.85; cursor: default; }
.cms-field-locked .cms-rte__toolbar { display: none; }
</style>
