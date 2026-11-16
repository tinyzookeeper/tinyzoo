import { z } from 'zod'
import { isLinkRef } from './linkref'

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

/**
 * Safe as a link target: a site path, #anchor, http(s)/mailto/tel, or a reference to
 * an entry of this site (`cms:<entity>/<id>`, which the content API turns into the
 * entry's address — see links.ts). No control chars or spaces.
 */
export function isSafeLink(u: unknown): boolean {
  const s = String(u ?? '')
  if (!s || /\s/.test(s)) return false
  return isLinkRef(s) || schemeAllowed(s, SAFE_LINK_SCHEMES)
}

function sanitizeNode(node: any): void {
  if (!node || typeof node !== 'object') return
  // Drop link marks with an unsafe href (javascript:/data:/… → keep the text, lose the link).
  if (Array.isArray(node.marks)) {
    node.marks = node.marks.filter((m: any) => !(m?.type === 'link' && !(isLinkRef(m?.attrs?.href) || schemeAllowed(m?.attrs?.href, SAFE_LINK_SCHEMES))))
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

/**
 * Changes to the stored shape of a rich-text document, for when a TipTap upgrade
 * renames a node or an attribute. Each step takes a document and returns it in the
 * new shape; steps run in order on every read (content API, admin, search) and in
 * `tinyzoo content:migrate`, so they must be idempotent (renaming `oldNode` to
 * `newNode` is; "wrap every list" is not). Empty today.
 *
 *   richTextUpgrades.push({ id: 'tiptap-3-rename-callout', upgrade: (doc) => renameNodes(doc, 'callout', 'note') })
 */
export interface RichTextUpgrade { id: string; upgrade: (doc: RichTextDoc) => RichTextDoc }
export const richTextUpgrades: RichTextUpgrade[] = []

/** A stored document in the current shape. The same object when there are no steps (or it is not a document). */
export function upgradeRichText<T>(doc: T): T {
  if (!richTextUpgrades.length || !doc || typeof doc !== 'object' || (doc as any).type !== 'doc') return doc
  let out = structuredClone(doc) as unknown as RichTextDoc
  for (const step of richTextUpgrades) out = step.upgrade(out)
  return out as unknown as T
}
