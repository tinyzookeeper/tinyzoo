<script setup lang="ts">
import type { KeeperAbout } from '#keeper/types/keeper'

const now = useNow()
// Keeper's own version comes with the build; the newest tinyzoo release from the database.
const build = useRuntimeConfig().public.keeper as { version: string; builtAt: string }
const { data: about } = await useFetch<KeeperAbout>('/api/about', { key: 'about', default: () => ({ tinyzoo: null }) })

</script>

<template>
  <InfoCard id="about" title="About Keeper">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <KMark class="h-11" />
        <div class="min-w-0">
          <p class="k-display text-xl text-highlighted tabular-nums">Keeper {{ build.version }}</p>
          <p class="text-xs text-muted">Built {{ formatDateTime(build.builtAt) }}</p>
        </div>
      </div>
      <dl class="flex flex-col gap-3 border-t border-default pt-3 text-sm">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <dt class="text-muted">Newest tinyzoo</dt>
          <dd v-if="about.tinyzoo" class="text-right text-highlighted">
            <span class="tabular-nums">{{ about.tinyzoo.version }}</span>
            <span class="text-xs text-muted"> · from npm {{ timeAgo(about.tinyzoo.checkedAt, now) }}</span>
          </dd>
          <dd v-else class="text-muted">Not read from npm yet</dd>
        </div>
      </dl>
      <p class="border-t border-default pt-3">
        <KBrand signature />
        <span class="sr-only">Keeper, part of tinyzoo</span>
      </p>
    </div>
  </InfoCard>
</template>
