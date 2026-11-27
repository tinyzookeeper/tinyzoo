// What the kit reads from a list with a card of the owner's own (`section_list`, kitSections()) before it
// draws it: the type it shows, the order and how many (tinyzoo's customTypeCard()), the card's small
// blocks, each naming the field it shows (customTypeFieldRef()), and the section's settings. Plain
// functions of their arguments, so the unit specs test them without Nuxt
// (test/unit/template-kit-card.spec.ts). (No imports but the kit's own pure helpers: sections.ts takes
// the table of what each block shows from here when the config loads.)
//
// The card is one design: its blocks are read once (cardListPlan), then filled from each entry
// (cardEntries). The field's kind (`kind` of GET /api/content/_types) decides how a value is read and
// narrowed. Drawing never fails:
//
//  - an entry's empty value leaves that block out of that entry's card (a group with nothing left too,
//    and a card with nothing left);
//  - a block with no field and no text of its own, a field the type does not have or whose kind the
//    block does not take, and a button without its text are left out on the website;
//  - a section with no type, a type the site does not have, or no entries draws nothing.
//
// While an editor works on the page (`editing`, from useCmsEditing()) a block that shows nothing is kept
// as a placeholder with its state (`unbound`: no field chosen yet; `missing`: the type has no such field;
// `unfit`: the field's kind does not fit the block; `label`: a button without its text), a type with
// no entries gives one sample card that names the fields, and a card with no blocks one empty card.
import type { CustomFieldKind } from 'tinyzoo'
import type { LayoutSize } from './layout'
import { customFieldOf, customLabel, customListRequest, customTypeOf, type CustomMedia, type CustomRequest, type CustomRichDoc, type CustomType, type CustomTypeField } from './customTypes'
import { SITE_TIME_ZONE, siteHref } from './format'

type Rec = Record<string, any>
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback)

// ── the table and the choices ──

/**
 * Which kinds of field each small block of a card shows (docs/builder-plan.md, part 3): one constant,
 * which the blocks' definitions (`customTypeFieldRef({ takes })`) and the readers both take.
 */
export const CARD_TAKES = {
  heading: ['text', 'number', 'date', 'choice'],
  text: ['text', 'longText', 'richText', 'number', 'date', 'choice'],
  picture: ['picture'],
  button: ['link', 'email', 'file', 'page'],
} as const satisfies Record<string, readonly CustomFieldKind[]>

/** A small block of a card that shows a field. */
export type CardBlockType = keyof typeof CARD_TAKES

/** The key a reference names for the entry's own page (tinyzoo's CUSTOM_PAGE_FIELD). */
export const CARD_PAGE_FIELD = 'slug'

/** How the entries stand: cards side by side, or rows (one entry per line, the picture at the side). The default is the first. */
export const CARD_ARRANGEMENTS = ['cards', 'rows'] as const
/** The most cards side by side. The default is the first. */
export const CARD_COLUMNS = ['3', '2', '4'] as const
/** The space between the cards (and, smaller, between a card's blocks). The default is the first. */
export const CARD_SPACES = ['medium', 'small', 'large'] as const
/** Behind each card: a soft surface (a faint tint of the look's text colour), or nothing. The default is the first. */
export const CARD_SURFACES = ['soft', 'none'] as const
/** How a heading is set. The default is the first. */
export const CARD_HEADING_SIZES = ['medium', 'large', 'small'] as const
/** The size of a text's type. The default is the first. */
export const CARD_TEXT_SIZES = ['normal', 'larger', 'small'] as const
/** How a date is written: "14. března 2027", "14. 3. 2027", "ne 14. 3.". The default is the first. */
export const CARD_DATE_FORMS = ['long', 'short', 'weekday'] as const
/** The shape of a picture: every card's picture is cut to it. The default is the first. */
export const CARD_PICTURE_SHAPES = ['landscape', 'square', 'portrait', 'original'] as const
/** How the blocks of a group stand. The default is the first. */
export const CARD_GROUP_ARRANGEMENTS = ['row', 'stack'] as const
/** How wide a small block is. The default is the first; a button's default is as wide as its text. */
export const CARD_SIZES = ['fill', 'content'] as const
/** The most blocks in a card, and in a group of it. */
export const CARD_MAX = 12
export const CARD_GROUP_MAX = 8

export type CardArrangement = (typeof CARD_ARRANGEMENTS)[number]
export type CardSpace = (typeof CARD_SPACES)[number]
export type CardSurface = (typeof CARD_SURFACES)[number]
export type CardColumns = 2 | 3 | 4
export type CardHeadingSize = (typeof CARD_HEADING_SIZES)[number]
export type CardTextSize = (typeof CARD_TEXT_SIZES)[number]
export type CardDateForm = (typeof CARD_DATE_FORMS)[number]
export type CardShape = (typeof CARD_PICTURE_SHAPES)[number]

// ── where a block's content comes from ──

/** The kind of a field: as the site's description of types gives it, else read from its form (the same table as tinyzoo's customFieldKind). */
export function cardFieldKind(field: CustomTypeField | null | undefined): CustomFieldKind | null {
  if (!field) return null
  if (typeof field.kind === 'string') return field.kind
  if (field.kind === null) return null
  switch (field.type) {
    case 'text': return field.format === 'email' ? 'email' : field.format === 'url' || field.format === 'link' ? 'link' : field.long ? 'longText' : 'text'
    case 'richtext': return 'richText'
    case 'number': return 'number'
    case 'datetime': return 'date'
    case 'select': return 'choice'
    case 'boolean': return 'yesNo'
    case 'media': return 'picture'
    case 'gallery': return 'gallery'
    case 'file': return 'file'
    case 'color': return 'color'
    case 'relation': return 'relation'
    default: return null
  }
}

/**
 * Where a block of a card takes its content from: its own text (`own`: no field named), a field of the
 * type that fits (`field`), the entry's own page (`page`); or why it shows nothing: the type has no such
 * field, or no pages for `slug` (`missing`), or the field's kind does not fit the block (`unfit`).
 * `name` is the field's name in the site's language (its key when the type no longer has it).
 */
export type CardSource =
  | { from: 'own' }
  | { from: 'field'; key: string; field: CustomTypeField; kind: CustomFieldKind; name: string }
  | { from: 'page'; key: typeof CARD_PAGE_FIELD; name: string }
  | { from: 'missing'; key: string; name: string }
  | { from: 'unfit'; key: string; name: string }

/** Where a block of the type `block` (heading, text, picture, button) takes its content from, by its reference `ref`. */
export function cardSource(block: CardBlockType, ref: unknown, type: CustomType, lang: string): CardSource {
  const key = str(ref)
  if (!key) return { from: 'own' }
  const takes = CARD_TAKES[block] as readonly CustomFieldKind[]
  if (key === CARD_PAGE_FIELD) {
    if (!type.prefix) return { from: 'missing', key, name: key }
    const name = customLabel(type.labelSingular, lang) || key
    return takes.includes('page') ? { from: 'page', key: CARD_PAGE_FIELD, name } : { from: 'unfit', key, name }
  }
  const field = customFieldOf(type, key)
  if (!field) return { from: 'missing', key, name: key }
  const name = customLabel(field.label, lang) || key
  const kind = cardFieldKind(field)
  return kind && takes.includes(kind) ? { from: 'field', key, field, kind, name } : { from: 'unfit', key, name }
}

// ── the card as designed ──

type DesignBase = { id: string; size: LayoutSize }
/** A heading: a field's value, or its own text. */
export type CardDesignHeading = DesignBase & { type: 'heading'; source: CardSource; text: string; level: CardHeadingSize }
/** A text: a field's value (a number with a text before and after it, a date in one of three forms), or its own text. */
export type CardDesignText = DesignBase & { type: 'text'; source: CardSource; text: string; before: string; after: string; date: CardDateForm; scale: CardTextSize }
/** A picture: a field's picture, cut to a shape. */
export type CardDesignPicture = DesignBase & { type: 'picture'; source: CardSource; shape: CardShape }
/** A button: a link, an e-mail, a file or the entry's page; its text is its own. */
export type CardDesignButton = DesignBase & { type: 'button'; source: CardSource; label: string }
export type CardDesignSmall = CardDesignHeading | CardDesignText | CardDesignPicture | CardDesignButton
/** A group: a row or a column of small blocks. */
export type CardDesignGroup = DesignBase & { type: 'group'; arrangement: 'row' | 'stack'; space: CardSpace; items: CardDesignSmall[] }
export type CardDesignItem = CardDesignSmall | CardDesignGroup

/** One block of the card as designed, read; null for an unknown type or a group inside a group. `index` names it when it has no id. */
export function cardDesignItem(raw: unknown, type: CustomType, lang: string, index = 0, inGroup = false): CardDesignItem | null {
  if (!isRec(raw)) return null
  const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : String(index)
  const size: LayoutSize = oneOf(raw.size, CARD_SIZES, raw.type === 'button' ? 'content' : 'fill')
  switch (raw.type) {
    case 'heading':
      return { id, size, type: 'heading', source: cardSource('heading', raw.field, type, lang), text: str(raw.text), level: oneOf(raw.level, CARD_HEADING_SIZES, 'medium') }
    case 'text':
      return {
        id, size, type: 'text', source: cardSource('text', raw.field, type, lang),
        // (a text of its own may have several lines: only its ends are trimmed)
        text: str(raw.text), before: str(raw.before), after: str(raw.after),
        date: oneOf(raw.date, CARD_DATE_FORMS, 'long'), scale: oneOf(raw.scale, CARD_TEXT_SIZES, 'normal'),
      }
    case 'picture':
      return { id, size, type: 'picture', source: cardSource('picture', raw.field, type, lang), shape: oneOf(raw.shape, CARD_PICTURE_SHAPES, 'landscape') }
    case 'button':
      return { id, size, type: 'button', source: cardSource('button', raw.field, type, lang), label: str(raw.label) }
    case 'group': {
      if (inGroup) return null
      const items = cardDesignItems(raw.items, type, lang, CARD_GROUP_MAX, true) as CardDesignSmall[]
      return { id, size, type: 'group', arrangement: oneOf(raw.arrangement, CARD_GROUP_ARRANGEMENTS, 'row'), space: oneOf(raw.space, CARD_SPACES, 'medium'), items }
    }
    default:
      return null
  }
}

/** A card's list of blocks, read: at most `most` of them, unknown ones left out. */
export function cardDesignItems(list: unknown, type: CustomType, lang: string, most = CARD_MAX, inGroup = false): CardDesignItem[] {
  return (Array.isArray(list) ? list.slice(0, most) : []).flatMap((raw: unknown, i: number) => {
    const item = cardDesignItem(raw, type, lang, i, inGroup)
    return item ? [item] : []
  })
}

/** What a list with a card of its own draws, or why it draws nothing. */
export type CardListPlan =
  | {
    ok: true
    type: CustomType
    request: Extract<CustomRequest, { kind: 'list' }>
    heading: string
    text: string
    arrangement: CardArrangement
    columns: CardColumns
    space: CardSpace
    surface: CardSurface
    /** The card's blocks as designed (none: an empty card). */
    design: CardDesignItem[]
  }
  | { ok: false; reason: string }

/**
 * A section `section_list`, read: its type (the binding's `type`), the request for its entries (the
 * binding's order and limit, as step 2's lists), its heading and text, its settings, and the card's
 * blocks. Nothing to draw (`ok: false`, with the reason) when it names no type or one the site does not have.
 */
export function cardListPlan(block: unknown, types: CustomType[] | null | undefined, lang: string): CardListPlan {
  const b = isRec(block) ? block : {}
  const binding = b.source
  if (!isRec(binding) || typeof binding.type !== 'string' || !binding.type) return { ok: false, reason: 'the section shows no type yet' }
  const type = customTypeOf(Array.isArray(types) ? types.filter(isRec) as CustomType[] : null, binding.type)
  if (!type) return { ok: false, reason: `the site has no type "${binding.type}"` }
  const columns: CardColumns = b.columns === '2' || b.columns === 2 ? 2 : b.columns === '4' || b.columns === 4 ? 4 : 3
  return {
    ok: true,
    type,
    request: customListRequest(type, binding),
    heading: str(b.heading),
    text: str(b.text),
    arrangement: oneOf(b.arrangement, CARD_ARRANGEMENTS, 'cards'),
    columns,
    space: oneOf(b.space, CARD_SPACES, 'medium'),
    surface: oneOf(b.surface, CARD_SURFACES, 'soft'),
    design: cardDesignItems(b.items, type, lang),
  }
}

// ── values, by the field's kind ──

const LOCALES: Record<string, string> = { cs: 'cs-CZ', en: 'en-GB', de: 'de-DE' }
const localeOf = (lang: string) => LOCALES[lang] ?? (lang || 'cs-CZ')

/** A number in the site's way of writing numbers, its spaces unbreakable: 2400 → "2 400"; '' for no number. */
export function cardNumber(value: unknown, lang: string): string {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 6 }).format(n).replace(/\s/g, ' ')
}

/**
 * A moment in one of three forms, in the site's language and the admin's time zone: `long` "14. března
 * 2027", `short` "14. 3. 2027", `weekday` "ne 14. 3."; with its time after a comma ("14. března 2027,
 * 9.30") unless the field is all-day or the time is midnight. '' for no moment.
 */
export function cardDate(value: unknown, form: CardDateForm, lang: string, allDay = false): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const locale = localeOf(lang)
  const opts: Intl.DateTimeFormatOptions = form === 'long'
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : form === 'short' ? { day: 'numeric', month: 'numeric', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'numeric' }
  const date = new Intl.DateTimeFormat(locale, { timeZone: SITE_TIME_ZONE, ...opts }).format(d)
  if (allDay) return date
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: SITE_TIME_ZONE, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  if (hour === 0 && minute === '00') return date
  // Czech writes "9.30"; the others as their language does.
  const time = lang === 'cs' ? `${hour}.${minute}` : new Intl.DateTimeFormat(locale, { timeZone: SITE_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(d)
  return `${date}, ${time}`
}

/** A value of a text, a longer text, a number, a date or a choice as text; '' when there is nothing to show. */
export function cardText(kind: CustomFieldKind, field: CustomTypeField, value: unknown, lang: string, form: CardDateForm = 'long'): string {
  switch (kind) {
    case 'text':
      return typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
    case 'longText':
      return typeof value === 'string' ? value.trim() : ''
    case 'number':
      return cardNumber(value, lang)
    case 'date':
      return cardDate(value, form, lang, !!field.allDay)
    case 'choice': {
      if (typeof value !== 'string' || !value) return ''
      const option = field.options?.find((o) => o.value === value)
      return option ? customLabel(option.label, lang) || value : ''
    }
    default:
      return ''
  }
}

/** A rich text (TipTap JSON) that holds a letter or a picture, else null. */
export function cardRich(value: unknown): CustomRichDoc | null {
  const walk = (node: unknown): boolean => {
    if (!isRec(node)) return false
    if (node.type === 'image') return true
    if (typeof node.text === 'string' && node.text.trim() !== '') return true
    return Array.isArray(node.content) && node.content.some(walk)
  }
  return isRec(value) && typeof value.type === 'string' && walk(value) ? (value as CustomRichDoc) : null
}

/** A picture or a file as the content API gives it, else null. */
export function cardMedia(value: unknown): CustomMedia | null {
  return isRec(value) && typeof value.url === 'string' && value.url.trim() !== '' ? (value as CustomMedia) : null
}

/** Where a button leads, and whether it leaves the site's own pages (`external`: a link elsewhere, an e-mail, a file). */
export interface CardLink { href: string; external: boolean }

/**
 * A link as an owner writes it, made safe: an address of the site (`/kontakt`, the home page `/`), an
 * address elsewhere (`https://…`, `www.example.cz` as `https://www.example.cz`), `mailto:` and `tel:`;
 * null for anything else (`javascript:`, `data:`, words).
 */
export function cardLinkOf(value: unknown): CardLink | null {
  const s = str(value)
  if (!s) return null
  if (/^https?:\/\/\S+$/i.test(s)) return { href: s, external: true }
  if (/^\/\/\S+$/.test(s)) return { href: `https:${s}`, external: true }
  if (/^(mailto|tel):\S+$/i.test(s)) return { href: s, external: true }
  if (/^[/#?]/.test(s) && !/\s/.test(s)) return { href: s.startsWith('/') ? siteHref(s) : s, external: false }
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null
  if (/^[\w-]+(\.[\w-]+)+([/?#]\S*)?$/.test(s)) return { href: `https://${s}`, external: true }
  return null
}

/** The address of an e-mail as `mailto:`, else null. */
export function cardMailto(value: unknown): CardLink | null {
  const s = str(value)
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s) ? { href: `mailto:${s}`, external: true } : null
}

/** The address of an entry's page: the type's path with the entry's slug; null when the type has no pages or the entry no slug. */
export function cardPageHref(type: CustomType, entry: Rec): CardLink | null {
  const slug = str(entry?.[CARD_PAGE_FIELD])
  return type.prefix && slug ? { href: `/${type.prefix}/${encodeURIComponent(slug)}`, external: false } : null
}

/** Where a button of an entry leads, by its source; null when the entry has nothing for it. */
export function cardHref(source: CardSource, entry: Rec, type: CustomType): CardLink | null {
  if (source.from === 'page') return cardPageHref(type, entry)
  if (source.from !== 'field') return null
  const value = entry?.[source.key]
  if (source.kind === 'link') return cardLinkOf(value)
  if (source.kind === 'email') return cardMailto(value)
  if (source.kind === 'file') {
    const file = cardMedia(value)
    const link = file ? cardLinkOf(file.url) : null
    // A file is never one of the site's pages: the browser opens or downloads it.
    return link ? { href: link.href, external: true } : null
  }
  return null
}

// ── the card of one entry ──

/** Why a block shows nothing while an editor works on the page; a visitor never sees it. */
export type CardState = 'unbound' | 'missing' | 'unfit' | 'label'

type ItemBase = {
  id: string
  size: LayoutSize
  /** Only while editing: the block shows nothing, and why. */
  state?: CardState
  /** With `missing` and `unfit`: the field's name; in a sample card: the name of the field it shows. */
  name?: string
  /** In the sample card of a type with no entries: the block names its field. */
  sample?: true
}
/** A heading as drawn. `text` (its own text, as the block holds it) only when it shows its own text. */
export type CardHeading = ItemBase & { type: 'heading'; level: CardHeadingSize; shown: string; text?: string }
/**
 * A text as drawn: `shown` as plain text (several lines kept), or `doc` for a rich text. `before` and
 * `after` only around a number; `text` (its own text) only when it shows its own text.
 */
export type CardText = ItemBase & { type: 'text'; scale: CardTextSize; shown: string; doc: CustomRichDoc | null; before: string; after: string; text?: string }
/** A picture as drawn (null only for a placeholder). `side`: the card's first picture, which stands at the side of a row. */
export type CardPicture = ItemBase & { type: 'picture'; image: CustomMedia | null; shape: CardShape; ratio: string | null; side?: true }
/** A button as drawn: its own text, and where the entry's field leads. */
export type CardButton = ItemBase & { type: 'button'; label: string; href: string; external: boolean }
export type CardSmall = CardHeading | CardText | CardPicture | CardButton
export type CardGroup = ItemBase & { type: 'group'; arrangement: 'row' | 'stack'; space: CardSpace; items: CardSmall[]; empty?: true }
export type CardItem = CardSmall | CardGroup

/** One entry's card (or the sample card, or the empty card), as the section draws it. */
export interface CardEntry {
  /** The entry's id ('' for the sample card and the empty card). */
  id: string
  /** The entry's type (its collection). */
  collection: string
  items: CardItem[]
  /** Blocks at the first level besides the side picture: how many rows the side picture spans. */
  rest: number
  /** The sample card of a type with no entries (only while editing). */
  sample?: true
  /** A card with no blocks (only while editing). */
  empty?: true
}

const SHAPE_RATIOS = { landscape: '4 / 3', square: '1 / 1', portrait: '3 / 4' } as const
function ratioOf(shape: CardShape, image: CustomMedia | null): string | null {
  if (shape !== 'original') return SHAPE_RATIOS[shape]
  const w = Number(image?.width)
  const h = Number(image?.height)
  return w > 0 && h > 0 ? `${Math.round(w)} / ${Math.round(h)}` : null
}

export interface CardFillContext {
  type: CustomType
  lang: string
  editing: boolean
  /** The sample card: bound blocks name their fields instead of an entry's values. */
  sample: boolean
}

/** A placeholder of a block that shows nothing, only while editing. */
function placeholderOf(d: CardDesignSmall, state: CardState, ctx: CardFillContext): CardSmall | null {
  if (!ctx.editing) return null
  const name = d.source.from === 'missing' || d.source.from === 'unfit' ? { name: d.source.name } : {}
  const base = { id: d.id, size: d.size, state, ...name }
  switch (d.type) {
    case 'heading': return { ...base, type: 'heading', level: d.level, shown: '' }
    case 'text': return { ...base, type: 'text', scale: d.scale, shown: '', doc: null, before: '', after: '' }
    case 'picture': return { ...base, type: 'picture', image: null, shape: d.shape, ratio: ratioOf(d.shape, null) }
    case 'button': return { ...base, type: 'button', label: d.label, href: '', external: false }
  }
}

/** One small block filled from an entry; null when it has nothing to show (a placeholder while editing). */
function fillSmall(d: CardDesignSmall, entry: Rec, ctx: CardFillContext): CardSmall | null {
  const s = d.source
  if (s.from === 'missing' || s.from === 'unfit') return placeholderOf(d, s.from, ctx)
  if (s.from === 'own') {
    // Only a heading and a text have a text of their own; a picture and a button need a field.
    if (d.type === 'heading' && d.text) return { id: d.id, size: d.size, type: 'heading', level: d.level, shown: d.text, text: d.text }
    if (d.type === 'text' && d.text) return { id: d.id, size: d.size, type: 'text', scale: d.scale, shown: d.text, doc: null, before: '', after: '', text: d.text }
    return placeholderOf(d, 'unbound', ctx)
  }
  const sample = ctx.sample ? { sample: true as const, name: s.name } : {}
  switch (d.type) {
    case 'heading': {
      if (s.from !== 'field') return placeholderOf(d, 'unfit', ctx)
      const shown = ctx.sample ? s.name : cardText(s.kind, s.field, entry[s.key], ctx.lang)
      return shown ? { id: d.id, size: d.size, type: 'heading', level: d.level, shown, ...sample } : null
    }
    case 'text': {
      if (s.from !== 'field') return placeholderOf(d, 'unfit', ctx)
      const number = s.kind === 'number'
      const around = number ? { before: d.before, after: d.after } : { before: '', after: '' }
      if (ctx.sample) return { id: d.id, size: d.size, type: 'text', scale: d.scale, shown: s.name, doc: null, ...around, ...sample }
      if (s.kind === 'richText') {
        const doc = cardRich(entry[s.key])
        return doc ? { id: d.id, size: d.size, type: 'text', scale: d.scale, shown: '', doc, before: '', after: '' } : null
      }
      const shown = cardText(s.kind, s.field, entry[s.key], ctx.lang, d.date)
      return shown ? { id: d.id, size: d.size, type: 'text', scale: d.scale, shown, doc: null, ...around } : null
    }
    case 'picture': {
      if (s.from !== 'field') return placeholderOf(d, 'unfit', ctx)
      if (ctx.sample) return { id: d.id, size: d.size, type: 'picture', image: null, shape: d.shape, ratio: ratioOf(d.shape, null), ...sample }
      const image = cardMedia(entry[s.key])
      return image ? { id: d.id, size: d.size, type: 'picture', image, shape: d.shape, ratio: ratioOf(d.shape, image) } : null
    }
    case 'button': {
      if (!d.label) return placeholderOf(d, 'label', ctx)
      if (ctx.sample) return { id: d.id, size: d.size, type: 'button', label: d.label, href: '', external: false, ...sample }
      const link = cardHref(s, entry, ctx.type)
      return link ? { id: d.id, size: d.size, type: 'button', label: d.label, href: link.href, external: link.external } : null
    }
  }
}

/**
 * The card's blocks filled from one entry: an empty value leaves its block out, a group with nothing
 * left is left out. While editing a block that shows nothing for a reason of the design (no field, a
 * field gone, a field that does not fit, a button without its text) is kept as a placeholder with its
 * state, and a group with no blocks as an empty group. The first picture at the first level is the
 * one that stands at the side of a row.
 */
export function cardItems(design: CardDesignItem[], entry: unknown, ctx: CardFillContext): CardItem[] {
  const e = isRec(entry) ? entry : {}
  const out: CardItem[] = []
  for (const d of design) {
    if (d.type === 'group') {
      const items = d.items.flatMap((x) => {
        const item = fillSmall(x, e, ctx)
        return item ? [item] : []
      })
      if (items.length) out.push({ id: d.id, size: d.size, type: 'group', arrangement: d.arrangement, space: d.space, items })
      else if (ctx.editing && !d.items.length) out.push({ id: d.id, size: d.size, type: 'group', arrangement: d.arrangement, space: d.space, items, empty: true })
      continue
    }
    const item = fillSmall(d, e, ctx)
    if (item) out.push(item)
  }
  const side = out.find((x): x is CardPicture => x.type === 'picture')
  if (side) side.side = true
  return out
}

/**
 * The cards of a section, one per entry that has something to show, in the entries' order. While
 * editing, a card with no blocks is one empty card, and a type with no entries gives one sample card
 * whose blocks name their fields; on the website both draw nothing.
 */
export function cardEntries(plan: Extract<CardListPlan, { ok: true }>, entries: unknown[], opts: { lang: string; editing?: boolean }): CardEntry[] {
  const editing = !!opts.editing
  const collection = plan.type.name
  const card = (id: string, items: CardItem[], extra: Partial<CardEntry> = {}): CardEntry => {
    const side = items.some((x) => x.type === 'picture' && x.side)
    return { id, collection, items, rest: Math.max(1, items.length - (side ? 1 : 0)), ...extra }
  }
  if (!plan.design.length) return editing ? [card('', [], { empty: true })] : []
  const ctx: CardFillContext = { type: plan.type, lang: opts.lang, editing, sample: false }
  const out: CardEntry[] = []
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!isRec(entry)) continue
    const items = cardItems(plan.design, entry, ctx)
    if (items.length) out.push(card(String(entry.id ?? out.length), items))
  }
  if (!out.length && editing && !(Array.isArray(entries) && entries.some(isRec))) {
    return [card('', cardItems(plan.design, {}, { ...ctx, sample: true }), { sample: true })]
  }
  return out
}

/** The classes of the list of cards: how they stand, how many side by side at most, the space, the surface. */
export function cardListClasses(plan: Pick<Extract<CardListPlan, { ok: true }>, 'arrangement' | 'columns' | 'space' | 'surface'>): string[] {
  return ['kit-cards', `kit-cards-${plan.arrangement}`, `kit-cards-cols-${plan.columns}`, `kit-cards-gap-${plan.space}`, `kit-cards-${plan.surface}`]
}
