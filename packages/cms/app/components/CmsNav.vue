<script setup lang="ts">
// A site menu from the CMS (defineNavigation): links with their dropdowns, as plain
// nested lists — style it like any list. Internal links go through NuxtLink; external
// ones and "open in a new tab" links open safely. A link whose page is gone or not
// published (no `url`) is left out; one that still has working dropdown links stays as
// a heading without a link.
//
//   const { data: nav } = await useFetch('/api/content/_global/navigation')
//   <CmsNav :links="nav?.item?.main" aria-label="Hlavní menu" />
const props = defineProps<{ links: { id: string; label: string; url: string | null; newTab?: boolean | null; sub?: boolean | null }[] | null | undefined }>()
const tree = computed(() => {
  const out: any[] = []
  for (const l of props.links ?? []) {
    const parent = out[out.length - 1]
    if (l.sub && parent) parent.children.push(l)
    else out.push({ ...l, children: [] })
  }
  return out
    .map((l) => ({ ...l, children: l.children.filter((c: any) => !!c.url) }))
    .filter((l) => !!l.url || l.children.length > 0)
})
const external = (url: string) => /^(https?:)?\/\//.test(url) || /^(mailto|tel):/.test(url)
</script>

<template>
  <nav class="cms-nav">
    <ul>
      <li v-for="l in tree" :key="l.id" :class="l.children.length ? 'cms-nav__has-children' : undefined">
        <NuxtLink v-if="l.url" :to="l.url" :external="external(l.url)" :target="l.newTab ? '_blank' : undefined" :rel="l.newTab || external(l.url) ? 'noopener' : undefined">{{ l.label }}</NuxtLink>
        <span v-else>{{ l.label }}</span>
        <ul v-if="l.children.length">
          <li v-for="c in l.children" :key="c.id">
            <NuxtLink :to="c.url" :external="external(c.url)" :target="c.newTab ? '_blank' : undefined" :rel="c.newTab || external(c.url) ? 'noopener' : undefined">{{ c.label }}</NuxtLink>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
