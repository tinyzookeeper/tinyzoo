import { stableJson as stable } from '../../shared/json'
import { formJson as form, withoutTrailingEmpty } from '../../shared/richtext-normalize'

/** Key-order-insensitive JSON (see shared/json.ts). */
export function stableJson(value: unknown): string {
  return stable(value)
}

/** Like `stableJson`, for comparing form values: rich text without its trailing empty paragraphs. */
export function cmsFormJson(value: unknown): string {
  return form(value)
}

/** Rich text with nothing in it (no nodes, or only empty paragraphs) — the same as no value. */
export function isEmptyRichText(value: any): boolean {
  if (value === null || value === undefined) return true
  if (value?.type !== 'doc') return false
  return !(value.content ?? []).some((n: any) => n?.type !== 'paragraph' || n.content?.length)
}

/**
 * Do two rich-text values say the same thing? Key order, emptiness and the empty
 * paragraph the editor puts after a last heading or list do not count.
 */
export function sameRichText(a: unknown, b: unknown): boolean {
  if (isEmptyRichText(a) && isEmptyRichText(b)) return true
  return stableJson(withoutTrailingEmpty(a)) === stableJson(withoutTrailingEmpty(b))
}
