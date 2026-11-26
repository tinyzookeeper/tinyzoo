// The page blocks the kit draws for every look (docs/builder-plan.md): the two blocks of a
// site's own content types, with the choices an owner has for how they are shown, and the
// sections (Text and picture, Cards, Questions, Layout), which belong to no template.
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

/**
 * The choices both blocks get on top of tinyzoo's fields. They apply to cards; rows and the table have neither.
 * The Cards section has them too, as settings drawn as segments (`asSettings`).
 */
function entryChoices(asSettings = false) {
  const columns = f.select({
      options: ['2', '3', '4'],
      default: ENTRY_COLUMNS[0],
      segments: asSettings,
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
      })
  const picture = f.select({
      options: [...ENTRY_PICTURES],
      default: ENTRY_PICTURES[0],
      segments: asSettings,
      ...(asSettings ? { icons: { landscape: 'i-lucide-rectangle-horizontal', square: 'i-lucide-square', portrait: 'i-lucide-rectangle-vertical' } } : {}),
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
      })
  return asSettings ? { columns: columns.setting(), picture: picture.setting() } : { columns, picture }
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

/** The settings every section has, after its own fields: settings (`.setting()`), the width drawn as segments. */
function sectionSettings() {
  return {
    width: f.select({
      options: [...SECTION_WIDTHS],
      default: SECTION_WIDTHS[0],
      segments: true,
      labels: {
        look: { en: 'As the look', cs: 'Podle vzhledu', de: 'Wie das Design' },
        narrow: { en: 'Narrow', cs: 'Úzká', de: 'Schmal' },
      },
    }).label({ en: 'Width', cs: 'Šířka', de: 'Breite' })
      .help({
        en: 'The content of a narrow section is at most a readable width.',
        cs: 'Obsah úzké sekce je nejvýše tak široký, aby se dobře četl.',
        de: 'Der Inhalt eines schmalen Abschnitts ist höchstens so breit, dass er gut lesbar ist.',
      })
      .setting(),
    close: f.boolean().label({ en: 'Close to the section above', cs: 'Těsně pod předchozí sekcí', de: 'Dicht am Abschnitt darüber' })
      .help({
        en: 'No space above the section.',
        cs: 'Nad sekcí není žádný odstup.',
        de: 'Kein Abstand über dem Abschnitt.',
      })
      .setting(),
  }
}

/** How the small blocks of a Layout section stand. The default is the first. */
export const LAYOUT_ARRANGEMENTS = ['row', 'stack', 'grid'] as const
/** How the small blocks of a group stand. The default is the first. */
export const GROUP_ARRANGEMENTS = ['stack', 'row'] as const
/** The space between the small blocks, from a scale of three. The default is the first. */
export const LAYOUT_SPACES = ['medium', 'small', 'large'] as const
/** Where the small blocks stand across the direction: in a row top, middle, bottom; in a stack or a grid left, centre, right. The default is the first. */
export const LAYOUT_ALIGNS = ['start', 'center', 'end'] as const
/** How many small blocks of a grid stand side by side at most. The default is the first. */
export const LAYOUT_COLUMNS = ['3', '2', '4'] as const
/** How wide a small block is: the room it is given, or as wide as its content. The default is the first. */
export const LAYOUT_SIZES = ['fill', 'content'] as const
/** How wide a button is: as wide as its text, unless it fills. The default is the first. */
export const BUTTON_SIZES = ['content', 'fill'] as const
/** The size of a heading. The default is the first. */
export const HEADING_SIZES = ['medium', 'large', 'small'] as const
/** The shape of a picture. The default is the first. */
export const PICTURE_SHAPES = ['original', 'landscape', 'square', 'portrait'] as const
/** The most small blocks in a Layout section, and in a group. */
export const LAYOUT_MAX = 12
export const GROUP_MAX = 8

const ARRANGEMENT_LABELS = {
  row: { en: 'Row', cs: 'Vedle sebe', de: 'Nebeneinander' },
  stack: { en: 'Stack', cs: 'Pod sebou', de: 'Untereinander' },
  grid: { en: 'Grid', cs: 'Mřížka', de: 'Raster' },
}
const ARRANGEMENT_ICONS = { row: 'i-lucide-columns-3', stack: 'i-lucide-rows-3', grid: 'i-lucide-layout-grid' }
const arrangementLabel = { en: 'Arrangement', cs: 'Uspořádání', de: 'Anordnung' }
const arrangementHelp = {
  en: 'Where there is not enough room, a row goes on below.',
  cs: 'Kde není dost místa, řada pokračuje pod sebou.',
  de: 'Wo der Platz nicht reicht, geht eine Reihe darunter weiter.',
}

/** The settings of how small blocks stand, shared by the section and a group: the space and the alignment. */
function spacing() {
  return {
    space: f.select({
      options: ['small', 'medium', 'large'],
      default: LAYOUT_SPACES[0],
      segments: true,
      labels: {
        small: { en: 'Small', cs: 'Malé', de: 'Klein' },
        medium: { en: 'Medium', cs: 'Střední', de: 'Mittel' },
        large: { en: 'Large', cs: 'Velké', de: 'Groß' },
      },
    }).label({ en: 'Space between', cs: 'Mezery', de: 'Abstände' }).setting(),
    align: f.select({
      options: [...LAYOUT_ALIGNS],
      default: LAYOUT_ALIGNS[0],
      segments: true,
      labels: {
        start: { en: 'Start', cs: 'Začátek', de: 'Anfang' },
        center: { en: 'Centre', cs: 'Střed', de: 'Mitte' },
        end: { en: 'End', cs: 'Konec', de: 'Ende' },
      },
      icons: { start: 'i-lucide-align-start-horizontal', center: 'i-lucide-align-center-horizontal', end: 'i-lucide-align-end-horizontal' },
    }).label({ en: 'Alignment', cs: 'Zarovnání', de: 'Ausrichtung' })
      .help({
        en: 'In a row: top, middle or bottom. In a stack or a grid: left, centre or right.',
        cs: 'Vedle sebe: nahoru, na střed, dolů. Pod sebou a v mřížce: vlevo, na střed, vpravo.',
        de: 'Nebeneinander: oben, Mitte, unten. Untereinander und im Raster: links, Mitte, rechts.',
      })
      .setting(),
  }
}

/** The one setting every small block and group has: how wide it is. A button is as wide as its text unless it says otherwise. */
function itemSize(fallback: (typeof LAYOUT_SIZES)[number] = LAYOUT_SIZES[0]) {
  return f.select({
    options: [...LAYOUT_SIZES],
    default: fallback,
    segments: true,
    labels: {
      fill: { en: 'Fill', cs: 'Vyplnit', de: 'Ausfüllen' },
      content: { en: 'Fit content', cs: 'Podle obsahu', de: 'Nach Inhalt' },
    },
    icons: { fill: 'i-lucide-unfold-horizontal', content: 'i-lucide-fold-horizontal' },
  }).label({ en: 'Width', cs: 'Šířka', de: 'Breite' })
    .help({
      en: 'Fill takes the room it is given. Fit content is as wide as what it holds.',
      cs: 'Vyplnit zabere místo, které dostane. Podle obsahu je tak široký jako to, co obsahuje.',
      de: 'Ausfüllen nimmt den Platz, den es bekommt. Nach Inhalt ist so breit wie sein Inhalt.',
    })
    .setting()
}

/** The small blocks of a Layout section, which a group holds too. */
function smallBlocks() {
  return {
    heading: defineBlock({
      label: { en: 'Heading', cs: 'Nadpis', de: 'Überschrift' },
      icon: 'i-lucide-heading',
      fields: {
        text: f.text().label({ en: 'Heading', cs: 'Nadpis', de: 'Überschrift' }),
        level: f.select({
          options: ['large', 'medium', 'small'],
          default: HEADING_SIZES[0],
          segments: true,
          labels: {
            large: { en: 'Large', cs: 'Velký', de: 'Groß' },
            medium: { en: 'Medium', cs: 'Střední', de: 'Mittel' },
            small: { en: 'Small', cs: 'Malý', de: 'Klein' },
          },
        }).label({ en: 'Size', cs: 'Velikost', de: 'Größe' }).setting(),
        size: itemSize(),
      },
    }),
    text: defineBlock({
      label: { en: 'Text', cs: 'Text', de: 'Text' },
      icon: 'i-lucide-pilcrow',
      fields: {
        body: f.richtext().label({ en: 'Text', cs: 'Text', de: 'Text' }),
        size: itemSize(),
      },
    }),
    picture: defineBlock({
      label: { en: 'Picture', cs: 'Obrázek', de: 'Bild' },
      icon: 'i-lucide-image',
      fields: {
        image: picture(),
        shape: f.select({
          options: ['original', 'landscape', 'square', 'portrait'],
          default: PICTURE_SHAPES[0],
          segments: true,
          labels: {
            original: { en: 'Original', cs: 'Původní', de: 'Original' },
            landscape: { en: 'Landscape', cs: 'Na šířku', de: 'Querformat' },
            square: { en: 'Square', cs: 'Čtverec', de: 'Quadrat' },
            portrait: { en: 'Portrait', cs: 'Na výšku', de: 'Hochformat' },
          },
          icons: { original: 'i-lucide-image', landscape: 'i-lucide-rectangle-horizontal', square: 'i-lucide-square', portrait: 'i-lucide-rectangle-vertical' },
        }).label({ en: 'Shape', cs: 'Tvar', de: 'Form' }).setting(),
        size: itemSize(),
      },
    }),
    button: defineBlock({
      label: { en: 'Button', cs: 'Tlačítko', de: 'Knopf' },
      icon: 'i-lucide-mouse-pointer-click',
      fields: {
        label: f.text().label({ en: 'Button text', cs: 'Text tlačítka', de: 'Text des Knopfs' }),
        link: link().label({ en: 'Button link', cs: 'Odkaz tlačítka', de: 'Link des Knopfs' }),
        size: itemSize(BUTTON_SIZES[0]),
      },
    }),
  }
}

/**
 * The kit's sections: blocks no template has, drawn by the kit in the look's own frame
 * (BlockSectionTextPicture, BlockSectionCards, BlockSectionQuestions, BlockSectionLayout). Spread them next to
 * `kitEntryBlocks()` in a template's page blocks. Their names start with `section_`.
 *
 * Layout holds small blocks (a heading, a text, a picture, a button) and groups of them, in a row,
 * a stack or a grid: three levels at most (page, section, group), written out, not recursive. Its
 * settings are choices from short lists; nothing is set in pixels or per screen size.
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
          segments: true,
          icons: { right: 'i-lucide-panel-right', left: 'i-lucide-panel-left' },
          labels: {
            right: { en: 'Right', cs: 'Vpravo', de: 'Rechts' },
            left: { en: 'Left', cs: 'Vlevo', de: 'Links' },
          },
        }).label({ en: 'Picture on the', cs: 'Obrázek', de: 'Bild' })
          .help({
            en: 'On a phone the picture is above the text.',
            cs: 'Na telefonu je obrázek nad textem.',
            de: 'Auf dem Telefon steht das Bild über dem Text.',
          })
          .setting(),
        size: f.select({
          options: [...SECTION_SIZES],
          default: SECTION_SIZES[0],
          segments: true,
          labels: {
            half: { en: 'Half', cs: 'Polovina', de: 'Hälfte' },
            third: { en: 'A third', cs: 'Třetina', de: 'Ein Drittel' },
          },
        }).label({ en: 'Picture size', cs: 'Velikost obrázku', de: 'Bildgröße' }).setting(),
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
        ...entryChoices(true),
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
          segments: true,
          labels: {
            folded: { en: 'Folded', cs: 'Sbalené', de: 'Eingeklappt' },
            open: { en: 'Open', cs: 'Rozbalené', de: 'Aufgeklappt' },
          },
        }).label({ en: 'Answers', cs: 'Odpovědi', de: 'Antworten' }).setting(),
        ...sectionSettings(),
      },
    }),
    section_layout: defineBlock({
      label: { en: 'Layout', cs: 'Rozvržení', de: 'Layout' },
      description: {
        en: 'Headings, texts, pictures and buttons in a row, a stack or a grid.',
        cs: 'Nadpisy, texty, obrázky a tlačítka vedle sebe, pod sebou nebo v mřížce.',
        de: 'Überschriften, Texte, Bilder und Knöpfe nebeneinander, untereinander oder im Raster.',
      },
      icon: 'i-lucide-layout-dashboard',
      fields: {
        items: f.blocks({
          ...smallBlocks(),
          group: defineBlock({
            label: { en: 'Group', cs: 'Skupina', de: 'Gruppe' },
            description: {
              en: 'Small blocks that stand together, as one block of the layout.',
              cs: 'Malé bloky, které drží pohromadě jako jeden blok rozvržení.',
              de: 'Kleine Blöcke, die als ein Block des Layouts zusammenstehen.',
            },
            icon: 'i-lucide-group',
            fields: {
              items: f.blocks(smallBlocks(), { max: GROUP_MAX }).label({ en: 'Blocks', cs: 'Bloky', de: 'Blöcke' }),
              arrangement: f.select({ options: ['stack', 'row'], default: GROUP_ARRANGEMENTS[0], segments: true, labels: ARRANGEMENT_LABELS, icons: ARRANGEMENT_ICONS })
                .label(arrangementLabel).help(arrangementHelp).setting(),
              ...spacing(),
              size: itemSize(),
            },
          }),
        }, { max: LAYOUT_MAX }).label({ en: 'Blocks', cs: 'Bloky', de: 'Blöcke' }),
        arrangement: f.select({ options: ['row', 'stack', 'grid'], default: LAYOUT_ARRANGEMENTS[0], segments: true, labels: ARRANGEMENT_LABELS, icons: ARRANGEMENT_ICONS })
          .label(arrangementLabel).help(arrangementHelp).setting(),
        ...spacing(),
        columns: f.select({
          options: ['2', '3', '4'],
          default: LAYOUT_COLUMNS[0],
          segments: true,
          labels: { 2: { en: '2', cs: '2', de: '2' }, 3: { en: '3', cs: '3', de: '3' }, 4: { en: '4', cs: '4', de: '4' } },
        }).label({ en: 'Most side by side', cs: 'Nejvíc vedle sebe', de: 'Höchstens nebeneinander' })
          .help({
            en: 'For a grid. On a wide screen; narrow screens show fewer, a phone shows one.',
            cs: 'Pro mřížku. Na široké obrazovce; na užší jich je méně, na telefonu jeden.',
            de: 'Für ein Raster. Auf einem breiten Bildschirm; schmalere zeigen weniger, ein Telefon einen.',
          })
          .setting(),
        ...sectionSettings(),
      },
    }),
  }
}
