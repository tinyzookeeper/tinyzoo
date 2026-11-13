import { stableJson as stable } from '../../shared/json'

/** Key-order-insensitive JSON (see shared/json.ts). */
export function stableJson(value: unknown): string {
  return stable(value)
}

/** Rich text with nothing in it (no nodes, or only empty paragraphs) — the same as no value. */
export function isEmptyRichText(value: any): boolean {
  if (value === null || value === undefined) return true
  if (value?.type !== 'doc') return false
  return !(value.content ?? []).some((n: any) => n?.type !== 'paragraph' || n.content?.length)
}

/** Do two rich-text values say the same thing (key order and emptiness aside)? */
export function sameRichText(a: unknown, b: unknown): boolean {
  if (isEmptyRichText(a) && isEmptyRichText(b)) return true
  return stableJson(a) === stableJson(b)
}
