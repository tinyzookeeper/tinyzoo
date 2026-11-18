<script setup lang="ts">
// The client's brand in one place of the admin (src/themeLogo.ts, adminBrandLockup):
// the full logo; else the mark with the name; else a tile with the initials and the
// name; else (no client name, no logo) tinyzoo's mascot. Dark mode shows the dark
// versions; without them the light logo sits on a small cream tile, so a dark logo
// never disappears on charcoal. A logo that does not load gives way to the next one.
import { adminBrandLockup, brandInitials } from '../../src/themeLogo'

const props = withDefaults(defineProps<{
  /** `wide`: the open sidebar, the phone's menu, the sign-in pages. `compact`: the folded sidebar, the phone's top bar (the mark or the tile alone). */
  room?: 'wide' | 'compact'
  /** `sidebar`: fits the sidebar's header (28 px). `auth`: the sign-in pages, larger. */
  size?: 'sidebar' | 'auth'
}>(), { room: 'wide', size: 'sidebar' })

const { theme, productName, unbranded } = useCmsAdminBrand()
// A logo the browser could not load (a wrong address, a file that is gone).
const failed = reactive({ full: false, mark: false })
const logo = computed(() => ({
  ...theme.value.logo,
  full: failed.full ? null : theme.value.logo.full,
  mark: failed.mark ? null : theme.value.logo.mark,
}))
const lockup = computed(() => adminBrandLockup({ logo: logo.value }, unbranded.value, props.room))
const initials = computed(() => brandInitials(productName.value))
const auth = computed(() => props.size === 'auth')

// An image that failed before the page came alive sent its error event to nobody: look once.
const root = ref<HTMLElement>()
onMounted(() => {
  for (const img of root.value?.querySelectorAll<HTMLImageElement>('img[data-logo]') ?? []) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) failed[img.dataset.logo as 'full' | 'mark'] = true
  }
})
</script>

<template>
  <span ref="root" class="flex items-center min-w-0" :class="auth ? 'gap-2' : 'gap-2.5'">
    <!-- The full logo carries the name: it is the image's text. -->
    <span v-if="lockup === 'full'" class="flex min-w-0 max-w-full" :class="auth ? 'h-10' : 'h-7'">
      <img
        data-logo="full" :src="logo.full!" :alt="productName"
        class="block h-full w-auto max-w-full object-contain object-left dark:hidden" draggable="false" @error="failed.full = true"
      >
      <span v-if="logo.fullDarkPlate" class="cms-brand-plate hidden dark:flex h-full max-w-full -ml-2 px-2 -my-1.5 py-1.5 box-content rounded-lg">
        <img data-logo="full" :src="logo.full!" :alt="productName" class="block h-full w-auto max-w-full object-contain object-left" draggable="false" @error="failed.full = true">
      </span>
      <img
        v-else data-logo="full" :src="logo.fullDark!" :alt="productName"
        class="hidden dark:block h-full w-auto max-w-full object-contain object-left" draggable="false" @error="failed.full = true"
      >
    </span>

    <template v-else>
      <span v-if="lockup === 'mark'" class="relative shrink-0 grid place-items-center" :class="auth ? 'size-8' : 'size-7'" aria-hidden="true">
        <img data-logo="mark" :src="logo.mark!" alt="" class="size-full object-contain dark:hidden" draggable="false" @error="failed.mark = true">
        <span v-if="logo.markDarkPlate" class="cms-brand-plate hidden dark:grid place-items-center size-full p-0.5 -m-0.5 box-content rounded-md">
          <img data-logo="mark" :src="logo.mark!" alt="" class="size-full object-contain" draggable="false" @error="failed.mark = true">
        </span>
        <img v-else data-logo="mark" :src="logo.markDark!" alt="" class="hidden dark:block size-full object-contain" draggable="false" @error="failed.mark = true">
      </span>
      <span
        v-else-if="lockup === 'initials'" aria-hidden="true"
        class="shrink-0 bg-inverted text-inverted grid place-items-center font-bold leading-none cms-display tracking-normal"
        :class="auth ? 'size-6 rounded-md text-[0.625rem]' : 'size-7 rounded-lg text-xs'"
      >{{ initials }}</span>
      <CmsMascot v-else class="h-6 w-auto shrink-0" />
      <span v-if="room === 'wide'" class="truncate font-semibold text-highlighted" :class="auth ? 'text-sm' : ''">{{ productName }}</span>
      <span v-else class="sr-only">{{ productName }}</span>
    </template>
  </span>
</template>

<style scoped>
/* The tile under a light logo in dark mode: tinyzoo's cream, so the logo's own colours read as on paper. */
.cms-brand-plate { background: var(--tz-cream, #F9F5EF); }
</style>
