<script setup lang="ts">
// The frame of every admin page: a sticky top bar (where you are + the page's
// actions, always reachable) over a scrolling body with the page title.
// Pages add no outer padding of their own — `.cms-page` owns the gutters.
//
// Two kinds of top bar:
// - lists and settings: breadcrumbs ("Home › News");
// - editors: `back` + the `status` slot — "‹ News · Draft · Saved" — the same bar for
//   every editor arrangement, so moving between them never feels like another product.
export interface CmsCrumb { label: string; to?: string }
defineProps<{
  title?: string
  description?: string
  breadcrumbs?: CmsCrumb[]
  /** Editors: where "back" goes (replaces the breadcrumbs). */
  back?: CmsCrumb
  /** Narrow reading column (forms) instead of the full content width. */
  narrow?: boolean
  /** No width limit and no gutters (the page lays itself out, e.g. form + preview). */
  flush?: boolean
  /** Wide but with gutters (the Preview arrangement). */
  wide?: boolean
}>()
</script>

<template>
  <UDashboardPanel :ui="{ body: 'p-0 sm:p-0 gap-0' }">
    <template #header>
      <UDashboardNavbar :ui="{ root: 'bg-(--cms-page-bg)/85 backdrop-blur border-b border-default h-(--ui-header-height) gap-2 px-3 sm:px-6', left: 'min-w-0 gap-1.5', right: 'gap-1.5 sm:gap-2 shrink-0' }">
        <template #title>
          <div v-if="back" class="flex items-center gap-2 min-w-0 text-sm">
            <NuxtLink
              :to="back.to" class="inline-flex items-center gap-1 -ml-1.5 px-1.5 py-1 rounded-md font-medium text-highlighted hover:bg-elevated/60 shrink-0 sm:max-w-[45vw] lg:max-w-none"
            >
              <UIcon name="i-lucide-chevron-left" class="size-4 shrink-0" />
              <!-- phones: the arrow alone (the bar is short); its name is still read out -->
              <span class="truncate max-sm:sr-only">{{ back.label }}</span>
            </NuxtLink>
            <div v-if="$slots.status" class="flex items-center gap-2 min-w-0 text-muted">
              <span class="text-dimmed max-sm:hidden" aria-hidden="true">·</span>
              <slot name="status" />
            </div>
          </div>
          <nav v-else-if="breadcrumbs?.length" aria-label="Breadcrumb" class="min-w-0">
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
          <slot name="actions" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="cms-page" :class="[narrow ? 'cms-page--narrow' : '', flush ? 'cms-page--flush' : '', wide ? 'cms-page--wide' : '']">
        <header v-if="title || $slots.meta" class="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div class="min-w-0">
            <div class="flex items-baseline gap-3 flex-wrap">
              <h1 class="cms-display text-[1.75rem] leading-tight text-highlighted">{{ title }}</h1>
              <slot name="badge" />
            </div>
            <p v-if="description" class="mt-1 text-sm text-muted max-w-2xl text-pretty">{{ description }}</p>
          </div>
          <slot name="meta" />
        </header>
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
