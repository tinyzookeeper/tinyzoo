<script setup lang="ts">
// One page of the dashboard: a top bar with the title (and actions), then the body.
defineProps<{ title: string; back?: string }>()
</script>

<template>
  <UDashboardPanel :id="`page-${title}`">
    <template #header>
      <UDashboardNavbar :title="title" :ui="{ title: 'font-display text-base sm:text-lg', right: 'gap-2' }">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
          <UButton v-if="back" :to="back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" square aria-label="Back" />
        </template>
        <template #right>
          <slot name="actions" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto w-full max-w-6xl">
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
