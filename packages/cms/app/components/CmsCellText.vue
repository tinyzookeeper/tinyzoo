<script setup lang="ts">
import { isLinkRef } from '../../src/linkref'
const props = defineProps<{ field: any; row: any; entity?: string }>()
const v = computed(() => props.row[props.field.key])
// A link to one of the site's pages is shown as the page, not as its reference.
const page = computed(() => (props.field?.meta?.format === 'link' && typeof v.value === 'string' && isLinkRef(v.value) ? v.value : null))
</script>

<template>
  <CmsLinkTarget v-if="page" :value="page" compact class="max-w-xs" />
  <span v-else>{{ v == null || v === '' ? '—' : typeof v === 'object' ? '{…}' : String(v) }}</span>
</template>
