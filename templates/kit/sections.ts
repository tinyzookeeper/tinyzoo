// The page blocks the kit draws for every look (docs/builder-plan.md): the two blocks of a
// site's own content types, with the choices an owner has for how they are shown.
//
//   import { kitEntryBlocks } from 'tinyzoo-template-kit/sections'
//   export const Page = definePages({ blocks: { hero, text, ...kitEntryBlocks() } })
//
// A choice says what the block is at most, and the page narrows by itself: "3 columns" is three
// on a wide screen, two on a tablet and one on a phone. The owner sets nothing per screen size.
// An empty choice is the default (app/utils/customTypes.ts reads them), so a block saved before
// a choice existed is drawn as a new one. Blocks are stored in one column: no migration.
import { customTypeBlocks, defineBlock, f } from 'tinyzoo'

/** How many cards stand side by side at most. The default is the first. */
export const ENTRY_COLUMNS = ['3', '2', '4'] as const
/** The shape every card's picture is cut to. The default is the first. */
export const ENTRY_PICTURES = ['landscape', 'square', 'portrait'] as const

/** The choices both blocks get on top of tinyzoo's fields. They apply to cards; rows have neither. */
function entryChoices() {
  return {
    columns: f.select({
      options: ['2', '3', '4'],
      default: ENTRY_COLUMNS[0],
      labels: {
        2: { en: '2 columns', cs: '2 sloupce', de: '2 Spalten' },
        3: { en: '3 columns', cs: '3 sloupce', de: '3 Spalten' },
        4: { en: '4 columns', cs: '4 sloupce', de: '4 Spalten' },
      },
    }).label({ en: 'Cards side by side', cs: 'Karet vedle sebe', de: 'Karten nebeneinander' })
      .help({
        en: 'On a wide screen. Narrow screens show fewer, a phone shows one.',
        cs: 'Na široké obrazovce. Na užší jich je méně, na telefonu jedna.',
        de: 'Auf einem breiten Bildschirm. Schmalere zeigen weniger, ein Telefon eine.',
      }),
    picture: f.select({
      options: [...ENTRY_PICTURES],
      default: ENTRY_PICTURES[0],
      labels: {
        landscape: { en: 'Landscape', cs: 'Na šířku', de: 'Querformat' },
        square: { en: 'Square', cs: 'Čtverec', de: 'Quadrat' },
        portrait: { en: 'Portrait', cs: 'Na výšku', de: 'Hochformat' },
      },
    }).label({ en: 'Picture shape', cs: 'Tvar obrázku', de: 'Bildform' })
      .help({
        en: 'Every card\'s picture is cut to this shape.',
        cs: 'Obrázek každé karty se ořízne do tohoto tvaru.',
        de: 'Das Bild jeder Karte wird auf diese Form zugeschnitten.',
      }),
  }
}

/**
 * tinyzoo's two blocks of a site's own types (`custom_entries`, `custom_chosen`), each with the
 * kit's choices. Use it in a hosted template's page blocks in place of `customTypeBlocks()`.
 */
export function kitEntryBlocks() {
  const { custom_entries, custom_chosen } = customTypeBlocks()
  return {
    custom_entries: defineBlock({ ...custom_entries, fields: { ...custom_entries.fields, ...entryChoices() } }),
    custom_chosen: defineBlock({ ...custom_chosen, fields: { ...custom_chosen.fields, ...entryChoices() } }),
  }
}
