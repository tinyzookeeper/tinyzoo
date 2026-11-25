// What the kit decides about a site's own content types (custom types) before it draws them:
// the two generic blocks (`custom_entries`, `custom_chosen`) and the page of one entry. Plain functions of
// their arguments, so the unit specs test them without Nuxt (test/unit/template-kit-custom.spec.ts).
// The site's types come from `GET /api/content/_types` (useCustomTypes), the entries from the
// content API.
//
// Drawing never fails: a binding that names a type the site does not have gives nothing to
// draw, and a field the type no longer has is left out.
import { dateParts, formatDate } from './format'

/** Text a person reads, by language: `{ cs: 'Kurzy', en: 'Courses' }`. */
export type CustomLabel = Record<string, string>

/** One field of a site's type, as `/api/content/_types` gives it. */
export interface CustomTypeField {
  key: string
  type: 'text' | 'richtext' | 'number' | 'boolean' | 'datetime' | 'select' | 'media' | 'file' | 'gallery' | 'color' | 'relation' | (string & {})
  label: CustomLabel
  help?: CustomLabel | null
  long?: boolean
  format?: 'email' | 'url' | 'link'
  decimal?: boolean
  allDay?: boolean
  options?: { value: string; label: CustomLabel; removed?: true }[]
  to?: string
}

/** One of the site's types, as `/api/content/_types` gives it. */
export interface CustomType {
  name: string
  label: CustomLabel
  labelSingular: CustomLabel | null
  titleField: string
  /** `/kurzy/:slug` when the type has pages. */
  path: string | null
  prefix: string | null
  publish: boolean
  order: 'manual' | { by: string; dir: 'asc' | 'desc' } | null
  page: { image: string | null; summary: string | null } | null
  fields: CustomTypeField[]
}

/** An address prefix that leads to an entry of a site's type: `/kurzy/<slug>` → `{ prefix: 'kurzy', type: 'custom_course' }`. */
export interface CustomPage {
  prefix: string
  type: string
}

/** A picture or a file as the content API gives it. */
export interface CustomMedia {
  id?: string
  url: string
  alt?: string | null
  width?: number | null
  height?: number | null
  mime?: string | null
  focal?: { x: number; y: number } | null
  caption?: string | null
}

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const isMedia = (v: unknown): v is CustomMedia => isObject(v) && typeof v.url === 'string' && v.url !== ''

/** A label in the site's language, else in any language it has. */
export function customLabel(label: CustomLabel | null | undefined, lang: string): string {
  if (!isObject(label)) return ''
  const own = label[lang]
  if (typeof own === 'string' && own.trim()) return own
  return Object.values(label).find((v) => typeof v === 'string' && v.trim()) ?? ''
}

/** A type of the site by its name. */
export function customTypeOf(types: CustomType[] | null | undefined, name: unknown): CustomType | null {
  return (typeof name === 'string' && types?.find((t) => t.name === name)) || null
}

/** A field of a type by its key. */
export function customFieldOf(type: CustomType | null | undefined, key: unknown): CustomTypeField | null {
  return (typeof key === 'string' && key !== '' && type?.fields.find((f) => f.key === key)) || null
}

/** The text of a rich text's paragraphs (TipTap JSON), each as plain text. */
export function richParagraphs(doc: unknown): string[] {
  const out: string[] = []
  const textOf = (node: any): string => (typeof node?.text === 'string' ? node.text : node?.type === 'hardBreak' ? ' ' : Array.isArray(node?.content) ? node.content.map(textOf).join('') : '')
  const walk = (node: any) => {
    if (!isObject(node)) return
    if (node.type === 'paragraph' || node.type === 'heading') {
      const text = textOf(node).replace(/\s+/g, ' ').trim()
      if (text) out.push(text)
      return
    }
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(doc)
  return out
}

/** The site's number format for its language: `cs` → `cs-CZ`. */
const numberLocale = (lang: string) => (lang === 'cs' ? 'cs-CZ' : lang || 'cs-CZ')

/** The title of a linked entry: the target type's title field when the site knows the type, else a usual name. */
function linkedTitle(field: CustomTypeField, value: unknown, types: CustomType[]): string {
  if (!isObject(value)) return ''
  const target = customTypeOf(types, field.to)
  const title = (target && value[target.titleField]) ?? value.title ?? value.name ?? value.label
  return typeof title === 'string' ? title.trim() : ''
}

/**
 * The value of a field of an entry as text to show, by the field's kind; '' when there is
 * nothing to show. A date without the time when the field is all-day; a number as it is, a
 * decimal in the site's number format; yes/no as the field's label when yes; a choice as its
 * label; a link to another entry as that entry's title; rich text as its first paragraph.
 * Pictures, files, galleries and colours are not text.
 */
export function customFieldText(field: CustomTypeField | null | undefined, value: unknown, opts: { lang: string; types?: CustomType[] }): string {
  if (!field || value === null || value === undefined || value === '') return ''
  switch (field.type) {
    case 'text':
      return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
    case 'richtext':
      return richParagraphs(value)[0] ?? ''
    case 'number': {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
      if (!Number.isFinite(n)) return ''
      return field.decimal ? new Intl.NumberFormat(numberLocale(opts.lang), { maximumFractionDigits: 6 }).format(n).replace(/\s/g, ' ') : String(n)
    }
    case 'boolean':
      return value === true ? customLabel(field.label, opts.lang) : ''
    case 'datetime': {
      if (typeof value !== 'string') return ''
      if (field.allDay) return formatDate(value)
      const parts = dateParts(value)
      return parts ? (parts.time ? `${parts.date}, ${parts.time}` : parts.date) : ''
    }
    case 'select': {
      if (typeof value !== 'string') return ''
      const option = field.options?.find((o) => o.value === value)
      return option ? customLabel(option.label, opts.lang) || value : value
    }
    case 'relation':
      return linkedTitle(field, value, opts.types ?? [])
    default:
      return ''
  }
}

/** The kinds that are short facts: shown as a label and a value. */
const FACT_KINDS = new Set(['datetime', 'number', 'select', 'relation', 'boolean'])

// ── the two blocks ──

/** Which field goes to which place of a card; null where the type has no such field (any more). */
export interface CustomShow {
  image: CustomTypeField | null
  text: CustomTypeField | null
  date: CustomTypeField | null
  label: CustomTypeField | null
  more: CustomTypeField[]
}

/** What the content API is asked for. */
export type CustomRequest =
  | { kind: 'list'; path: string; query: { limit: number; sort?: string; dir?: 'asc' | 'desc' } }
  | { kind: 'chosen'; paths: string[] }

/** What a block of a site's type draws, or why it draws nothing. */
export type CustomBlockPlan =
  | { ok: true; type: CustomType; show: CustomShow; layout: 'cards' | 'rows'; request: CustomRequest; heading: string; text: string }
  | { ok: false; reason: string }

/** How many entries a list shows when the block says nothing, and the most it may show (tinyzoo's BINDING_LIMIT_*). */
export const CUSTOM_LIST_LIMIT = 6
export const CUSTOM_LIST_MAX = 48
/** The most entries a block of chosen entries holds (tinyzoo's BINDING_ENTRIES_MAX). */
export const CUSTOM_CHOSEN_MAX = 12

/** Fields every entry has besides its type's own, which a list can be ordered by. */
const ENTRY_DATES = new Set(['createdAt', 'updatedAt'])
/** The kinds a list can be ordered by (the content API's sortable fields). */
const ORDER_KINDS = new Set(['text', 'number', 'datetime', 'select', 'boolean'])

/** An order that still holds: a field the type has (and the API can order by), or the entry's own dates. */
function validOrder(type: CustomType, order: unknown): { by: string; dir: 'asc' | 'desc' } | null {
  if (!isObject(order) || typeof order.by !== 'string' || (order.dir !== 'asc' && order.dir !== 'desc')) return null
  if (ENTRY_DATES.has(order.by)) return { by: order.by, dir: order.dir }
  const field = customFieldOf(type, order.by)
  return field && ORDER_KINDS.has(field.type) ? { by: order.by, dir: order.dir } : null
}

/** The places of a card, each only when the type still has the field and it fits the place. */
export function customShow(type: CustomType, show: unknown): CustomShow {
  const s = isObject(show) ? show : {}
  const pick = (key: unknown, fits: (f: CustomTypeField) => boolean) => {
    const f = customFieldOf(type, key)
    return f && fits(f) ? f : null
  }
  const title = type.titleField
  const more = (Array.isArray(s.more) ? s.more : [])
    .map((key) => pick(key, (f) => f.key !== title && (FACT_KINDS.has(f.type) || f.type === 'text')))
    .filter((f, i, all): f is CustomTypeField => !!f && all.findIndex((g) => g?.key === f.key) === i)
  return {
    image: pick(s.image, (f) => f.type === 'media'),
    text: pick(s.text, (f) => f.key !== title && (f.type === 'text' || f.type === 'richtext')),
    date: pick(s.date, (f) => f.type === 'datetime'),
    label: pick(s.label, (f) => f.key !== title && (FACT_KINDS.has(f.type) || f.type === 'text')),
    more,
  }
}

/**
 * What a block of the type `custom_entries` (`kind: 'entries'`) or `custom_chosen` (`'chosen'`) draws:
 * its type, its places, its layout (a new block's empty layout is cards) and the request for
 * its entries. Nothing to draw (`ok: false`, with the reason) when the block has no binding, the
 * site has no such type, or a block of chosen entries has none chosen.
 *
 * A list asks for the binding's order, else the type's own order, else the API's default (a
 * type arranged by hand comes in that order by itself); and for the binding's limit, else 6.
 */
export function customBlockPlan(block: unknown, types: CustomType[] | null | undefined, kind: 'entries' | 'chosen'): CustomBlockPlan {
  const b = isObject(block) ? block : {}
  const binding = b.source
  if (!isObject(binding) || typeof binding.type !== 'string' || !binding.type) return { ok: false, reason: 'the block shows no type yet' }
  const type = customTypeOf(types, binding.type)
  if (!type) return { ok: false, reason: `the site has no type "${binding.type}"` }
  const show = customShow(type, binding.show)
  const layout = b.layout === 'rows' ? 'rows' : 'cards'
  const heading = typeof b.heading === 'string' ? b.heading.trim() : ''
  const text = typeof b.text === 'string' ? b.text.trim() : ''
  const base = `/api/content/${encodeURIComponent(type.name)}`
  if (kind === 'chosen') {
    const ids = (Array.isArray(binding.entries) ? binding.entries : [])
      .filter((id, i, all): id is string => typeof id === 'string' && id !== '' && all.indexOf(id) === i)
      .slice(0, CUSTOM_CHOSEN_MAX)
    if (!ids.length) return { ok: false, reason: 'no entries are chosen' }
    return { ok: true, type, show, layout, heading, text, request: { kind: 'chosen', paths: ids.map((id) => `${base}/${encodeURIComponent(id)}`) } }
  }
  const raw = Number(binding.limit)
  const limit = Number.isInteger(raw) && raw >= 1 ? Math.min(raw, CUSTOM_LIST_MAX) : CUSTOM_LIST_LIMIT
  const order = validOrder(type, binding.order) ?? (type.order === 'manual' ? null : validOrder(type, type.order))
  return { ok: true, type, show, layout, heading, text, request: { kind: 'list', path: base, query: { limit, ...(order ? { sort: order.by, dir: order.dir } : {}) } } }
}

/** One entry as a card or a row draws it. Each part is null or empty when the entry has nothing for it. */
export interface CustomCard {
  id: string
  title: string
  /** The entry's page, when the type has pages. */
  href: string | null
  image: CustomMedia | null
  /** The date and the label, joined with " · ". */
  meta: string
  text: string
  more: { label: string; value: string }[]
}

/** The address of an entry's page, or null when the type has no pages or the entry no address. */
export function customEntryHref(type: CustomType, entry: Record<string, any>): string | null {
  if (!type.prefix || typeof entry?.slug !== 'string' || !entry.slug) return null
  return `/${type.prefix}/${encodeURIComponent(entry.slug)}`
}

/** The entries of a block as cards: an entry without a title is left out (it cannot be named). */
export function customCards(entries: unknown[], plan: Extract<CustomBlockPlan, { ok: true }>, opts: { lang: string; types?: CustomType[] }): CustomCard[] {
  const { type, show } = plan
  const text = (f: CustomTypeField | null, entry: Record<string, any>) => (f ? customFieldText(f, entry[f.key], opts) : '')
  const out: CustomCard[] = []
  for (const entry of entries) {
    if (!isObject(entry)) continue
    const title = typeof entry[type.titleField] === 'string' ? entry[type.titleField].trim() : ''
    if (!title) continue
    const image = show.image && isMedia(entry[show.image.key]) ? entry[show.image.key] as CustomMedia : null
    const meta = [text(show.date, entry), text(show.label, entry)].filter(Boolean).join(' · ')
    const more = show.more
      .map((f) => ({ field: f, value: text(f, entry) }))
      .filter((m) => m.value)
      // (a yes/no shows its label as the value: it needs no label beside it)
      .map((m) => ({ label: m.field.type === 'boolean' ? '' : customLabel(m.field.label, opts.lang), value: m.value }))
    out.push({ id: String(entry.id ?? title), title, href: customEntryHref(type, entry), image, meta, text: text(show.text, entry), more })
  }
  return out
}

/** The entries of chosen entries' answers, in the picked order: an entry that did not come (404, a failure) is left out. */
export function customChosenEntries(answers: unknown[]): Record<string, any>[] {
  return answers.map((a) => (isObject(a) && isObject(a.item) ? a.item : null)).filter((x): x is Record<string, any> => !!x)
}

// ── the page of one entry ──

/**
 * The site's type an address leads to: two parts, the first a page prefix of the site's types
 * that is not one of the design's own entry pages (`ENTRY_PAGES` stay the design's).
 */
export function customPageFor(parts: string[], customPages: CustomPage[] | null | undefined, entryPrefixes: string[]): CustomPage | null {
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  if (entryPrefixes.includes(parts[0])) return null
  return customPages?.find((p) => p.prefix === parts[0]) ?? null
}

/** Rich text as the content API gives it (TipTap JSON), as <CmsContent> takes it. */
export interface CustomRichDoc {
  type: string
  content?: CustomRichDoc[]
  text?: string
  marks?: any[]
  attrs?: any
}

/** One part of an entry's page below the facts, in the type's order. */
export type CustomEntryPart =
  | { kind: 'text'; key: string; label: string; paragraphs: string[] }
  | { kind: 'rich'; key: string; label: string; doc: CustomRichDoc }
  | { kind: 'gallery'; key: string; label: string; items: CustomMedia[] }
  | { kind: 'file'; key: string; label: string; file: CustomMedia; name: string }

/** An entry's page: its title, its picture, its short facts as one list, then the rest in the type's order. */
export interface CustomEntryView {
  title: string
  image: CustomMedia | null
  facts: { key: string; label: string; value: string }[]
  parts: CustomEntryPart[]
}

const paragraphsOf = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
/** Whether rich text holds anything to show: a paragraph with text, or a picture. */
const hasRich = (doc: unknown) => isObject(doc) && (richParagraphs(doc).length > 0 || JSON.stringify(doc).includes('"type":"image"'))

/**
 * What the page of an entry shows, field by field in the type's order: the picture is the type's
 * page picture, else its first picture field; dates, numbers, choices, links and yes/no are the
 * facts; a short text is a fact too, a long one paragraphs; rich text, galleries and files follow.
 * A field without a value is left out; so is a colour.
 */
export function customEntryView(entry: Record<string, any>, type: CustomType, opts: { lang: string; types?: CustomType[] }): CustomEntryView {
  const title = typeof entry?.[type.titleField] === 'string' ? entry[type.titleField].trim() : ''
  const imageField = customFieldOf(type, type.page?.image)?.type === 'media' && isMedia(entry[type.page!.image!])
    ? customFieldOf(type, type.page?.image)
    : type.fields.find((f) => f.type === 'media' && isMedia(entry[f.key])) ?? null
  const image = imageField ? entry[imageField.key] as CustomMedia : null
  const facts: CustomEntryView['facts'] = []
  const parts: CustomEntryPart[] = []
  for (const f of type.fields) {
    if (f.key === type.titleField || f.key === imageField?.key) continue
    const value = entry[f.key]
    const label = customLabel(f.label, opts.lang)
    if (FACT_KINDS.has(f.type) || (f.type === 'text' && !f.long)) {
      const text = customFieldText(f, value, opts)
      if (text) facts.push({ key: f.key, label: f.type === 'boolean' ? '' : label, value: text })
    }
    else if (f.type === 'text') {
      const paragraphs = typeof value === 'string' ? paragraphsOf(value) : []
      if (paragraphs.length) parts.push({ kind: 'text', key: f.key, label, paragraphs })
    }
    else if (f.type === 'richtext') {
      if (hasRich(value)) parts.push({ kind: 'rich', key: f.key, label, doc: value as CustomRichDoc })
    }
    else if (f.type === 'gallery') {
      const items = Array.isArray(value) ? value.filter(isMedia) : []
      if (items.length) parts.push({ kind: 'gallery', key: f.key, label, items })
    }
    else if (f.type === 'file' && isMedia(value)) {
      parts.push({ kind: 'file', key: f.key, label, file: value, name: (typeof value.alt === 'string' && value.alt.trim()) || label })
    }
    else if (f.type === 'media' && isMedia(value)) {
      parts.push({ kind: 'gallery', key: f.key, label, items: [value] })
    }
  }
  return { title, image, facts, parts }
}
