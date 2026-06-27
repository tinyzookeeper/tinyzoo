<script setup lang="ts">
const route = useRoute()
const { data, error } = await useFetch(() => `/api/content/post/${route.params.slug}`)
const post = computed(() => data.value?.item)

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
}
</script>

<template>
  <div class="min-h-screen bg-default">
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
