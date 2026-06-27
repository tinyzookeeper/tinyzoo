<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from 'vue'

// Renders a stored TipTap/ProseMirror JSON doc to HTML for consumer frontends.
// Built from structured nodes via h() — no v-html — so stored content can't inject
// markup/script. Covers the StarterKit node/mark set.
type Node = { type: string; content?: Node[]; text?: string; marks?: any[]; attrs?: any }

// Only emit hrefs with a safe scheme — a stored `javascript:`/`data:` link mark
// would otherwise be clickable stored-XSS in the visitor's origin.
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
function safeHref(u: unknown): string | null {
  const s = String(u ?? '').trim()
  try {
    return SAFE_SCHEMES.has(new URL(s, 'https://x.invalid').protocol) ? s : null
  } catch {
    return null
  }
}

function withMarks(text: string, marks: any[] = []): VNode | string {
  let node: VNode | string = text
  for (const m of marks) {
    if (m.type === 'bold') node = h('strong', node)
    else if (m.type === 'italic') node = h('em', node)
    else if (m.type === 'strike') node = h('s', node)
    else if (m.type === 'code') node = h('code', node)
    else if (m.type === 'link') {
      const href = safeHref(m.attrs?.href)
      if (href) node = h('a', { href, rel: 'noopener noreferrer', target: '_blank' }, node)
    }
  }
  return node
}

function render(node: Node | null | undefined): any {
  if (!node) return null
  const kids = (node.content ?? []).map(render).flat().filter((v) => v != null)
  switch (node.type) {
    case 'doc': return kids
    case 'paragraph': return h('p', kids)
    // Clamp to h1–h6 — never interpolate a stored value into the tag name (SSR injection).
    case 'heading': return h(`h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))}`, kids)
    case 'bulletList': return h('ul', kids)
    case 'orderedList': return h('ol', kids)
    case 'listItem': return h('li', kids)
    case 'blockquote': return h('blockquote', kids)
    case 'codeBlock': return h('pre', [h('code', kids)])
    case 'horizontalRule': return h('hr')
    case 'hardBreak': return h('br')
    case 'text': return withMarks(node.text ?? '', node.marks)
    default: return kids.length ? kids : null
  }
}

export default defineComponent({
  name: 'CmsContent',
  props: { doc: { type: Object as PropType<Node | null>, default: null } },
  setup(props) {
    return () => h('div', { class: 'cms-content' }, render(props.doc) as any)
  },
})
</script>

<style scoped>
.cms-content :deep(h2) { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
.cms-content :deep(h3) { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
.cms-content :deep(p) { margin: 0.75rem 0; line-height: 1.7; }
.cms-content :deep(ul) { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
.cms-content :deep(ol) { list-style: decimal; padding-left: 1.5rem; margin: 0.75rem 0; }
.cms-content :deep(blockquote) { border-left: 3px solid currentColor; opacity: 0.85; padding-left: 1rem; margin: 0.75rem 0; }
.cms-content :deep(code) { font-family: ui-monospace, monospace; background: rgb(127 127 127 / 0.15); padding: 0.1em 0.3em; border-radius: 0.25rem; font-size: 0.9em; }
.cms-content :deep(pre) { background: rgb(127 127 127 / 0.12); padding: 0.75rem 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.75rem 0; }
.cms-content :deep(pre code) { background: none; padding: 0; }
.cms-content :deep(a) { color: var(--ui-primary, currentColor); text-decoration: underline; }
</style>
