/**
 * Comparing rich text the way a person reads it: the editor adds an empty paragraph
 * after a last heading, list or quote, and empty text is the same as no text. Shared
 * by the admin (is the form unsaved?) and the server (is the shared document ahead of
 * the saved entry?).
 */
import { stableJson } from './json'

const emptyParagraph = (n: any) => n?.type === 'paragraph' && !(n.content?.length)

/** The document without empty paragraphs at its end (the same document when there are none). */
export function withoutTrailingEmpty<T>(doc: T): T {
  const d = doc as any
  if (!d || d.type !== 'doc' || !Array.isArray(d.content)) return doc
  let end = d.content.length
  while (end > 0 && emptyParagraph(d.content[end - 1])) end--
  return end === d.content.length ? doc : ({ ...d, content: d.content.slice(0, end) } as T)
}

/** A value with every rich-text document inside it (also within blocks and groups) trimmed that way. */
export function withoutTrailingEmptyDeep(value: any): any {
  if (Array.isArray(value)) return value.map(withoutTrailingEmptyDeep)
  if (value && typeof value === 'object') {
    if (value.type === 'doc' && Array.isArray(value.content)) return withoutTrailingEmpty(value)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutTrailingEmptyDeep(v)]))
  }
  return value
}

/** Stable JSON of a form value, rich text compared without its trailing empty paragraphs. */
export function formJson(value: unknown): string {
  return stableJson(withoutTrailingEmptyDeep(value))
}
