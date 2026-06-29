import { z } from 'zod'

/**
 * Minimal ProseMirror/TipTap-style document. Stored as jsonb. Sanitized on WRITE
 * (see richTextSchema below) AND again at render by CmsContent — defense in depth —
 * so the doc is safe even for a consumer that renders it without CmsContent. Still:
 * never render rich text with raw `v-html`; use a structured renderer.
 */
export type RichTextDoc = { type: 'doc', content?: unknown[] }

const SAFE_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_IMG_SCHEMES = new Set(['http:', 'https:'])
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1F]/

/** Scheme allowlist check. Rejects control chars (closes a validator/sink differential). */
function schemeAllowed(u: unknown, allowed: Set<string>): boolean {
  const s = String(u ?? '')
  if (CONTROL_CHARS.test(s)) return false
  try {
    return allowed.has(new URL(s.trim(), 'https://x.invalid').protocol)
  } catch {
    return false
  }
}

function sanitizeNode(node: any): void {
  if (!node || typeof node !== 'object') return
  // Drop link marks with an unsafe href (javascript:/data:/… → keep the text, lose the link).
  if (Array.isArray(node.marks)) {
    node.marks = node.marks.filter((m: any) => !(m?.type === 'link' && !schemeAllowed(m?.attrs?.href, SAFE_LINK_SCHEMES)))
  }
  // Blank an unsafe image src (CmsContent then renders nothing for it).
  if (node.type === 'image' && node.attrs && !schemeAllowed(node.attrs.src, SAFE_IMG_SCHEMES)) {
    node.attrs.src = ''
  }
  // Clamp heading level to 1–6 (never a value that could become an odd tag).
  if (node.type === 'heading' && node.attrs) {
    node.attrs.level = Math.min(6, Math.max(1, Number(node.attrs.level) || 2))
  }
  if (Array.isArray(node.content)) for (const child of node.content) sanitizeNode(child)
}

/** Neutralize XSS-unsafe attrs in a stored doc. Mutates in place; returns the doc. */
export function sanitizeRichText(doc: RichTextDoc): RichTextDoc {
  if (Array.isArray(doc?.content)) for (const node of doc.content) sanitizeNode(node)
  return doc
}

// Permissive structure, but every write is sanitized via the transform.
export const richTextSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.any()).optional(),
}).transform(sanitizeRichText) as unknown as z.ZodType<RichTextDoc>

export const emptyDoc: RichTextDoc = { type: 'doc', content: [] }
