import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'
import { OWN_COLOR_FIELD } from 'tinyzoo-template-kit/looks'
import { kitEntryBlocks, kitSections } from 'tinyzoo-template-kit/sections'

// The content model of the Blog template: what a magazine's editors can write and change. One
// model for both looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou.',
  en: 'Text between *asterisks* stands out, for example in italics.',
}

// ── the whole site: the magazine, its publisher, the header and the footer ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The name, the publisher, the look and the colours.', cs: 'Název, vydavatel, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'tagline', 'look', 'colors', 'ownColor'] },
      { label: { en: 'Header', cs: 'Záhlaví' }, fields: ['ctaLabel', 'ctaUrl', 'aboutLabel', 'aboutUrl'] },
      { label: { en: 'Publisher and editorial office', cs: 'Vydavatel a redakce' }, fields: ['publisher', 'address', 'companyId', 'registration', 'email', 'phone', 'bankAccount', 'foundedYear'] },
      { label: { en: 'Footer', cs: 'Zápatí' }, fields: ['footerNote', 'copyNote', 'social'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the magazine', cs: 'Název magazínu' })
      .help({ en: 'It is the page’s main heading: Cover sets it large across the first screen, Quarter of an Hour in lowercase in the header, and both repeat it in the footer.', cs: 'Je to hlavní nadpis stránky: Obálka ho vysází velkým písmem přes celou první obrazovku, Čtvrthodinka malými písmeny v záhlaví, oba ho zopakují v zápatí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'A small picture of your name. It stands in the header of pages other than the front page and in the footer, in place of the name written out.', cs: 'Malý obrázek vašeho názvu. Stojí v záhlaví ostatních stránek a v zápatí, místo názvu napsaného písmem.' }),
    tagline: f.text().optional().label({ en: 'Subtitle', cs: 'Podtitul' })
      .help({ en: 'A few words under the name, for example “Reading from the Highlands”.', cs: 'Pár slov pod názvem, například „Čtení z Vysočiny“.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    // The owner's own main colour: the palette of the chosen colours follows it (templates/kit/palette.ts).
    ownColor: f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' })
      .help({ en: 'For example “Newsletter”.', cs: 'Například „Newsletter“.' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    aboutLabel: f.text().optional().label({ en: 'Second button of the phone menu', cs: 'Druhé tlačítko mobilního menu' })
      .help({ en: 'Beside the header button, at the bottom of the menu on a phone: “About us”.', cs: 'Vedle tlačítka záhlaví, dole v menu na telefonu: „O nás“.' }),
    aboutUrl: f.text({ format: 'link' }).optional().label({ en: 'Its destination', cs: 'Jeho cíl' }),
    publisher: f.text().optional().label({ en: 'Publisher', cs: 'Vydavatel' }).help({ en: 'For example “Souvrať, z. s.”. It stands in the imprint.', cs: 'Například „Souvrať, z. s.“. Stojí v tiráži.' }),
    address: f.text().optional().label({ en: 'Address', cs: 'Adresa' }),
    companyId: f.text().optional().label({ en: 'Company number', cs: 'IČO' }),
    registration: f.text().optional().label({ en: 'ISSN and registration', cs: 'ISSN a registrace' }).help({ en: 'For example “ISSN 1234-5678 · MK ČR E 12345”.', cs: 'Například „ISSN 1234-5678 · MK ČR E 12345“.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail of the editorial office', cs: 'E-mail redakce' }),
    phone: f.text().optional().label({ en: 'Phone of the editorial office', cs: 'Telefon redakce' }),
    bankAccount: f.text().optional().label({ en: 'Bank account for supporters', cs: 'Číslo účtu pro podporovatele' }).help({ en: 'Written under the support button of the “About” block.', cs: 'Napíše se pod tlačítko podpory v bloku „O nás“.' }),
    foundedYear: f.number({ int: true, min: 1800, max: 2200 }).optional().label({ en: 'Founded in', cs: 'Vychází od roku' })
      .help({ en: 'The first year of the copyright line in the footer: “© 2019–2026”.', cs: 'První rok v řádku s právy v zápatí: „© 2019–2026“.' }),
    footerNote: f.text().optional().label({ en: 'Line under the name in the footer', cs: 'Věta pod názvem v zápatí' }).help({ en: 'It follows the subtitle: “Comes out every week since 2019.”', cs: 'Navazuje na podtitul: „Vychází každý týden od roku 2019.“' }),
    copyNote: f.text().optional().label({ en: 'Copyright note', cs: 'Poznámka k právům' }).help({ en: 'After the years and the name: “Please do not copy texts and photographs without our consent.”', cs: 'Za roky a názvem: „Texty a fotografie nepřebírejte bez svolení redakce.“' }),
    social: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }).help({ en: 'For example “Instagram” or “RSS”.', cs: 'Například „Instagram“ nebo „RSS“.' }),
        url: f.text({ format: 'link', required: true }).label({ en: 'Address', cs: 'Adresa' }),
      },
      max: 8, itemLabel: { en: 'Link', cs: 'Odkaz' },
    }).label({ en: 'Where to follow us', cs: 'Kde nás sledovat' })
      .help({ en: 'The “Subscribe” column of the footer, after the newsletter.', cs: 'Sloupec „Odebírat“ v zápatí, za newsletterem.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── sections: what the articles are filed under ──
export const Section = defineEntity('section', {
  label: { en: 'Sections', cs: 'Rubriky' },
  labelSingular: { en: 'Section', cs: 'Rubrika' },
  description: { en: 'The topics of the magazine. Every article belongs to one. Drag to put them in order.', cs: 'Témata magazínu. Každý článek patří do jedné z nich. Pořadí změníte přetažením.' },
  icon: 'i-lucide-folders',
  titleField: 'name',
  admin: { list: { columns: ['name', 'description'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Short description', cs: 'Krátký popis' })
      .help({ en: 'One line under the name, and the introduction of the section’s page.', cs: 'Jeden řádek pod názvem a úvod stránky rubriky.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, slug: 'slug', path: '/rubrika/:slug' },
})

// ── authors ──
export const Author = defineEntity('author', {
  label: { en: 'Authors', cs: 'Autoři' },
  labelSingular: { en: 'Author', cs: 'Autor' },
  description: { en: 'Who writes. Each author has a page with their articles.', cs: 'Kdo píše. Každý autor má stránku se svými články.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  admin: { list: { columns: ['photo', 'name', 'role'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Portrait', cs: 'Portrét' })
      .help({ en: 'A portrait, 4:5 if you can. Cover shows it as it is, Quarter of an Hour cuts it into a circle around the face.', cs: 'Portrét, pokud možno 4:5. Obálka ho ukáže celý, Čtvrthodinka ho ořízne do kruhu kolem obličeje.' }),
    role: f.text().optional().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “editor-in-chief” or “landscape and crafts”.', cs: 'Například „šéfredaktorka“ nebo „krajina a řemeslo“.' }),
    bio: f.text({ multiline: true }).optional().label({ en: 'One or two sentences about them', cs: 'Jedna až dvě věty o autorovi' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, slug: 'slug', path: '/autor/:slug' },
})

// ── series: a run of articles that belong together ──
export const Series = defineEntity('series', {
  label: { en: 'Series', cs: 'Seriály' },
  labelSingular: { en: 'Series', cs: 'Seriál' },
  description: { en: 'A run of articles that belong together, for example one a month for a year. The parts are the articles that name the series.', cs: 'Řada článků, které patří k sobě, třeba jeden měsíčně po celý rok. Díly jsou články, které seriál uvádějí.' },
  icon: 'i-lucide-library',
  titleField: 'name',
  admin: { list: { columns: ['image', 'name', 'plannedParts'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Description', cs: 'Popis' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Cover lays it across the left of the dark band, Quarter of an Hour in a circle in the middle of the clock. A wide one works best.', cs: 'Obálka ji položí na levou část tmavého pásu, Čtvrthodinka do kruhu uprostřed ciferníku. Nejlépe široká.' }),
    plannedParts: f.number({ int: true, min: 1, max: 100 }).optional().label({ en: 'Number of parts', cs: 'Plánovaný počet dílů' })
      .help({ en: 'How many parts there will be. The ones not out yet are drawn as empty places. Quarter of an Hour’s clock holds twelve.', cs: 'Kolik dílů bude. Ty, které ještě nevyšly, se nakreslí jako prázdná místa. Ciferník Čtvrthodinky jich unese dvanáct.' }),
    byMonth: f.boolean().label({ en: 'One part a month', cs: 'Jeden díl měsíčně' })
      .help({ en: 'The parts carry the names of the months: part 1 is January. Turn it off for a series without months.', cs: 'Díly nesou názvy měsíců: první díl je leden. U seriálu bez měsíců vypněte.' }),
    nextDate: f.datetime({ allDay: true }).optional().label({ en: 'Next part comes out', cs: 'Další díl vyjde' })
      .help({ en: 'Written in the empty place of the next part: “comes out 19 December”.', cs: 'Napíše se do prázdného místa dalšího dílu: „vyjde 19. prosince“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, slug: 'slug', path: '/serial/:slug' },
})

// ── articles ──
export const Article = defineEntity('article', {
  label: { en: 'Articles', cs: 'Články' },
  labelSingular: { en: 'Article', cs: 'Článek' },
  description: { en: 'Everything you publish. Newest first on the website.', cs: 'Všechno, co vydáte. Na webu nejnovější první.' },
  icon: 'i-lucide-newspaper',
  titleField: 'title',
  admin: { list: { columns: ['image', 'title', 'section', 'author', 'publishedAt', 'status'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Headline', cs: 'Titulek' }),
    shortTitle: f.text().optional().label({ en: 'Short headline', cs: 'Krátký titulek' })
      .help({ en: 'For a long headline: the shorter one that the list of sections uses. Empty: the headline.', cs: 'U dlouhého titulku: kratší verze pro výpis v rubrikách. Prázdné: titulek.' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    kind: f.select({
      options: ['article', 'column'] as const, default: 'article',
      labels: { article: { en: 'Article', cs: 'Článek' }, column: { en: 'Column', cs: 'Sloupek' } },
    }).label({ en: 'Kind', cs: 'Druh' })
      .help({ en: 'A column is a short personal text. Cover names it “Column” in lists instead of the section and sets its headline in italics.', cs: 'Sloupek je krátký osobní text. Obálka ho v seznamech označí „Sloupek“ místo rubriky a titulek vysází kurzivou.' }),
    perex: f.text({ multiline: true }).optional().label({ en: 'Standfirst', cs: 'Perex' })
      .help({ en: 'Two sentences under the headline. It is also what search engines show.', cs: 'Dvě věty pod titulkem. Je to i text, který ukážou vyhledávače.' }),
    body: f.richtext().optional().label({ en: 'Text', cs: 'Text' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Without one the article is listed without a picture; the lists that show pictures set it in larger type instead.', cs: 'Bez fotografie se článek v seznamech ukáže bez obrázku; seznamy s obrázky ho vysází větším písmem.' }),
    imageCaption: f.text().optional().label({ en: 'Caption', cs: 'Popisek fotografie' }),
    imageCredit: f.text().optional().label({ en: 'Photo by', cs: 'Autor fotografie' }),
    author: f.relation({ to: () => Author, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Author', cs: 'Autor' }),
    section: f.relation({ to: () => Section, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Section', cs: 'Rubrika' }),
    publishedAt: f.datetime({ allDay: true }).optional().label({ en: 'Date', cs: 'Datum vydání' })
      .help({ en: 'The day shown on the website. Newer articles come first.', cs: 'Den, který se ukáže na webu. Novější články jsou první.' }),
    readingMinutes: f.number({ int: true, min: 1, max: 600 }).optional().label({ en: 'Reading time in minutes', cs: 'Doba čtení v minutách' })
      .help({ en: 'Leave it empty and it is counted from the text (200 words a minute). Quarter of an Hour draws a clock from it.', cs: 'Když pole necháte prázdné, spočítá se z textu (200 slov za minutu). Čtvrthodinka z ní kreslí ciferník.' }),
    lead: f.boolean().label({ en: 'Lead article', cs: 'Hlavní článek' })
      .help({ en: 'The article that opens the front page. Only the newest of those marked is used.', cs: 'Článek, kterým se otevírá titulní strana. Použije se jen nejnovější z označených.' }),
    pick: f.boolean().label({ en: 'Editors’ pick', cs: 'Výběr redakce' })
      .help({ en: 'The three larger articles under the opening of the front page (the newest three of those marked).', cs: 'Tři větší články pod úvodem titulní strany (nejnovější tři z označených).' }),
    brief: f.boolean().label({ en: 'In brief', cs: 'Krátce' })
      .help({ en: 'Short articles. Cover prints them as cover lines on the first screen; Quarter of an Hour adds them to its list.', cs: 'Krátké texty. Obálka je vytiskne jako řádky na obálce, Čtvrthodinka je přidá do svého seznamu.' }),
    mostReadRank: f.number({ int: true, min: 1, max: 20 }).optional().label({ en: 'Place among the most read', cs: 'Místo mezi nejčtenějšími' })
      .help({ en: '1 is the most read. Leave it empty if the article is not in the list. You update the list yourself.', cs: '1 je nejčtenější. Pokud článek v seznamu není, nechte prázdné. Seznam si aktualizujete sami.' }),
    series: f.relation({ to: () => Series, kind: 'many-to-one', onDelete: 'set null' }).optional().label({ en: 'Series', cs: 'Seriál' })
      .help({ en: 'Only for a part of a series. Parts are not listed with the other articles, but in their series.', cs: 'Jen pro díl seriálu. Díly se nevypisují mezi ostatními články, ale v seriálu.' }),
    seriesPart: f.number({ int: true, min: 1, max: 100 }).optional().label({ en: 'Part number', cs: 'Číslo dílu' })
      .help({ en: 'Of a monthly series the month: part 11 is November. Write the headline as “November: the first snow”; the lists show what follows the colon.', cs: 'U měsíčního seriálu zároveň měsíc: díl 11 je listopad. Titulek pište „Listopad: první sníh“; seznamy ukážou to, co je za dvojtečkou.' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/clanek/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/clanek/:slug',
    populate: ['author', 'section', 'series', 'image', 'ogImage'],
  },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })

const front = defineBlock({
  label: { en: 'Front page', cs: 'Titulní strana' },
  description: { en: 'The lead article on the first screen. Put it first on the page. Cover gives it the whole screen with the name across the sky and the short articles as cover lines; Quarter of an Hour asks how much time the reader has.', cs: 'Hlavní článek na první obrazovce. Dejte ho na stránce jako první. Obálka mu dá celou obrazovku s názvem přes oblohu a krátkými články jako řádky na obálce; Čtvrthodinka se ptá, kolik má čtenář času.' },
  icon: 'i-lucide-newspaper',
  fields: {
    briefHeading: f.text().label({ en: 'Heading of the short articles', cs: 'Nadpis krátkých článků' }).help({ en: 'Cover: the line above the cover lines, for example “In brief”. Quarter of an Hour adds the short articles to its list and does not use it.', cs: 'Obálka: řádek nad řádky na obálce, například „Krátce“. Čtvrthodinka krátké články přidá do svého seznamu a nadpis nepoužije.' }),
    question: f.text().label({ en: 'Question for the reader', cs: 'Otázka čtenáři' }).help({ en: 'Quarter of an Hour: the large question with the three choices (five minutes, a quarter of an hour, a whole evening), for example “How much time do you have?”. Cover sets it as a line above the lead headline, if there is one.', cs: 'Čtvrthodinka: velká otázka se třemi možnostmi (pět minut, čtvrt hodiny, celý večer), například „Kolik máte času?“. Obálka ji, je-li vyplněná, napíše jako řádek nad titulkem hlavního článku.' }),
    leadLabel: f.text().label({ en: 'Label of the lead article', cs: 'Označení hlavního článku' }).help({ en: 'Quarter of an Hour: a few words beside the section, for example “Lead article of the week”.', cs: 'Čtvrthodinka: pár slov vedle rubriky, například „Hlavní článek týdne“.' }),
  },
})

const picks = defineBlock({
  label: { en: 'Larger articles', cs: 'Větší články' },
  description: { en: 'The three articles marked as the editors’ pick, with photographs.', cs: 'Tři články označené jako výběr redakce, s fotografiemi.' },
  icon: 'i-lucide-layout-panel-top',
  fields: {
    heading: heading(),
    note: f.text().label({ en: 'Line beside the heading', cs: 'Řádek vedle nadpisu' }).help({ en: 'Quarter of an Hour writes it beside the heading, for example “Three texts, each for one coffee”. Cover writes how many articles there are and how long they take to read.', cs: 'Čtvrthodinka ho napíše vedle nadpisu, například „Tři texty, každý na jednu kávu“. Obálka tam napíše, kolik je článků a kolik času zaberou.' }),
    linkUrl: link('Where the line beside the heading leads', 'Kam vede odkaz vedle nadpisu').help({ en: 'Cover: the line with the number of articles is a link, for example to the list of all articles.', cs: 'Obálka: řádek s počtem článků je odkaz, například na seznam všech článků.' }),
  },
})

const list = defineBlock({
  label: { en: 'List of articles', cs: 'Seznam článků' },
  description: { en: 'The latest articles as a denser list. Cover sets it as a contents page with small photographs; Quarter of an Hour as a staircase of bars sorted by reading time.', cs: 'Nejnovější články jako hustší seznam. Obálka ho sestaví jako obsah s malými fotografiemi, Čtvrthodinka jako schody z pruhů seřazené podle délky čtení.' },
  icon: 'i-lucide-list',
  fields: {
    heading: heading(),
    text: text().help({ en: 'Cover writes it under the heading. Quarter of an Hour has its own line about the bars there.', cs: 'Obálka ho napíše pod nadpis. Čtvrthodinka tam má vlastní větu o pruzích.' }),
    scope: f.select({
      options: ['rest', 'all'] as const, default: 'rest',
      labels: { rest: { en: 'Those not shown above', cs: 'Ty, které nejsou výše' }, all: { en: 'All of them', cs: 'Všechny' } },
    }).label({ en: 'Which articles', cs: 'Které články' })
      .help({ en: 'The first leaves out the lead article and the editors’ picks, which the page shows above (and, in Cover, the short articles on the cover). A page of all articles takes the second.', cs: 'První vynechá hlavní článek a výběr redakce, které stránka ukazuje výše (a v Obálce krátké články z obálky). Stránka se všemi články vezme druhou možnost.' }),
    count: f.number({ int: true, min: 1, max: 100 }).label({ en: 'How many', cs: 'Kolik jich' })
      .help({ en: 'Quarter of an Hour adds the short articles to this number, so its staircase is longer.', cs: 'Čtvrthodinka k tomuto počtu přidá krátké články, takže její schody jsou delší.' }),
    links: f.list({
      fields: { label: f.text({ required: true }).label({ en: 'Text', cs: 'Text' }), url: f.text({ format: 'link', required: true }).label({ en: 'Destination', cs: 'Cíl' }) },
      max: 4, itemLabel: { en: 'Link', cs: 'Odkaz' },
    }).label({ en: 'Links', cs: 'Odkazy' })
      .help({ en: 'Cover shows all of them under the text. Quarter of an Hour shows the first one, under the list.', cs: 'Obálka je ukáže všechny pod textem. Čtvrthodinka první z nich pod seznamem.' }),
  },
})

const series = defineBlock({
  label: { en: 'Series', cs: 'Seriál' },
  description: { en: 'The series that has the newest part: its latest part, and all the parts. Cover sets it as a dark band with the photograph, Quarter of an Hour as a year drawn as a clock.', cs: 'Seriál s nejnovějším dílem: jeho poslední díl a všechny díly. Obálka ho sestaví jako tmavý pás s fotografií, Čtvrthodinka jako rok nakreslený jako ciferník.' },
  icon: 'i-lucide-library',
  fields: {
    eyebrow: eyebrow().help({ en: 'Cover: for example “Series”, and the part’s number follows it. Quarter of an Hour writes it large above the clock, for example “For a whole evening”.', cs: 'Obálka: například „Seriál“, za ním následuje číslo dílu. Čtvrthodinka ho napíše velkým písmem nad ciferníkem, například „Na celý večer“.' }),
    partsLabel: f.text().label({ en: 'Line above all the parts', cs: 'Řádek nad všemi díly' }).help({ en: 'Cover: for example “All the parts”.', cs: 'Obálka: například „Všechny díly“.' }),
  },
})

const sections = defineBlock({
  label: { en: 'Sections', cs: 'Rubriky' },
  description: { en: 'Every section with its latest three articles. Each section has a page of its own.', cs: 'Každá rubrika s třemi nejnovějšími články. Každá rubrika má vlastní stránku.' },
  icon: 'i-lucide-folders',
  fields: {
    heading: heading(),
    text: text(),
  },
})

const newsletter = defineBlock({
  label: { en: 'Newsletter and most read', cs: 'Newsletter a nejčtenější' },
  description: { en: 'The most read articles (the ones with a place in the list) beside the sign-up to the newsletter. The sign-ups arrive in the admin.', cs: 'Nejčtenější články (ty, které mají místo v seznamu) vedle přihlášení k newsletteru. Přihlášky najdete v administraci.' },
  icon: 'i-lucide-mail',
  fields: {
    mostReadHeading: f.text().label({ en: 'Heading of the most read', cs: 'Nadpis nejčtenějších' }).help({ en: 'Leave it empty to leave the list out: the newsletter then stands alone.', cs: 'Když pole necháte prázdné, seznam se vynechá a newsletter stojí sám.' }),
    eyebrow: eyebrow().help({ en: 'For example “Newsletter”.', cs: 'Například „Newsletter“.' }),
    schedule: f.text().label({ en: 'When it comes', cs: 'Kdy chodí' }).help({ en: 'For example “every Sunday at 7.00”. It follows the line above the heading.', cs: 'Například „každou neděli v 7.00“. Navazuje na řádek nad nadpisem.' }),
    minutes: f.number({ int: true, min: 1, max: 60 }).label({ en: 'Minutes of reading', cs: 'Minut čtení' }).help({ en: 'Quarter of an Hour draws a clock with this wedge beside the line above the heading.', cs: 'Čtvrthodinka vedle řádku nad nadpisem nakreslí ciferník s touto výsečí.' }),
    heading: heading(),
    text: text(),
    consentUrl: link('Page with the privacy policy', 'Stránka se zásadami ochrany údajů'),
  },
})

const authors = defineBlock({
  label: { en: 'Authors', cs: 'Autoři' },
  description: { en: 'Everyone who writes, with a portrait, a few words and the number of articles. Each author has a page of their own.', cs: 'Všichni, kdo píšou, s portrétem, pár slovy a počtem článků. Každý autor má vlastní stránku.' },
  icon: 'i-lucide-users',
  fields: {
    heading: heading(),
    text: text(),
  },
})

const about = defineBlock({
  label: { en: 'About, support, advertising', cs: 'O nás, podpora, inzerce' },
  description: { en: 'A few words about the magazine and three short texts beside them. The e-mail and the phone are from Site settings.', cs: 'Pár slov o magazínu a vedle nich tři krátké texty. E-mail a telefon jsou z Nastavení webu.' },
  icon: 'i-lucide-info',
  fields: {
    heading: heading(),
    text: text().help({ en: 'Cover sets all of it large and the part between *asterisks* in italics. Quarter of an Hour sets the first sentence bold and the rest as a standfirst.', cs: 'Obálka ho vysází celý velkým písmem a část mezi *hvězdičkami* kurzivou. Čtvrthodinka vysází první větu tučně a zbytek jako perex.' }),
    supportHeading: f.text().label({ en: 'Support: heading', cs: 'Podpora: nadpis' }),
    supportText: f.text({ multiline: true }).label({ en: 'Support: text', cs: 'Podpora: text' }),
    supportLabel: f.text().label({ en: 'Support: button text', cs: 'Podpora: text tlačítka' }),
    supportUrl: link('Support: button destination', 'Podpora: cíl tlačítka'),
    adHeading: f.text().label({ en: 'Advertising: heading', cs: 'Inzerce: nadpis' }),
    adText: f.text({ multiline: true }).label({ en: 'Advertising: text', cs: 'Inzerce: text' }),
    writeHeading: f.text().label({ en: 'Contact: heading', cs: 'Kontakt: nadpis' }),
    writeText: f.text({ multiline: true }).label({ en: 'Contact: text', cs: 'Kontakt: text' }),
  },
})

const search = defineBlock({
  label: { en: 'Search results', cs: 'Výsledky hledání' },
  description: { en: 'What the search box in the header looks for. Put it on the page with the address “hledat”.', cs: 'Co hledá vyhledávání v záhlaví. Patří na stránku s adresou „hledat“.' },
  icon: 'i-lucide-search',
  fields: {
    heading: heading(),
    text: text().help({ en: 'Shown before anything is searched for.', cs: 'Ukáže se, dokud se nic nehledá.' }),
  },
})

const richText = defineBlock({
  label: { en: 'Text', cs: 'Text' },
  description: { en: 'Paragraphs, headings, lists and links.', cs: 'Odstavce, nadpisy, seznamy a odkazy.' },
  icon: 'i-lucide-text',
  fields: {
    heading: heading(false),
    body: f.richtext().label({ en: 'Text', cs: 'Text' }),
  },
})

// Pages built from blocks: title, address, status, blocks, SEO, preview.
export const Page = definePages({
  blocks: { front, picks, list, series, sections, newsletter, authors, about, search, text: richText, ...kitEntryBlocks(), ...kitSections() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    legal: { en: 'Links in the footer', cs: 'Odkazy v zápatí' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the sign-ups of the form below
]

// ── the newsletter ──
// The website draws it per look (the kit's useSiteForm); the block "Newsletter and most read" words around it.
export const Subscription = defineForm('newsletter', {
  label: { en: 'Newsletter sign-ups', cs: 'Odběratelé newsletteru' },
  labelSingular: { en: 'Subscriber', cs: 'Odběratel' },
  fields: {
    email: f.text({ required: true, format: 'email', max: 200 }).label({ en: 'Your e-mail', cs: 'Váš e-mail' }),
  },
  titleField: 'email',
  submitLabel: { en: 'Subscribe', cs: 'Odebírat' },
  successMessage: { en: 'Thank you. The first issue comes on Sunday.', cs: 'Děkujeme. První číslo vám přijde v neděli.' },
})
export const FormSettings = defineFormSettings()
