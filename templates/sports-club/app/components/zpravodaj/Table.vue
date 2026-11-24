<script setup lang="ts">
// Zpravodaj's league table on its own (when it does not follow the fixtures).
import type { TableView } from '~/composables/useClub'

defineProps<{ block: BlockOf<'table'>; first?: boolean; anchor?: string; table: TableView }>()
</script>

<template>
  <section class="wrap pt-16 lg:pt-24">
    <ZpravodajTableCard :block="block" :table="table" :first="first" :anchor="anchor" class="max-w-[40rem]" />
  </section>
</template>
