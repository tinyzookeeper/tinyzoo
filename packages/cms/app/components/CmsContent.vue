<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from 'vue'
import type { CmsContentNode as Node, CmsContentProps } from '../../src/frontend'

// Renders a stored TipTap/ProseMirror JSON doc to HTML for consumer frontends.
// Built from structured nodes via h() — no v-html — so stored content can't inject
// markup/script. Covers the StarterKit node/mark set.

// Only emit hrefs with a safe scheme — a stored `javascript:`/`data:` link mark
// would otherwise be clickable stored-XSS in the visitor's origin.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F]/
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
function safeHref(u: unknown): string | null {
  const s = String(u ?? '').trim()
  if (CONTROL_CHARS.test(s)) return null // reject control chars (validator/sink differential)
  try {
    return SAFE_SCHEMES.has(new URL(s, 'https://x.invalid').protocol) ? s : null
  } catch {
    return null
  }
}

// Image src: only http(s) or relative (a stored `javascript:`/`data:` src is dropped).
function safeSrc(u: unknown): string | null {
  const s = String(u ?? '').trim()
  if (!s || CONTROL_CHARS.test(s)) return null
  try {
    const proto = new URL(s, 'https://x.invalid').protocol
    return proto === 'http:' || proto === 'https:' ? s : null
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
      // Links to other sites open in a new tab; the site's own pages, mail and phone do not.
      if (href) node = h('a', /^(?:https?:)?\/\//i.test(href) ? { href, rel: 'noopener noreferrer', target: '_blank' } : { href }, node)
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
    case 'image': {
      const src = safeSrc(node.attrs?.src)
      return src ? h('img', { src, alt: node.attrs?.alt ?? '', loading: 'lazy', decoding: 'async' }) : null
    }
    case 'text': return withMarks(node.text ?? '', node.marks)
    default: return kids.length ? kids : null
  }
}

export default defineComponent({
  name: 'CmsContent',
  props: { doc: { type: Object as PropType<CmsContentProps['doc']>, default: null } },
  setup(props) {
    return () => h('div', { class: 'cms-content' }, render(props.doc) as any)
  },
})
</script>

<style>
/*
 * Defaults only, in the base layer: they beat the CSS reset but lose to anything
 * the host site styles (its components, utilities and own unlayered CSS).
 */
@layer base {
  .cms-content h2 { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
  .cms-content h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
  .cms-content p { margin: 0.75rem 0; line-height: 1.7; }
  .cms-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
  .cms-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.75rem 0; }
  .cms-content blockquote { font-style: italic; opacity: 0.85; padding-left: 1.25rem; margin: 0.75rem 0; }
  .cms-content code { font-family: ui-monospace, monospace; background: rgb(127 127 127 / 0.15); padding: 0.1em 0.3em; border-radius: 0.25rem; font-size: 0.9em; }
  .cms-content pre { background: rgb(127 127 127 / 0.12); padding: 0.75rem 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.75rem 0; }
  .cms-content pre code { background: none; padding: 0; }
  .cms-content a { color: var(--ui-primary, currentColor); text-decoration: underline; }
  .cms-content img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0; }
}
</style>
