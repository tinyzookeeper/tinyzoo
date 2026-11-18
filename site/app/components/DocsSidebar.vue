<script setup lang="ts">
// The documentation's table of contents: both parts, the current one open with its
// chapters (grouped for developers), the other one as a link. In the sidebar on wide
// screens and in the drawer on phones.
import type { DocsNav, DocsSection } from '#shared/docs'
import { docsPath } from '#shared/docs'

const props = defineProps<{ nav: DocsNav; section: DocsSection; current: string }>()
defineEmits<{ search: [] }>()
const { lang, t } = useLang()
const order = computed<DocsSection[]>(() => (props.section === 'developers' ? ['developers', 'editors'] : ['editors', 'developers']))
</script>

<template>
  <nav class="docs-nav" :aria-label="t('docsContents')">
    <NuxtLink :to="docsPath(lang)" class="docs-nav-home">
      <UIcon name="i-lucide-book-open" class="size-4" aria-hidden="true" />{{ t('docs') }}
    </NuxtLink>
    <button type="button" class="docs-nav-search" @click="$emit('search')">
      <UIcon name="i-lucide-search" class="size-4" aria-hidden="true" /><span class="docs-nav-search-label">{{ t('docsSearch') }}</span><kbd aria-hidden="true">⌘K</kbd>
    </button>
    <div v-for="s in order" :key="s" class="docs-nav-part" :class="s === section ? 'docs-nav-part--on' : ''">
      <NuxtLink :to="nav.sections[s].path" class="docs-nav-part-title" :aria-current="current === nav.sections[s].path ? 'page' : undefined">
        {{ nav.sections[s].title }}
        <span v-if="nav.sections[s].textLang !== lang" class="docs-pill">{{ t('docsInEnglish') }}</span>
      </NuxtLink>
      <template v-if="s === section">
        <div v-for="g in nav.sections[s].groups" :key="g.id" class="docs-nav-group">
          <p v-if="nav.sections[s].groups.length > 1" class="docs-nav-group-title">{{ g.title }}</p>
          <ul :lang="nav.sections[s].textLang">
            <li v-for="p in g.pages" :key="p.path">
              <NuxtLink :to="p.path" :aria-current="current === p.path ? 'page' : undefined">{{ p.title }}</NuxtLink>
            </li>
          </ul>
        </div>
      </template>
    </div>
  </nav>
</template>

<style>
.docs-nav { display: grid; gap: 0.25rem; font-size: 0.9375rem; }
.docs-nav-home { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0; font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-mute); }
.docs-nav-home:hover { color: var(--color-ink); }
.docs-nav-search { display: flex; align-items: center; gap: 0.5rem; width: 100%; min-height: 2.75rem; margin: 0.5rem 0 1rem; padding: 0 0.75rem; border-radius: 0.75rem; background: #fff; box-shadow: inset 0 0 0 1.5px rgb(19 19 19 / 0.12); color: var(--color-mute); font-size: 0.9375rem; text-align: left; transition: box-shadow .15s ease; }
.docs-nav-search:hover { box-shadow: inset 0 0 0 1.5px rgb(19 19 19 / 0.35); color: var(--color-ink); }
.docs-nav-search-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (hover: none) { .docs-nav-search kbd { display: none; } }
.docs-nav-search kbd { padding: 0.05rem 0.375rem; border-radius: 0.375rem; background: var(--color-cream); font-family: var(--font-mono); font-size: 0.6875rem; color: var(--color-ink); }
.docs-nav-part + .docs-nav-part { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgb(19 19 19 / 0.08); }
.docs-nav-part-title { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; min-height: 2.5rem; padding: 0.375rem 0.75rem; border-radius: 0.625rem; font-family: var(--font-display); font-weight: 800; letter-spacing: -0.01em; color: var(--color-ink); }
.docs-nav-part:not(.docs-nav-part--on) .docs-nav-part-title { color: rgb(19 19 19 / 0.7); }
.docs-nav-part-title:hover { background: rgb(19 19 19 / 0.04); color: var(--color-ink) !important; }
.docs-nav-part-title[aria-current="page"] { background: var(--color-cream); }
.docs-nav-group { margin-top: 0.375rem; }
.docs-nav-group-title { padding: 0.75rem 0.75rem 0.25rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-mute); }
.docs-nav ul { display: grid; gap: 1px; }
.docs-nav ul a { display: block; padding: 0.5rem 0.75rem; border-radius: 0.625rem; line-height: 1.35; color: rgb(19 19 19 / 0.72); transition: background-color .15s ease, color .15s ease; }
.docs-nav ul a:hover { color: var(--color-ink); background: rgb(19 19 19 / 0.04); }
.docs-nav ul a[aria-current="page"] { color: var(--color-ink); font-weight: 700; background: var(--color-cream); }
.docs-pill { display: inline-flex; align-items: center; padding: 0.125rem 0.5rem; border-radius: 999px; background: var(--color-cream); font-family: var(--font-sans, inherit); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.02em; color: var(--color-mute); white-space: nowrap; }
</style>
