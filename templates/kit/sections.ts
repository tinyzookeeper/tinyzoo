// The page blocks the kit draws for every look (docs/builder-plan.md): the two blocks of a
// site's own content types, with the choices an owner has for how they are shown, and the
// sections (Text and picture, Cards, Questions), which belong to no template.
//
//   import { kitEntryBlocks, kitSections } from 'tinyzoo-template-kit/sections'
//   export const Page = definePages({ blocks: { hero, text, ...kitEntryBlocks(), ...kitSections() } })
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

/** How the entries are laid out. The default is the first. */
export const ENTRY_LAYOUTS = ['cards', 'rows', 'table'] as const

/** The layout field of both blocks: tinyzoo's two (cards, rows) and a table. It keeps the engine's key and place. */
function entryLayout() {
  return f.select({
    options: [...ENTRY_LAYOUTS],
    default: ENTRY_LAYOUTS[0],
    labels: {
      cards: { en: 'Cards', cs: 'Karty', de: 'Karten' },
      rows: { en: 'Rows', cs: 'Řádky', de: 'Zeilen' },
      table: { en: 'Table', cs: 'Tabulka', de: 'Tabelle' },
    },
  }).label({ en: 'Layout', cs: 'Vzhled', de: 'Darstellung' })
}

/** The choices both blocks get on top of tinyzoo's fields. They apply to cards; rows and the table have neither. */
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
        en: 'For cards. On a wide screen; narrow screens show fewer, a phone shows one.',
        cs: 'Pro karty. Na široké obrazovce; na užší jich je méně, na telefonu jedna.',
        de: 'Für Karten. Auf einem breiten Bildschirm; schmalere zeigen weniger, ein Telefon eine.',
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
        en: 'For cards. Every card\'s picture is cut to this shape.',
        cs: 'Pro karty. Obrázek každé karty se ořízne do tohoto tvaru.',
        de: 'Für Karten. Das Bild jeder Karte wird auf diese Form zugeschnitten.',
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
    custom_entries: defineBlock({ ...custom_entries, fields: { ...custom_entries.fields, layout: entryLayout(), ...entryChoices() } }),
    custom_chosen: defineBlock({ ...custom_chosen, fields: { ...custom_chosen.fields, layout: entryLayout(), ...entryChoices() } }),
  }
}

/** Which side of the text the picture stands on. The default is the first. */
export const SECTION_SIDES = ['right', 'left'] as const
/** How wide the picture is: half of the section, or a third. The default is the first. */
export const SECTION_SIZES = ['half', 'third'] as const
/** Whether the answers of a Questions section are folded. The default is the first. */
export const SECTION_ANSWERS = ['folded', 'open'] as const
/** The width of a section's content: the look's own, or a readable width. The default is the first. */
export const SECTION_WIDTHS = ['look', 'narrow'] as const

const heading = () => f.text().label({ en: 'Heading', cs: 'Nadpis', de: 'Überschrift' })
const shortText = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text', de: 'Text' })
const link = () => f.text({ format: 'link' }).label({ en: 'Link', cs: 'Odkaz', de: 'Link' })
const picture = () => f.media({ accept: 'image/*' }).optional().label({ en: 'Picture', cs: 'Obrázek', de: 'Bild' })

/** The settings every section has, after its own fields. */
function sectionSettings() {
  return {
    width: f.select({
      options: [...SECTION_WIDTHS],
      default: SECTION_WIDTHS[0],
      labels: {
        look: { en: 'As the look', cs: 'Podle vzhledu', de: 'Wie das Design' },
        narrow: { en: 'Narrow', cs: 'Úzká', de: 'Schmal' },
      },
    }).label({ en: 'Width', cs: 'Šířka', de: 'Breite' })
      .help({
        en: 'The content of a narrow section is at most a readable width.',
        cs: 'Obsah úzké sekce je nejvýše tak široký, aby se dobře četl.',
        de: 'Der Inhalt eines schmalen Abschnitts ist höchstens so breit, dass er gut lesbar ist.',
      }),
    close: f.boolean().label({ en: 'Close to the section above', cs: 'Těsně pod předchozí sekcí', de: 'Dicht am Abschnitt darüber' })
      .help({
        en: 'No space above the section.',
        cs: 'Nad sekcí není žádný odstup.',
        de: 'Kein Abstand über dem Abschnitt.',
      }),
  }
}

/**
 * The kit's sections: blocks no template has, drawn by the kit in the look's own frame
 * (BlockSectionTextPicture, BlockSectionCards, BlockSectionQuestions). Spread them next to
 * `kitEntryBlocks()` in a template's page blocks. Their names start with `section_`.
 */
export function kitSections() {
  return {
    section_text_picture: defineBlock({
      label: { en: 'Text and picture', cs: 'Text a obrázek', de: 'Text und Bild' },
      description: { en: 'A text with a button, and a picture beside it.', cs: 'Text s tlačítkem a vedle něj obrázek.', de: 'Ein Text mit Knopf und daneben ein Bild.' },
      icon: 'i-lucide-panel-left',
      fields: {
        heading: heading(),
        body: f.richtext().label({ en: 'Text', cs: 'Text', de: 'Text' }),
        image: picture(),
        buttonLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka', de: 'Text des Knopfs' }),
        buttonLink: link().label({ en: 'Button link', cs: 'Odkaz tlačítka', de: 'Link des Knopfs' }),
        side: f.select({
          options: [...SECTION_SIDES],
          default: SECTION_SIDES[0],
          labels: {
            right: { en: 'Right', cs: 'Vpravo', de: 'Rechts' },
            left: { en: 'Left', cs: 'Vlevo', de: 'Links' },
          },
        }).label({ en: 'Picture on the', cs: 'Obrázek', de: 'Bild' })
          .help({
            en: 'On a phone the picture is above the text.',
            cs: 'Na telefonu je obrázek nad textem.',
            de: 'Auf dem Telefon steht das Bild über dem Text.',
          }),
        size: f.select({
          options: [...SECTION_SIZES],
          default: SECTION_SIZES[0],
          labels: {
            half: { en: 'Half', cs: 'Polovina', de: 'Hälfte' },
            third: { en: 'A third', cs: 'Třetina', de: 'Ein Drittel' },
          },
        }).label({ en: 'Picture size', cs: 'Velikost obrázku', de: 'Bildgröße' }),
        ...sectionSettings(),
      },
    }),
    section_cards: defineBlock({
      label: { en: 'Cards', cs: 'Karty', de: 'Karten' },
      description: { en: 'Cards side by side, each with a picture, a title, a text and a link.', cs: 'Karty vedle sebe, každá s obrázkem, názvem, textem a odkazem.', de: 'Karten nebeneinander, jede mit Bild, Titel, Text und Link.' },
      icon: 'i-lucide-layout-grid',
      fields: {
        heading: heading(),
        text: shortText(),
        items: f.list({
          fields: {
            image: picture(),
            title: f.text({ required: true }).label({ en: 'Title', cs: 'Název', de: 'Titel' }),
            text: shortText(),
            link: link(),
          },
          max: 12,
          itemLabel: { en: 'Card', cs: 'Karta', de: 'Karte' },
        }).label({ en: 'Cards', cs: 'Karty', de: 'Karten' }),
        ...entryChoices(),
        ...sectionSettings(),
      },
    }),
    section_questions: defineBlock({
      label: { en: 'Questions', cs: 'Otázky', de: 'Fragen' },
      description: { en: 'Questions with their answers, folded or open.', cs: 'Otázky s odpověďmi, sbalené nebo rozbalené.', de: 'Fragen mit Antworten, eingeklappt oder aufgeklappt.' },
      icon: 'i-lucide-circle-help',
      fields: {
        heading: heading(),
        text: shortText(),
        items: f.list({
          fields: {
            question: f.text({ required: true }).label({ en: 'Question', cs: 'Otázka', de: 'Frage' }),
            answer: f.text({ multiline: true }).label({ en: 'Answer', cs: 'Odpověď', de: 'Antwort' }),
          },
          max: 30,
          itemLabel: { en: 'Question', cs: 'Otázka', de: 'Frage' },
        }).label({ en: 'Questions', cs: 'Otázky', de: 'Fragen' }),
        answers: f.select({
          options: [...SECTION_ANSWERS],
          default: SECTION_ANSWERS[0],
          labels: {
            folded: { en: 'Folded', cs: 'Sbalené', de: 'Eingeklappt' },
            open: { en: 'Open', cs: 'Rozbalené', de: 'Aufgeklappt' },
          },
        }).label({ en: 'Answers', cs: 'Odpovědi', de: 'Antworten' }),
        ...sectionSettings(),
      },
    }),
  }
}
