<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const { data: graph } = await useFetch('/api/cms/_graph', { key: 'cms-graph' })
const icons: Record<string, string> = {
  post: 'i-lucide-file-text', author: 'i-lucide-users', tag: 'i-lucide-tag', cms_media: 'i-lucide-image',
}
</script>

<template>
  <div>
    <header class="h-16 border-b border-default bg-default/80 backdrop-blur sticky top-0 z-10 flex items-center px-8">
      <h1 class="text-lg font-semibold">Dashboard</h1>
    </header>
    <div class="p-8">
      <p class="text-muted mb-6">Manage the content defined in <code class="text-primary text-sm">cms.config.ts</code>.</p>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink v-for="e in graph" :key="e.name" :to="`/admin/${e.name}`" class="group">
          <UCard :ui="{ root: 'h-full hover:ring-2 hover:ring-primary/40 transition' }">
            <div class="flex items-start gap-3">
              <div class="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UIcon :name="icons[e.name] ?? 'i-lucide-database'" class="size-5" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-semibold group-hover:text-primary transition">{{ e.label }}</div>
                <div class="text-xs text-muted mt-0.5">{{ e.fields.length }} fields</div>
              </div>
              <UIcon name="i-lucide-arrow-up-right" class="size-4 text-dimmed group-hover:text-primary transition" />
            </div>
          </UCard>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
