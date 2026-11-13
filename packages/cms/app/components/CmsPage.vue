<script setup lang="ts">
// The frame of every admin page: a sticky top bar (breadcrumbs + the page's
// actions, always reachable) over a scrolling body with the page title.
// Pages add no outer padding of their own — `.cms-page` owns the gutters.
export interface CmsCrumb { label: string; to?: string }
defineProps<{
  title?: string
  description?: string
  breadcrumbs?: CmsCrumb[]
  /** Narrow reading column (forms) instead of the full content width. */
  narrow?: boolean
}>()
</script>

<template>
  <UDashboardPanel :ui="{ body: 'p-0 sm:p-0 gap-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'bg-default/85 backdrop-blur border-b border-default h-(--ui-header-height)', left: 'min-w-0' }">
        <template #title>
          <nav v-if="breadcrumbs?.length" aria-label="Breadcrumb" class="min-w-0">
            <ol class="flex items-center gap-1.5 text-sm min-w-0">
              <li v-for="(c, i) in breadcrumbs" :key="i" class="flex items-center gap-1.5 min-w-0" :class="i < breadcrumbs.length - 1 ? 'shrink-0 max-sm:hidden' : ''">
                <NuxtLink v-if="c.to && i < breadcrumbs.length - 1" :to="c.to" class="text-muted hover:text-highlighted transition-colors">{{ c.label }}</NuxtLink>
                <span v-else class="font-medium text-highlighted truncate" aria-current="page">{{ c.label }}</span>
                <UIcon v-if="i < breadcrumbs.length - 1" name="i-lucide-chevron-right" class="size-3.5 text-dimmed shrink-0" />
              </li>
            </ol>
          </nav>
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <slot name="actions" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="cms-page" :class="narrow ? 'cms-page--narrow' : ''">
        <header v-if="title || $slots.meta" class="mb-6 sm:mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div class="min-w-0">
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="cms-display text-[1.75rem] sm:text-[2rem] leading-tight font-medium text-highlighted">{{ title }}</h1>
              <slot name="badge" />
            </div>
            <p v-if="description" class="mt-1.5 text-muted max-w-2xl">{{ description }}</p>
          </div>
          <slot name="meta" />
        </header>
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
