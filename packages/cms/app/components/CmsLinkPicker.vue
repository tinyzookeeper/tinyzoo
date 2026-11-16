<script setup lang="ts">
// Pick what a link points to: a page or entry of this website (found by its title,
// with its address in the language being edited), or an address typed or pasted
// into the box. An inline panel: rich text, menus and link fields put it in their
// own popover. Emits the address and, for a picked entry, its title.
const props = defineProps<{ initial?: string | null; locale?: string | null }>()
const emit = defineEmits<{ pick: [href: string, title?: string] }>()
const { t, entityLabel } = useCmsI18n()
const route = useRoute()
const graph = useNuxtData<any[]>('cms-graph').data

const term = ref(props.initial ?? '')
const items = ref<{ entity: string; id: string; title: string; path: string; published: boolean }[]>([])
const loading = ref(false)
const active = ref(0)
const input = ref<any>(null)

let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined
async function load() {
  const my = ++seq
  loading.value = true
  try {
    const locale = props.locale ?? (typeof route.query.locale === 'string' ? route.query.locale : undefined)
    const q = looksLikeAddress(term.value) ? undefined : term.value.trim() || undefined
    const res = await cmsFetch<{ items: typeof items.value }>('/api/cms/_links', { query: { q, locale } })
    if (my === seq) items.value = res.items
  }
  catch {
    if (my === seq) items.value = []
  }
  finally {
    if (my === seq) loading.value = false
  }
}
watch(term, () => {
  clearTimeout(timer)
  active.value = 0
  timer = setTimeout(load, 180)
})
onMounted(() => {
  load()
  nextTick(() => input.value?.inputRef?.focus?.())
})
onBeforeUnmount(() => clearTimeout(timer))

/** An address, not a search: /page, https://…, mailto:, tel:, #anchor, or a bare domain. */
function looksLikeAddress(v: string): boolean {
  const s = v.trim()
  return /^(\/|#|https?:\/\/|mailto:|tel:)/i.test(s) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)
}
const typed = computed(() => {
  const s = term.value.trim()
  if (!s || !looksLikeAddress(s)) return null
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s) && !s.includes('@') ? `https://${s}` : s
})

type Option = { key: string; label: string; hint?: string; badge?: string; icon: string; href: string; title?: string }
const options = computed<Option[]>(() => {
  const out: Option[] = []
  if (typed.value) out.push({ key: 'typed', label: t('link.typed', { url: typed.value }), icon: 'i-lucide-corner-down-left', href: typed.value })
  for (const it of items.value) {
    const meta = graph.value?.find((e: any) => e.name === it.entity)
    out.push({
      key: `${it.entity}:${it.id}`, label: it.title || it.path, hint: `${meta ? entityLabel(meta) : it.entity} · ${it.path}`,
      badge: it.published ? undefined : t('link.draft'), icon: meta?.icon ?? 'i-lucide-file', href: it.path, title: it.title,
    })
  }
  return out
})

function choose(o: Option | undefined) {
  if (o) emit('pick', o.href, o.title)
}
function onKey(e: KeyboardEvent) {
  const n = options.value.length
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = n ? (active.value + 1) % n : 0 }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = n ? (active.value - 1 + n) % n : 0 }
  else if (e.key === 'Enter') { e.preventDefault(); choose(options.value[active.value]) }
}
const listId = useId()
</script>

<template>
  <div class="w-[min(26rem,calc(100vw-2rem))]">
    <div class="p-2 border-b border-default">
      <UInput
        ref="input" v-model="term" :placeholder="t('link.search')" icon="i-lucide-search" :loading="loading"
        class="w-full" autocomplete="off" role="combobox" :aria-expanded="true" :aria-controls="listId"
        :aria-activedescendant="options[active] ? `${listId}-${active}` : undefined" :aria-label="t('link.search')"
        @keydown="onKey"
      />
    </div>
    <ul :id="listId" role="listbox" :aria-label="t('link.onSite')" class="max-h-72 overflow-y-auto p-1">
      <li
        v-for="(o, i) in options" :id="`${listId}-${i}`" :key="o.key" role="option" :aria-selected="i === active"
        class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5"
        :class="i === active ? 'bg-elevated' : 'hover:bg-elevated/60'"
        @mouseenter="active = i" @mousedown.prevent @click="choose(o)"
      >
        <UIcon :name="o.icon" class="size-4 shrink-0 text-muted" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm text-highlighted">{{ o.label }}</span>
          <span v-if="o.hint" class="block truncate text-xs text-muted font-mono">{{ o.hint }}</span>
        </span>
        <UBadge v-if="o.badge" color="neutral" variant="soft" size="sm" class="shrink-0">{{ o.badge }}</UBadge>
      </li>
      <li v-if="!options.length && !loading" class="px-2 py-3 text-sm text-muted text-pretty">{{ t('link.none') }}</li>
    </ul>
  </div>
</template>
