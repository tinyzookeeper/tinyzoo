/**
 * JSON for comparing values: object keys sorted, so the same value compares equal
 * however it was built — Postgres stores jsonb with its keys reordered, and the
 * editor builds them in its own order.
 */
export function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v)
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
