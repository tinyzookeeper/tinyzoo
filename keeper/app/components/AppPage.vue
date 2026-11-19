<script setup lang="ts">
// One page: a quiet top bar (where you are, and the page's actions), then the page with
// its title in Manrope and a sentence about it — the tinyzoo admin's rhythm.
withDefaults(defineProps<{
  /** The page's name: the top bar, and the heading unless `heading` is false. */
  title: string
  /** The trail above the title: [{ label, to }] — the current page comes last by itself. */
  trail?: { label: string; to: string }[]
  description?: string
  heading?: boolean
}>(), { heading: true })
</script>

<template>
  <UDashboardPanel :id="`page-${title}`">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'h-14', right: 'gap-2' }">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
        <template #title>
          <nav class="flex min-w-0 items-center gap-1.5 text-[15px]" aria-label="Where you are">
            <template v-for="t in trail ?? []" :key="t.to">
              <NuxtLink :to="t.to" class="shrink-0 text-muted hover:text-highlighted">{{ t.label }}</NuxtLink>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-dimmed" />
            </template>
            <span class="truncate font-medium text-highlighted">{{ title }}</span>
          </nav>
        </template>
        <template #right>
          <slot name="actions" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto w-full max-w-5xl pb-10">
        <header v-if="heading" class="mb-6">
          <h1 class="k-display text-[1.75rem] leading-tight text-highlighted">{{ title }}</h1>
          <p v-if="description" class="mt-1 text-[0.9375rem] text-pretty text-muted">{{ description }}</p>
        </header>
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
