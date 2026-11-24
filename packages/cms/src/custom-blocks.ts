import { defineBlock, type BlockDef } from './blocks'
import { bindingField, f } from './fields'
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
    source: bindingField(kind)
      .label({ en: 'What it shows', cs: 'Co zobrazuje', de: 'Was er zeigt' })
      .help({
        en: 'Which content type, and which of its fields go where.',
        cs: 'Který typ obsahu blok ukáže a co z něj bude kde.',
        de: 'Welcher Inhaltstyp gezeigt wird und welches seiner Felder wohin kommt.',
      }),
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
 * type): `x_entries`, a list of one type's entries, and `x_chosen`, entries picked by hand.
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
        en: 'A list of entries of one of your content types, newest first or in an order you choose.',
        cs: 'Seznam záznamů jednoho z vašich typů obsahu, od nejnovějších nebo v pořadí, které si zvolíte.',
        de: 'Eine Liste der Einträge eines Ihrer Inhaltstypen, die neuesten zuerst oder in einer Reihenfolge Ihrer Wahl.',
      },
      icon: 'i-lucide-layout-list',
      fields: blockFields('entries'),
    }),
    [CUSTOM_BLOCK_TYPES.chosen]: defineBlock({
      label: { en: 'Chosen entries', cs: 'Vybrané záznamy', de: 'Ausgewählte Einträge' },
      description: {
        en: 'Entries you pick by hand, in the order you pick them.',
        cs: 'Záznamy, které vyberete ručně, v pořadí, v jakém je vyberete.',
        de: 'Einträge, die Sie von Hand auswählen, in der Reihenfolge, in der Sie sie auswählen.',
      },
      icon: 'i-lucide-list-checks',
      fields: blockFields('chosen'),
    }),
  }
}
