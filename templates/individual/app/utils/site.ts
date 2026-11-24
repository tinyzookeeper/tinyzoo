// The Freelancer and consultant template's own helpers: its words, the addresses of entries,
// and small things the looks all need (initials, a result in numbers, a date). The content is
// in the CMS; Nuxt auto-imports what is exported here.
// (Addresses, prices and dates are the template kit's: templates/kit/app/utils/format.ts.)
// (relative addresses, not `~/…`: the unit specs load this file outside Nuxt, where the alias means nothing)
import type { EntryPage } from '../../../kit/app/utils/blocks'
import type { Page } from '../lib/cms-content'
import { words as cs, type Words } from '../../texts/cs'

export const DEFAULT_LANGUAGE = 'cs'
export type { Words }
export const WORDS: Record<string, Words> = { cs }
export const wordsOf = (code: string): Words => WORDS[code] ?? WORDS[DEFAULT_LANGUAGE]!

/** The addresses that lead to an entry instead of a page from blocks: a project and an article. */
export const ENTRY_PAGES: EntryPage[] = [
  { kind: 'project', prefix: 'zakazky', entity: 'project', part: 'Project', descriptionField: 'done', imageField: 'image' },
  { kind: 'article', prefix: 'blog', entity: 'article', part: 'Article', descriptionField: 'excerpt', imageField: 'image' },
]

/** A page's block of one type, typed from the generated client. */
export type BlockOf<T extends Page['sections'][number]['type']> = Extract<Page['sections'][number], { type: T }>

/** The address of a block's section on its page: `sluzby` (for `/#sluzby`). Null for a block without one. */
export function anchorOf(type: string, lang: string = DEFAULT_LANGUAGE): string | undefined {
  return (wordsOf(lang).anchors as Record<string, string>)[type]
}

/** The address of a project's page and of an article's page. */
export const projectHref = (slug: string): string => `/zakazky/${slug}`
export const articleHref = (slug: string): string => `/blog/${slug}`

/**
 * Czech typography for running text (the kit's `tidyText`), and "e-mail" or "e-shop" kept in
 * one piece: a word joiner on both sides of the hyphen, so a line never breaks inside it.
 */
export function czText(text: string | null | undefined): string {
  return tidyText(text).replace(/\b([Ee])-(?=mail|shop)/g, '$1⁠-⁠')
}

/** "Magda Šubrtová" → "MŠ": the initials of the first and the last word. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const letter = (w: string | undefined) => (w?.[0] ?? '').toUpperCase()
  return words.length > 1 ? letter(words[0]) + letter(words[words.length - 1]) : letter(words[0])
}

/** "4 → 11" → ["4", "11"]; a result without an arrow ("1 ze 3") → one part. The looks draw the arrow as an icon. */
export function resultParts(result: string | null | undefined): string[] {
  return (result ?? '').split(/\s*[→>]\s*/).map((s) => s.trim()).filter(Boolean)
}

/** A date the short way a blog writes it: "12. 11. 2026" (with non-breaking spaces). */
export function shortDate(iso: string | null | undefined): string {
  const d = dateParts(iso)
  return d ? `${d.day}. ${d.monthNumber}. ${d.year}` : ''
}

/** "Máte web hotový a nevíte, proč neprodává." → "máte web hotový a nevíte, proč neprodává": a sentence that continues after a label ("Pro koho: …"). */
export function continued(text: string | null | undefined): string {
  const t = (text ?? '').trim().replace(/\.$/, '')
  // (an acronym or a name keeps its capital: only a word that starts with a capital and goes on in lower case is lowered)
  return /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]/.test(t) ? t[0]!.toLowerCase() + t.slice(1) : t
}

/** 7 → "07": the number of a row in a list that counts. */
export const pad2 = (n: number): string => String(n).padStart(2, '0')
