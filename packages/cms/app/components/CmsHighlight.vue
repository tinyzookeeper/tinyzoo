<script setup lang="ts">
// Text with the searched words marked: <CmsHighlight :text="r.excerpt" :ranges="r.highlights" />
// renders <mark> around each [start, end) range (as the search API returns them).
import type { CmsHighlightProps } from '../../src/frontend'

const props = defineProps<CmsHighlightProps>()
const parts = computed(() => {
  const out: { text: string; mark: boolean }[] = []
  let at = 0
  const ranges = [...(props.ranges ?? [])].sort((a, b) => a[0] - b[0])
  for (const [s, e] of ranges) {
    if (s < at || e <= s || e > props.text.length) continue
    if (s > at) out.push({ text: props.text.slice(at, s), mark: false })
    out.push({ text: props.text.slice(s, e), mark: true })
    at = e
  }
  if (at < props.text.length) out.push({ text: props.text.slice(at), mark: false })
  return out
})
</script>

<template>
  <span><template v-for="(p, i) in parts" :key="i"><mark v-if="p.mark">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template></span>
</template>
