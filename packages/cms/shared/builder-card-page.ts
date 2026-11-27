// The page's side of a card bound to a content type (docs/builder-plan.md, part 3c, second half): what the
// overlay in the preview decides about a section whose card repeats once per entry. Each card draws the
// same blocks of one design, so a block of the design stands once per card with the same id; the card the
// person clicked is the one the tools stand in. The admin says what each block of the design shows
// (`cms:builder:cards`, built by `cardPageCards` in builder-card.ts with the panel's words), so nothing here
// guesses: the entry is the card's, the field is the block's. Pure functions of their arguments.
import type { CmsBuilderCardBlock, CmsBuilderTry } from './builder'

/** A card of a section as the page marks it while editing: its entry's id, else its place (a sample card, an empty card). */
export function cardPageKey(entry: string | null | undefined, place: string | null | undefined): string {
  return entry ? entry : `@${place ?? ''}`
}

/** What the section's chip and toolbar say: the type's name and how often the card repeats ("Kurzy 6×"); the name alone with no entries. */
export function cardSectionName(label: string, count: number): { label: string; shows: string } {
  return { label, shows: Number.isInteger(count) && count > 0 ? `${count}×` : '' }
}

/** What a block's chip and toolbar say: its name and what it shows ("Text", "← Cena"); a group says how many blocks it holds. */
export function cardBlockName(block: CmsBuilderCardBlock | null | undefined, fallback: string): { label: string; shows: string; warn: boolean } {
  if (!block) return { label: fallback, shows: '', warn: false }
  return { label: block.label || fallback, shows: block.shows, warn: !!block.warn }
}

/** The two parts as one line ("Text ← Cena"). */
export const cardNameLine = (name: { label: string; shows: string }): string => [name.label, name.shows].filter(Boolean).join(' ')

/**
 * How a double click on a value a card's block shows changes it, by the field's kind: a plain text is typed
 * where it stands (`text`, 2g's typing, when the entry's field is a plain text), a rich text and a value that
 * has a control of its own (a number, a date, a choice, a link, an e-mail) get 2g's box (`rich`, `value`), and
 * what the page has no control for (a picture, a file, the entry's page) opens the whole entry beside the
 * page with that field in view (`entry`). `null`: the block shows no field of an entry (its own text, nothing).
 */
export function cardValueEdit(block: CmsBuilderCardBlock | null | undefined): { how: 'text' | 'rich' | 'value'; field: string } | { how: 'entry'; field: string | null } | null {
  if (!block || block.group || !block.field) return null
  switch (block.kind) {
    case 'text': case 'longText': return { how: 'text', field: block.field }
    case 'richText': return { how: 'rich', field: block.field }
    case 'number': case 'date': case 'choice': case 'link': case 'email': case 'yesNo': case 'color': return { how: 'value', field: block.field }
    case 'page': return { how: 'entry', field: null }
    default: return { how: 'entry', field: block.field }
  }
}

/**
 * Where a small chip with a block's field stands on the block (the card under the pointer, the section
 * selected): inside its top right corner, or across its middle when the block is lower than the chip
 * with its margins. `width` and `height` are the chip's on the screen in the page's pixels; `k` the page
 * pixels per screen pixel.
 */
export function cardChipAt(rect: { left: number; top: number; width: number; height: number }, width: number, height: number, k = 1): { left: number; top: number } {
  const left = Math.max(rect.left + 2 * k, rect.left + rect.width - width - 4 * k)
  const top = rect.height < height + 8 * k ? rect.top + rect.height / 2 - height / 2 : rect.top + 4 * k
  return { left, top }
}

/** The delay of the n-th card's value coming in after a field was chosen (ms): a short stagger, at most a dozen steps; none with reduced motion. */
export function cardStagger(index: number, reduced: boolean): number {
  return reduced || !(index > 0) ? 0 : Math.min(Math.floor(index), 11) * 55
}

/**
 * Whether the page's own data now holds a chosen field (`tried.chosen`): the block's reference in the admin's
 * draft is the tried value (an empty reference is `''` or none). Until then the page keeps drawing it.
 */
export function cardTryLanded(drafted: unknown, tried: Pick<CmsBuilderTry, 'value'> | null | undefined): boolean {
  if (!tried) return false
  const now = drafted === null || drafted === undefined ? '' : typeof drafted === 'string' ? drafted.trim() : null
  return now !== null && now === tried.value.trim()
}

/**
 * Of the parts of a block (its elements and the text nodes beside other content, in the page's order, each with
 * its text in the normal form), the one that shows exactly `value` (also in the normal form): the last of them,
 * which is the smallest (a part comes before the parts inside it). `null` when none does.
 */
export function cardValuePart<N>(parts: readonly { node: N; text: string }[], value: string): N | null {
  if (!value) return null
  let found: N | null = null
  for (const p of parts) if (p.text === value) found = p.node
  return found
}
