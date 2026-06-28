<script setup lang="ts">
import { createClient, type Post } from '~/lib/cms-content'

// The SAME public API as /blog, but consumed through the generated, strictly-typed
// @my-cms/client. `cms.post.list(...)` resolves to Post[]; sort keys and filters are
// autocompleted and type-checked. A separate frontend app uses this exact pattern.
const cms = createClient({ baseUrl: useRequestURL().origin })

const { data: posts } = await useAsyncData(
  'blog-typed',
  () => cms.post
    .list({ filter: { status: 'published' }, sort: 'publishedAt', dir: 'desc', limit: 20 })
    .then(r => r.items),
  { default: () => [] as Post[] },
)

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="border-b border-default">
      <div class="max-w-3xl mx-auto px-6 py-10">
        <p class="text-sm font-medium text-muted uppercase tracking-wide">Typed SDK demo</p>
        <h1 class="text-4xl font-bold mt-1">The Blog</h1>
        <p class="text-muted mt-2">
          Same data, fetched with the typed
          <code class="text-xs">@my-cms/client</code> + generated bindings.
        </p>
        <ULink to="/blog" class="text-sm text-primary mt-3 inline-block">← Plain fetch version</ULink>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <p v-if="!posts?.length" class="text-muted">No published posts yet.</p>

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
              <span>By {{ p.author.name }}</span>
              <span v-if="p.publishedAt">· {{ fmtDate(p.publishedAt) }}</span>
            </div>
            <div v-if="p.tags.length" class="mt-2 flex flex-wrap gap-1.5">
              <UBadge v-for="t in p.tags" :key="t.id" color="neutral" variant="subtle" size="sm">{{ t.name }}</UBadge>
            </div>
          </div>
        </NuxtLink>
      </article>
    </main>
  </div>
</template>
