import { defineBlock, type BlockDef } from './blocks'
import { CUSTOM_FIELD_KINDS, type CustomFieldKind } from './custom-kinds'
import { bindingField, f, fieldRefField } from './fields'
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
 * The field of a page block that shows the entries of one content type the site made for itself
 * with a card a person designs: which type, the order and how many at most. The card is the
 * block's own list of small blocks (`f.blocks()`), and each of them names the field it shows with
 * `customTypeFieldRef()`. Stored as a `CmsBinding` with `type`, `order` and `limit`:
 *
 *   section_entries: defineBlock({ label, fields: {
 *     source: customTypeCard().label({ en: 'What it shows', cs: 'Co zobrazuje' }),
 *     items: f.blocks({ heading, text, picture, button, group }),
 *   } })
 *
 * It is a field of a page block itself, never of a group, a list item or a block inside another
 * block, and a block holds one. Without `NUXT_CMS_CUSTOM_TYPES=on` the admin leaves the block out.
 */
export function customTypeCard() {
  return bindingField('card')
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
 *     field: customTypeFieldRef({ takes: ['text', 'number', 'date', 'choice'] }).label({ en: 'Shows' }),
 *     text: f.text(),
 *   } })
 *
 * It is a field of a block inside a block that holds `customTypeCard()`, or of a block of a list
 * inside one of those; anywhere else the config does not load.
 */
export function customTypeFieldRef(o: { takes: readonly CustomFieldKind[] }) {
  const takes = Array.isArray(o?.takes) ? o.takes : []
  const unknown = takes.filter((k) => !(CUSTOM_FIELD_KINDS as readonly string[]).includes(k))
  if (!takes.length) throw new Error('customTypeFieldRef() needs `takes`: the kinds of field it shows (one or more of ' + CUSTOM_FIELD_KINDS.join(', ') + ').')
  if (unknown.length) throw new Error(`customTypeFieldRef() takes ${unknown.map((k) => `"${String(k)}"`).join(', ')}, which ${unknown.length === 1 ? 'is no kind' : 'are no kinds'} of field (the kinds: ${CUSTOM_FIELD_KINDS.join(', ')}).`)
  return fieldRefField(takes)
}
