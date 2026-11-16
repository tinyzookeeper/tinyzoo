<script setup lang="ts">
// The admin's search (⌘K, or the Search button in the sidebar): entries of every
// collection this person may read, found by any word in them (title, text, blocks,
// any language), and the admin's own places (collections, settings, media).
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

const props = defineProps<{ graph: any[]; places: CommandPaletteItem[] }>()
const { t, entitySingular } = useCmsI18n()

interface Hit { entity: string; id: string; title: string; excerpt: string; status: string | null }

const term = ref('')
const hits = ref<Hit[]>([])
const searched = ref('')
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

// Ask the server once typing settles; a slower, older answer never replaces a newer one.
watch(term, (value) => {
  clearTimeout(timer)
  const q = value.trim()
  if (q.length < 2) {
    seq++
    hits.value = []
    searched.value = ''
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const res = await $fetch<{ items: Hit[] }>('/api/cms/_search', { query: { q } })
      if (mine !== seq) return
      hits.value = res.items
      searched.value = q
    }
    catch {
      if (mine === seq) hits.value = []
    }
    finally {
      if (mine === seq) loading.value = false
    }
  }, 180)
})
onBeforeUnmount(() => clearTimeout(timer))

const byName = computed(() => new Map(props.graph.map((e) => [e.name, e])))
const statusLabel = (s: string | null) => (s === 'draft' ? t('editor.draft') : s === 'scheduled' ? t('editor.scheduled') : '')

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
  const out: CommandPaletteGroup<CommandPaletteItem>[] = []
  if (hits.value.length) {
    out.push({
      id: 'entries',
      label: t('search.entries'),
      // Already matched (and ranked) by the server: shown as they come.
      ignoreFilter: true,
      items: hits.value.map((h) => {
        const e = byName.value.get(h.entity)
        const kind = e ? entitySingular(e) : h.entity
        return {
          id: `${h.entity}:${h.id}`,
          label: h.title || t('search.untitled'),
          description: h.excerpt || undefined,
          suffix: [kind, statusLabel(h.status)].filter(Boolean).join(' · '),
          icon: e?.icon ?? 'i-lucide-file',
          to: `/admin/${h.entity}/${h.id}`,
        }
      }),
    })
  }
  out.push({ id: 'places', label: t('search.places'), items: props.places })
  return out
})

const empty = computed(() => (loading.value || term.value.trim().length < 2 ? t('search.typeMore') : t('search.nothing', { query: searched.value || term.value.trim() })))
</script>

<template>
  <UDashboardSearch
    v-model:search-term="term"
    :groups="groups"
    :loading="loading"
    :color-mode="false"
    :title="t('search.title')"
    :description="t('search.description')"
    :placeholder="t('search.placeholder')"
    :fuse="{ resultLimit: 20, fuseOptions: { keys: ['label'] } }"
    :ui="{ itemDescription: 'line-clamp-2 whitespace-normal' }"
  >
    <template #empty>
      <p class="py-6 text-center text-sm text-muted">{{ empty }}</p>
    </template>
  </UDashboardSearch>
</template>
