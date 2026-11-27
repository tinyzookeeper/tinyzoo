import { defineBlock, type BlockDef } from './blocks'
import { CUSTOM_FIELD_KINDS, type CustomFieldKind } from './custom-kinds'
import { bindingField, f, fieldRefField } from './fields'
import type { LocalizedText } from './i18n'
import { CUSTOM_PREFIX } from './model-doc'

export {
  bindingSchema, BINDING_LIMIT_DEFAULT, BINDING_LIMIT_MAX, BINDING_ENTRIES_MAX, BINDING_MORE_MAX, BINDING_NAME_MAX,
  type CmsBinding,
} from './binding'

/**
 * The stored `type` of the two generic blocks: the entries of one custom type as a list, and
 * entries picked by hand.
 *
 * @internal
 */
export const CUSTOM_BLOCK_TYPES = {
  entries: `${CUSTOM_PREFIX}entries`,
  chosen: `${CUSTOM_PREFIX}chosen`,
} as const

/** The fields both blocks have. */
function blockFields(kind: 'entries' | 'chosen') {
  return {
    heading: f.text().label({ en: 'Heading', cs: 'Nadpis', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ en: 'Short text', cs: 'Krátký text', de: 'Kurzer Text' }),
    source: bindingField(kind).label({ en: 'What it shows', cs: 'Co zobrazuje', de: 'Was er zeigt' }),
    layout: f.select({
      options: ['cards', 'rows'],
      default: 'cards',
      labels: {
        cards: { en: 'Cards', cs: 'Karty', de: 'Karten' },
        rows: { en: 'Rows', cs: 'Řádky', de: 'Zeilen' },
      },
    }).label({ en: 'Layout', cs: 'Vzhled', de: 'Darstellung' }),
  }
}

/** The two blocks `customTypeBlocks()` returns, by their stored type. */
type CustomTypeBlocks = Record<`${typeof CUSTOM_PREFIX}entries` | `${typeof CUSTOM_PREFIX}chosen`, BlockDef<ReturnType<typeof blockFields>>>

/**
 * Experimental: may change in a minor release.
 *
 * Two page blocks that show the entries of a content type the site made for itself (a custom
 * type): `custom_entries`, a list of one type's entries, and `custom_chosen`, entries picked by hand.
 * Each block holds which type it shows and which of its fields go where. Add them to the
 * blocks of the pages:
 *
 *   export const Page = definePages({ blocks: { hero, text, ...customTypeBlocks() } })
 *
 * Blocks are stored in one column, so adding them needs no migration. A block the site has
 * no type for yet stays empty until someone picks one.
 */
export function customTypeBlocks(): CustomTypeBlocks {
  return {
    [CUSTOM_BLOCK_TYPES.entries]: defineBlock({
      label: { en: 'Entries', cs: 'Seznam záznamů', de: 'Einträge' },
      description: {
        en: 'Show the entries of one of your content types.',
        cs: 'Ukažte záznamy jednoho z vašich typů obsahu.',
        de: 'Zeigen Sie die Einträge eines Ihrer Inhaltstypen.',
      },
      icon: 'i-lucide-layout-list',
      fields: blockFields('entries'),
    }),
    [CUSTOM_BLOCK_TYPES.chosen]: defineBlock({
      label: { en: 'Chosen entries', cs: 'Vybrané záznamy', de: 'Ausgewählte Einträge' },
      description: {
        en: 'Show the entries you pick, in the order you want.',
        cs: 'Ukažte záznamy, které vyberete, v pořadí, jaké chcete.',
        de: 'Zeigen Sie ausgewählte Einträge in der Reihenfolge Ihrer Wahl.',
      },
      icon: 'i-lucide-list-checks',
      fields: blockFields('chosen'),
    }),
  }
}

/**
 * Experimental: may change in a minor release.
 *
 * A value a card's starter or one of its groups puts into a field of a block it adds: a plain value,
 * or a text by language (`{ en: 'Read more', cs: 'Zjistit víc' }`), which the admin puts in the
 * site's language when it adds the block.
 */
export type CustomCardValue = string | number | boolean | null | Readonly<Record<string, string>>

/**
 * Experimental: may change in a minor release.
 *
 * One block of the card the admin designs when a person adds the section with a type chosen (the
 * starter card): the block type of the card's list (`block`), what it starts with (`from`: `'title'`,
 * the type's title, or the first field not yet taken of one of these kinds, in the type's order), and
 * values of the block's other fields (`set`). A step whose field the type does not have is left out.
 */
export interface CustomCardStep {
  block: string
  from: 'title' | readonly CustomFieldKind[]
  set?: Readonly<Record<string, CustomCardValue>>
}

/**
 * Experimental: may change in a minor release.
 *
 * A way to group blocks of the card the admin offers under the empty blocks (*Row*, *Column*): the
 * block type (`block`), its name and icon in the admin, the values it starts with (`set`), and the
 * values a block added into it after its first one takes (`next`; in a row, as wide as its content).
 */
export interface CustomCardGroup {
  block: string
  label: LocalizedText
  icon?: string
  set?: Readonly<Record<string, CustomCardValue>>
  next?: Readonly<Record<string, CustomCardValue>>
}

/** Experimental: may change in a minor release. What a design says about the card of `customTypeCard()`. */
export interface CustomCardOptions {
  /** The card the admin designs from the type's fields when the section is added, in order. */
  starter?: readonly CustomCardStep[]
  /** The groups offered when a person adds to the card. */
  groups?: readonly CustomCardGroup[]
}

/**
 * Experimental: may change in a minor release.
 *
 * What `customTypeFieldRef()` takes: the kinds of field it shows (`takes`); the block's field that
 * holds a text of its own, offered as *Own text* when no field is named (`own`); and, per kind, the
 * block's fields that matter only when the reference names a field of that kind (`only`: a text
 * before and after a number, the form of a date). The admin shows those fields only then.
 */
export interface CustomFieldRefOptions {
  takes: readonly CustomFieldKind[]
  own?: string
  only?: Readonly<Partial<Record<CustomFieldKind, readonly string[]>>>
}

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const NAME = /^[a-zA-Z][a-zA-Z0-9_]*$/

function cardValues(where: string, values: unknown): Record<string, CustomCardValue> | undefined {
  if (values === undefined) return undefined
  if (!isRec(values)) throw new Error(`${where} is a map of a block's fields to values.`)
  const out: Record<string, CustomCardValue> = {}
  for (const [key, v] of Object.entries(values)) {
    const ok = v === null || ['string', 'number', 'boolean'].includes(typeof v) || (isRec(v) && Object.values(v).every((x) => typeof x === 'string'))
    if (!NAME.test(key) || !ok) throw new Error(`${where}.${key}: a value is a text, a number, a yes or no, null, or a text by language ({ en: '…', cs: '…' }).`)
    out[key] = v as CustomCardValue
  }
  return out
}

function cardOptions(o: CustomCardOptions | undefined): Record<string, unknown> | undefined {
  if (o === undefined) return undefined
  if (!isRec(o)) throw new Error('customTypeCard() takes { starter, groups }.')
  const card: Record<string, unknown> = {}
  if (o.starter !== undefined) {
    if (!Array.isArray(o.starter)) throw new Error('customTypeCard({ starter }) is a list of steps: { block, from, set }.')
    card.starter = o.starter.map((step, i) => {
      const at = `customTypeCard() starter[${i}]`
      if (!isRec(step) || typeof step.block !== 'string' || !NAME.test(step.block)) throw new Error(`${at} names a block type of the card (block).`)
      const from = step.from
      if (from !== 'title') {
        if (!Array.isArray(from) || !from.length) throw new Error(`${at}: from is 'title' or a list of kinds (${CUSTOM_FIELD_KINDS.join(', ')}).`)
        const unknown = from.filter((k) => !(CUSTOM_FIELD_KINDS as readonly string[]).includes(k))
        if (unknown.length) throw new Error(`${at}: ${unknown.map((k) => `"${String(k)}"`).join(', ')} ${unknown.length === 1 ? 'is no kind' : 'are no kinds'} of field.`)
      }
      const set = cardValues(`${at}.set`, step.set)
      return { block: step.block, from: from === 'title' ? 'title' : [...new Set(from)], ...(set ? { set } : {}) }
    })
  }
  if (o.groups !== undefined) {
    if (!Array.isArray(o.groups)) throw new Error('customTypeCard({ groups }) is a list: { block, label, icon, set, next }.')
    card.groups = o.groups.map((g, i) => {
      const at = `customTypeCard() groups[${i}]`
      if (!isRec(g) || typeof g.block !== 'string' || !NAME.test(g.block)) throw new Error(`${at} names a block type of the card (block).`)
      const label = g.label
      if (!(typeof label === 'string' || (isRec(label) && Object.values(label).every((x) => typeof x === 'string')))) throw new Error(`${at} needs a label: a text, or a text by language.`)
      if (g.icon !== undefined && typeof g.icon !== 'string') throw new Error(`${at}.icon is the name of an icon.`)
      const set = cardValues(`${at}.set`, g.set)
      const next = cardValues(`${at}.next`, g.next)
      return { block: g.block, label, ...(g.icon ? { icon: g.icon } : {}), ...(set ? { set } : {}), ...(next ? { next } : {}) }
    })
  }
  return { card }
}

/**
 * Experimental: may change in a minor release.
 *
 * The field of a page block that shows the entries of one content type the site made for itself
 * with a card a person designs: which type, the order and how many at most. The card is the
 * block's own list of small blocks (its first `f.blocks()` field), and each of them names the field
 * it shows with `customTypeFieldRef()`. Stored as a `CmsBinding` with `type`, `order` and `limit`:
 *
 *   section_entries: defineBlock({ label, fields: {
 *     source: customTypeCard({
 *       starter: [
 *         { block: 'picture', from: ['picture'] },
 *         { block: 'heading', from: 'title' },
 *         { block: 'text', from: ['longText', 'richText'] },
 *         { block: 'button', from: ['page'], set: { label: { en: 'Read more', cs: 'Zjistit víc' } } },
 *       ],
 *       groups: [{ block: 'group', label: { en: 'Row' }, set: { arrangement: 'row' }, next: { size: 'content' } }],
 *     }).label({ en: 'What it shows', cs: 'Co zobrazuje' }),
 *     items: f.blocks({ heading, text, picture, button, group }),
 *   } })
 *
 * The options are what the admin needs to design for the person, in the design's own block names
 * (`CustomCardOptions`): the starter card and the groups it offers; both are optional. It is a field
 * of a page block itself, never of a group, a list item or a block inside another block, and a block
 * holds one. Without `NUXT_CMS_CUSTOM_TYPES=on` the admin leaves the block out.
 */
export function customTypeCard(o?: CustomCardOptions) {
  return bindingField('card', cardOptions(o))
}

/**
 * Experimental: may change in a minor release.
 *
 * The field of a small block of a card that names the field of the bound type it shows: the
 * field's key (`'photo'`), `'slug'` for the entry's own page, empty for none. `takes` lists the
 * kinds it shows (`CustomFieldKind`): the admin offers only the fields of those kinds, and the
 * server refuses a new reference to a field the type does not have or whose kind it does not take.
 * A reference stored before the type changed is kept, so the page stays saveable. Stored as a text:
 *
 *   const heading = defineBlock({ label, fields: {
 *     field: customTypeFieldRef({ takes: ['text', 'number', 'date', 'choice'], own: 'text', only: { number: ['after'] } }).label({ en: 'Shows' }),
 *     text: f.text(),
 *     after: f.text(),
 *   } })
 *
 * `own` and `only` name fields of the same block (`CustomFieldRefOptions`). It is a field of a block
 * inside a block that holds `customTypeCard()`, or of a block of a list inside one of those;
 * anywhere else the config does not load.
 */
export function customTypeFieldRef(o: CustomFieldRefOptions) {
  const takes = Array.isArray(o?.takes) ? o.takes : []
  const unknown = takes.filter((k) => !(CUSTOM_FIELD_KINDS as readonly string[]).includes(k))
  if (!takes.length) throw new Error('customTypeFieldRef() needs `takes`: the kinds of field it shows (one or more of ' + CUSTOM_FIELD_KINDS.join(', ') + ').')
  if (unknown.length) throw new Error(`customTypeFieldRef() takes ${unknown.map((k) => `"${String(k)}"`).join(', ')}, which ${unknown.length === 1 ? 'is no kind' : 'are no kinds'} of field (the kinds: ${CUSTOM_FIELD_KINDS.join(', ')}).`)
  const extra: Record<string, unknown> = {}
  if (o.own !== undefined) {
    if (typeof o.own !== 'string' || !NAME.test(o.own)) throw new Error('customTypeFieldRef({ own }) names a text field of the same block.')
    extra.own = o.own
  }
  if (o.only !== undefined) {
    if (!isRec(o.only)) throw new Error('customTypeFieldRef({ only }) maps a kind to the fields of the same block that matter only for it.')
    const only: Record<string, string[]> = {}
    for (const [kind, keys] of Object.entries(o.only)) {
      if (!(takes as readonly string[]).includes(kind)) throw new Error(`customTypeFieldRef({ only }): "${kind}" is not among the kinds it takes.`)
      if (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string' && NAME.test(k))) throw new Error(`customTypeFieldRef({ only }).${kind} is a list of fields of the same block.`)
      only[kind] = [...new Set(keys as string[])]
    }
    extra.only = only
  }
  return fieldRefField(takes, Object.keys(extra).length ? extra : undefined)
}
