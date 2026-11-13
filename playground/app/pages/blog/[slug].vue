<script setup lang="ts">
const route = useRoute()
// Pass ?preview through so an authenticated editor can see a draft. useRequestFetch
// forwards the incoming cookie on SSR so the editor's session reaches the content API
// (a plain useFetch would drop it → the draft would 404 during server render).
const { data, error } = await useFetch(() => `/api/content/post/${route.params.slug}`, {
  query: { preview: route.query.preview },
  // useRequestFetch's server-side type lacks $fetch's .raw/.create; the call shape is the same.
  $fetch: useRequestFetch() as typeof $fetch,
})
const post = computed(() => data.value?.item)
const isPreview = computed(() => !!data.value?.preview)

function fmtDate(d?: string | null) {
  // Fixed locale + UTC so server and client render identically (no hydration mismatch).
  return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <div v-if="isPreview" class="bg-warning/15 text-warning border-b border-warning/30 px-6 py-2 text-sm text-center font-medium">
      Draft preview — not visible to the public.
    </div>
    <div class="max-w-2xl mx-auto px-6 py-10">
      <ULink to="/blog" class="text-sm text-muted hover:text-default">← Back to the blog</ULink>

      <div v-if="error || !post" class="mt-12 text-center text-muted">
        <p class="text-lg">Post not found.</p>
      </div>

      <article v-else class="mt-6">
        <img
          v-if="post.hero" :src="post.hero.url" :alt="post.hero.alt || ''"
          :width="post.hero.width || undefined" :height="post.hero.height || undefined"
          class="w-full rounded-xl object-cover border border-default mb-8"
        >
        <h1 class="text-4xl font-bold leading-tight">{{ post.title }}</h1>
        <div class="mt-3 text-sm text-muted flex flex-wrap items-center gap-x-2">
          <span v-if="post.author">By {{ post.author.name }}</span>
          <span v-if="post.publishedAt">· {{ fmtDate(post.publishedAt) }}</span>
        </div>
        <div v-if="post.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
          <UBadge v-for="t in post.tags" :key="t.id" color="neutral" variant="subtle" size="sm">{{ t.name }}</UBadge>
        </div>

        <CmsContent :doc="post.body" class="mt-8 text-default" />
      </article>
    </div>
  </div>
</template>
