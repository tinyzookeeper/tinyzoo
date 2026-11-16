<script setup lang="ts">
// Sign-in, first-run setup, password reset and invitation pages: tinyzoo's cream
// (charcoal in dark mode), no card — one animal above a short greeting, the client's
// name, a narrow form, and tinyzoo's signature at the bottom. First-run setup brings
// its own animals (the whole family says hello), so the layout's one stays away there.
const { productName, unbranded } = useCmsAdminHead()
const { t } = useCmsI18n()
const route = useRoute()
const animal = computed(() => (route.path.startsWith('/admin/setup') ? null : cmsCharacter('hedgehog')))
const initials = computed(() => productName.value.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase())
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center px-4 bg-(--cms-auth-bg)">
    <!-- anchored from the top, so a message appearing below never shifts the card -->
    <main class="cms-touch w-full max-w-[22rem] flex-1 flex flex-col justify-start pt-[12dvh] pb-10 sm:pt-[16dvh]">
      <img v-if="animal" :src="animal.url" alt="" class="mx-auto mb-6 h-20 sm:h-24 w-auto select-none" draggable="false">
      <div class="flex items-center justify-center gap-2 mb-6">
        <CmsMascot v-if="unbranded" class="h-6 w-auto" />
        <span v-else class="size-6 rounded-md bg-inverted text-inverted grid place-items-center text-[0.625rem] font-bold cms-display tracking-normal" aria-hidden="true">{{ initials }}</span>
        <span class="text-sm font-semibold text-highlighted">{{ productName }}</span>
      </div>
      <slot />
    </main>
    <footer class="pb-6 flex items-center justify-center gap-1.5 text-xs text-muted">
      <span>{{ t('auth.poweredBy') }}</span>
      <template v-if="!unbranded">
        <span aria-hidden="true">·</span>
        <span class="inline-flex items-center gap-1">
          <CmsMascot class="h-3 w-auto" />
          <CmsWordmark class="h-2.5 w-auto" />
          <span class="sr-only">tinyzoo</span>
        </span>
      </template>
    </footer>
  </div>
</template>
