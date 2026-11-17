<script setup lang="ts">
import type { ListResponse } from '@tinyzoo/client'
import type { Post, SiteSettings } from '~/lib/cms-content'

// A public frontend consuming the headless content API — no admin/auth coupling.
const { data } = await useFetch<ListResponse<Post>>('/api/content/post', { query: { limit: 20 } })
const posts = computed(() => data.value?.items ?? [])

// Site-wide settings (a singleton global) delivered headlessly.
const { data: settings } = await useFetch<{ item: SiteSettings | null }>('/api/content/_global/siteSettings')
const site = computed(() => settings.value?.item)

function fmtDate(d?: string | null) {
  // Fixed locale + UTC so server and client render identically (no hydration mismatch).
  return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="border-b border-default">
      <div class="max-w-3xl mx-auto px-6 py-10">
        <p class="text-sm font-medium text-muted uppercase tracking-wide">{{ site?.siteName || 'Headless demo' }}</p>
        <h1 class="text-4xl font-bold mt-1">The Blog</h1>
        <p class="text-muted mt-2">{{ site?.tagline || 'Published posts served from /api/content/post.' }}</p>
        <ULink to="/blog/typed" class="text-sm text-primary mt-3 inline-block">Typed SDK version →</ULink>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <p v-if="!posts.length" class="text-muted">No published posts yet.</p>

      <article v-for="p in posts" :key="p.id" class="group">
        <NuxtLink :to="`/blog/${p.slug}`" class="flex gap-5 items-start">
          <img
            v-if="p.hero" :src="p.hero.url"
            :width="p.hero.width || undefined" :height="p.hero.height || undefined"
            loading="lazy" decoding="async"
            class="size-28 shrink-0 rounded-lg object-cover border border-default"
          >
          <div class="min-w-0">
            <h2 class="text-xl font-semibold group-hover:text-primary transition">{{ p.title }}</h2>
            <div class="mt-1 text-sm text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
              <span v-if="p.author">By {{ p.author.name }}</span>
              <span v-if="p.publishedAt">· {{ fmtDate(p.publishedAt) }}</span>
            </div>
            <div v-if="p.tags?.length" class="mt-2 flex flex-wrap gap-1.5">
              <UBadge v-for="t in p.tags" :key="t.id" color="neutral" variant="subtle" size="sm">{{ t.name }}</UBadge>
            </div>
          </div>
        </NuxtLink>
      </article>
    </main>
  </div>
</template>
