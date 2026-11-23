// The templates a website can start from. Two really exist today: `basic`, built from
// packages/cms/starter, and `photographer`, from templates/photographer. The other nineteen
// are planned: their designs are finished and approved, so the gallery shows each as it will
// look, but only with NUXT_PUBLIC_SHOW_PLANNED=true, marked as not available and not
// selectable. A customer never sees them without the flag, and the server refuses to make a
// site from one (`ready: false`) whatever the flag says.
//
// A template may come in several looks: one content model and one build, drawn in different
// designs. The person picks one when making the site; it is written into the site's settings
// (the fields `look` and `colors`), where its owner can change it later. A ready template's
// look ids are the ones the template itself lists (templates/<id>/looks.ts): a unit spec keeps
// the two equal. A planned template's looks are its approved designs.
//
// The pictures (cloud/public/templates/) and what is measured about them are made by
// `pnpm --filter tinyzoo-cloud pictures` (scripts/template-pictures.mjs), which also writes
// template-pictures.json beside this file. This file holds the words a person reads; a unit
// spec keeps its looks equal to the ones that script found.
import PICTURES from './template-pictures.json'

export type Locale = 'cs' | 'en'
export type L = Record<Locale, string>

export const FIELD_IDS = ['general', 'personal', 'services', 'hospitality', 'community', 'property', 'business'] as const
export type FieldId = typeof FIELD_IDS[number]

/** The fields of the gallery's filter, in order. */
export const FIELDS: Record<FieldId, L> = {
  general: { cs: 'Univerzální', en: 'General' },
  personal: { cs: 'Osobní a tvůrčí', en: 'Personal and creative' },
  services: { cs: 'Služby a řemesla', en: 'Services and trades' },
  hospitality: { cs: 'Jídlo a ubytování', en: 'Food and stays' },
  community: { cs: 'Sport a komunita', en: 'Sport and community' },
  property: { cs: 'Reality a stavby', en: 'Property and building' },
  business: { cs: 'Obchod a produkty', en: 'Shops and products' },
}

/** One design of a template. */
export interface LookDef {
  /** As the template's own looks.ts names it: what is written into the site's settings. */
  id: string
  name: L
  /** One sentence: what the look is like. */
  description: L
  /** The look's default colours, as the template names them: written into the settings beside the look. Only a ready template has them. */
  colors?: string
}

export interface TemplateDef {
  id: string
  /** Whether a website can be made from it today. */
  ready: boolean
  field: FieldId
  name: L
  /** One sentence: what the website holds. */
  description: L
  /** Three or four short points for the card. */
  features: L[]
  /** The template's source folder, from the repository's root (its build is `<sourceDir>/.output`). Null until it exists. */
  sourceDir: string | null
  /** Whether the template brings demo content (`seed/index.ts`, put in with `tinyzoo seed`). */
  seed: boolean
  /** The animal that stands for it (the being-made scene, an empty place). */
  animal: string
  /** Its looks, the default first. Empty for a template with one design and no name for it (Basic). */
  looks: LookDef[]
}

const look = (id: string, cs: string, en: string, csText: string, enText: string): LookDef => ({ id, name: { cs, en }, description: { cs: csText, en: enText } })
const planned = (id: string, field: FieldId, animal: string, name: L, description: L, features: L[], looks: LookDef[]): TemplateDef =>
  ({ id, ready: false, field, name, description, features, sourceDir: null, seed: false, animal, looks })

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'basic',
    ready: true,
    field: 'general',
    name: { cs: 'Základní web', en: 'Basic website' },
    description: {
      cs: 'Úvodní stránka, další stránky, aktuality a kontakt. Dobrý začátek pro jakýkoli obor.',
      en: 'A home page, more pages, news and contact. A good start for any field.',
    },
    features: [
      { cs: 'Stránky skládané z bloků', en: 'Pages built from blocks' },
      { cs: 'Aktuality', en: 'News' },
      { cs: 'Kontakt a otevírací doba', en: 'Contact and opening hours' },
      { cs: 'Česky a anglicky', en: 'Czech and English' },
    ],
    sourceDir: 'packages/cms/starter',
    seed: true,
    animal: 'elephant',
    looks: [],
  },
  planned('individual', 'personal', 'fox',
    { cs: 'Živnostník a konzultant', en: 'Freelancer and consultant' },
    { cs: 'Kdo jste, co nabízíte a co jste pro klienty udělali: služby s cenami, projekty a reference.', en: 'Who you are, what you offer and what you did for clients: services with prices, projects and references.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Projekty a reference', en: 'Projects and references' }, { cs: 'Články', en: 'Articles' }],
    [
      look('vizitka', 'Vizitka', 'Business Card', 'Dobře vytištěná vizitka: plocha vaší barvy, pevné patkové písmo a služby jako skutečný ceník.', 'A well-printed business card: a panel of your colour, a sturdy serif and services set as a real price list.'),
      look('zvyraznovac', 'Zvýrazňovač', 'Highlighter', 'Plakát s jednou velkou větou: barva zvýrazňovače, černá na bílé a zvýrazněná slova, na kterých záleží.', 'A poster with one big sentence: marker colour, black on white and the words that matter highlighted.'),
      look('rozhovor', 'Rozhovor', 'Conversation', 'Stránka jako rozhovor: otázky návštěvníků v bublinách, vaše odpovědi pod nimi, měkké a vlídné tvary.', 'A page like a conversation: visitors’ questions in speech bubbles, your answers under them, soft and warm shapes.'),
    ]),
  {
    id: 'photographer',
    ready: true,
    field: 'personal',
    name: { cs: 'Fotograf', en: 'Photographer' },
    description: { cs: 'Galerie zakázek, balíčky focení a poptávka termínu.', en: 'Galleries of your work, shooting packages and a date request.' },
    features: [
      { cs: 'Galerie a alba', en: 'Galleries and albums' },
      { cs: 'Balíčky a ceny', en: 'Packages and prices' },
      { cs: 'Poptávka termínu', en: 'Date request' },
    ],
    sourceDir: 'templates/photographer',
    seed: true,
    animal: 'owl',
    looks: [
      {
        id: 'atelier',
        name: { cs: 'Ateliér', en: 'Atelier' },
        description: { cs: 'Klidná galerijní stěna: bílý papír, jemné linky a tenké patkové písmo.', en: 'A quiet gallery wall: white paper, fine lines and a thin serif.' },
        colors: 'bronz',
      },
      {
        id: 'negativ',
        name: { cs: 'Negativ', en: 'Negative' },
        description: { cs: 'Tmavý a výrazný: fotky od kraje ke kraji a velké titulky.', en: 'Dark and striking: photographs from edge to edge and large headlines.' },
        colors: 'mosaz',
      },
      {
        id: 'zapisnik',
        name: { cs: 'Zápisník', en: 'Notebook' },
        description: { cs: 'Osobní album: fotky s bílým okrajem a ručně psané poznámky.', en: 'A personal album: prints with white borders and handwritten notes.' },
        colors: 'inkoust',
      },
    ],
  },
  planned('wedding', 'personal', 'butterfly',
    { cs: 'Svatba', en: 'Wedding' },
    { cs: 'Web pro svatební hosty: program dne, místo, ubytování, dary a potvrzení účasti.', en: 'A site for wedding guests: the programme of the day, the venue, places to stay, gifts and RSVP.' },
    [{ cs: 'Program dne', en: 'Programme of the day' }, { cs: 'Místo a ubytování', en: 'Venue and places to stay' }, { cs: 'Dary', en: 'Gifts' }, { cs: 'Potvrzení účasti', en: 'RSVP' }],
    [
      look('oznameni', 'Oznámení', 'Announcement', 'Tištěné svatební oznámení: jedno klasické písmo, jména na střed a fotografie v paspartě.', 'A printed wedding announcement: one classic typeface, centred names and matted photographs.'),
      look('vecer', 'Večer', 'Evening', 'Svatební večer: tmavá stránka se světýlky, jména v jemné kurzivě a kartička pro odpověď.', 'The evening of the wedding: a dark page with strings of lights, names in a light italic and a reply card.'),
      look('magazin', 'Magazín', 'Magazine', 'Dvoustrana ze svatebního časopisu: bílá stránka, velká jména a fotografie přes celé sloupce.', 'A spread from a wedding magazine: a white page, large names and photographs across whole columns.'),
    ]),
  planned('blog', 'personal', 'bird',
    { cs: 'Blog a magazín', en: 'Blog and magazine' },
    { cs: 'Články, rubriky, seriály, autoři a odběr novinek.', en: 'Articles, sections, series, authors and a newsletter.' },
    [{ cs: 'Články a rubriky', en: 'Articles and sections' }, { cs: 'Seriály', en: 'Series' }, { cs: 'Autoři', en: 'Authors' }, { cs: 'Newsletter', en: 'Newsletter' }],
    [
      look('obalka', 'Obálka', 'Cover', 'Úvodní stránka jako obálka časopisu: hlavní fotografie přes celou obrazovku a pod ní obsah čísla.', 'The home page as a magazine cover: the lead photograph fills the screen and the issue opens under it.'),
      look('ctvrthodinka', 'Čtvrthodinka', 'Quarter of an Hour', 'Kolik máte času: každý článek má ciferník s dobou čtení a police jsou pro pět minut, čtvrthodinku a celý večer.', 'How much time do you have: every article has a clock face with its reading time, and the shelves are for five minutes, a quarter of an hour and a whole evening.'),
    ]),
  planned('trades', 'services', 'hedgehog',
    { cs: 'Řemeslník a místní služby', en: 'Trades and local services' },
    { cs: 'Služby s cenami, kde působíte, ukázky zakázek a rychlá poptávka.', en: 'Services with prices, where you work, examples of jobs and a quick enquiry.' },
    [{ cs: 'Služby a ceny', en: 'Services and prices' }, { cs: 'Ukázky zakázek', en: 'Examples of jobs' }, { cs: 'Recenze', en: 'Reviews' }, { cs: 'Poptávka', en: 'Enquiry' }],
    [
      look('mistr', 'Mistr', 'Master', 'Stránka pečlivé firmy: teplý bílý papír, tenké linky a skutečný ceník s řádky a skupinami.', 'The careful firm’s page: warm white paper, hairlines and a real price list with rows and groups.'),
      look('reflex', 'Reflex', 'Hi-Vis', 'Reflexní vesta: signální barva, černé plochy a telefonní číslo jako největší věc na stránce.', 'A hi-vis vest: signal colour, black slabs and the phone number as the largest thing on the page.'),
    ]),
  planned('car-service', 'services', 'raccoon',
    { cs: 'Autoservis', en: 'Car service' },
    { cs: 'Služby a ceník, značky, které opravujete, sezónní akce a objednání termínu.', en: 'Services and prices, the makes you repair, seasonal offers and booking a date.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Značky', en: 'Makes' }, { cs: 'Sezónní akce', en: 'Seasonal offers' }, { cs: 'Objednání termínu', en: 'Booking a date' }],
    [
      look('cesta', 'Cesta', 'Road', 'Čistá světlá stránka s velkým klidným písmem a jednou sytou zelenou, oprava jako čtyři zastávky na jedné cestě.', 'A clean, bright page with large calm type and one deep green, the repair as four stops on one road.'),
      look('kontrolky', 'Kontrolky', 'Warning Lights', 'Palubní deska za soumraku: šest kontrolek, které vedou rovnou do ceníku.', 'The dashboard at dusk: six warning lights that lead straight into the price guide.'),
      look('supliky', 'Šuplíky', 'Drawers', 'Červený vozík na nářadí: ceník je skříňka a každá skupina služeb má svůj šuplík.', 'The red tool chest: the price guide is the chest and every group of services has its drawer.'),
    ]),
  planned('salon', 'services', 'poodle',
    { cs: 'Salon a kadeřnictví', en: 'Salon and hairdresser' },
    { cs: 'Ceník služeb, tým, fotky práce a objednání.', en: 'A price list, the team, photos of your work and booking.' },
    [{ cs: 'Ceník', en: 'Price list' }, { cs: 'Tým', en: 'Team' }, { cs: 'Fotky práce', en: 'Photos of your work' }, { cs: 'Objednání', en: 'Booking' }],
    [
      look('zrcadlo', 'Zrcadlo', 'Mirror', 'Zrcadlo za denního světla: klidná chladná stránka, fotografie v oválných zrcadlech a délka služby jako malý ciferník.', 'The salon mirror in daylight: a calm, cool page, photographs in oval mirrors and the length of a service as a small clock face.'),
      look('sachovnice', 'Šachovnice', 'Chessboard', 'Černobílá dlažba salonu: stránka v jedné výrazné barvě, široké písmo a čtvercové dlaždice.', 'The black-and-white salon floor: a page in one loud colour, wide type and square tiles.'),
      look('vyloha', 'Výloha', 'Shop Window', 'Písmo malované na výloze: tmavě zelená stránka, krémové a mosazné písmo a smaltované cedulky.', 'Lettering painted on the shop window: a dark green page, cream and brass type and enamel plates.'),
    ]),
  planned('medical', 'services', 'koala',
    { cs: 'Ordinace', en: 'Medical practice' },
    { cs: 'Ordinační hodiny, oznámení, služby, tým a žádost o termín.', en: 'Surgery hours, notices, services, the team and an appointment request.' },
    [{ cs: 'Ordinační hodiny', en: 'Surgery hours' }, { cs: 'Oznámení', en: 'Notices' }, { cs: 'Služby a tým', en: 'Services and team' }, { cs: 'Žádost o termín', en: 'Appointment request' }],
    [
      look('cekarna', 'Čekárna', 'Waiting Room', 'Čekárna za denního světla: bílá stránka s velkým klidným písmem a dnešní ordinační doba na jednom řádku.', 'The waiting room in daylight: a white page with large calm type and today’s hours on one line.'),
      look('cifernik', 'Ciferník', 'Clock Face', 'Hodiny z čekárny: každý den je ciferník, barevný tam, kde je otevřeno, a ručičky ukazují, kolik je právě teď.', 'The waiting-room clock: every day is a dial, coloured where the practice is open, and the hands show the time now.'),
    ]),
  planned('office', 'services', 'penguin',
    { cs: 'Účetní, advokát a architekt', en: 'Accountant, lawyer and architect' },
    { cs: 'Služby s cenami, tým, případy z praxe a články.', en: 'Services with prices, the team, cases from practice and articles.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Tým', en: 'Team' }, { cs: 'Případy z praxe', en: 'Cases from practice' }],
    [
      look('lhuty', 'Lhůty', 'Deadlines', 'Kancelář žije lhůtami: pod úvodem běží pravítko s nejbližšími termíny a stejné dílky řadí i zbytek stránky.', 'An office lives by deadlines: a ruler with the nearest ones runs under the opening and the same ticks order the rest of the page.'),
      look('sanony', 'Šanony', 'Binders', 'Police se šanony: služby stojí v úvodu jako hřbety s cenou a ceník leží ve sloupci.', 'A shelf of binders: the services stand in the opening as spines with a price and the price list lies in a pile.'),
    ]),
  planned('restaurant', 'hospitality', 'pig',
    { cs: 'Restaurace a kavárna', en: 'Restaurant and café' },
    { cs: 'Jídelní lístek, denní menu, otevírací doba a rezervace stolu.', en: 'The menu, daily specials, opening hours and table booking.' },
    [{ cs: 'Jídelní lístek', en: 'Menu' }, { cs: 'Denní menu', en: 'Daily specials' }, { cs: 'Rezervace stolu', en: 'Table booking' }],
    [
      look('salon', 'Salon', 'Dining Room', 'Prvorepublikový salon: tmavá stránka, mosazné linky a jídelní lístek na krémových kartách.', 'A first-republic dining room: a dark page, brass hairlines and the menu on cream cards.'),
      look('talir', 'Talíř', 'Plate', 'Plakát: jedna výrazná barva, titulek přes celou šířku a jídla focená shora jako talíře na stole.', 'A poster: one loud colour, a headline as wide as the page and food photographed from above like plates on a table.'),
      look('paragon', 'Paragon', 'Receipt', 'Papíry z hospody: formuláře psané na stroji, červené razítko a číšníkova tužka.', 'The pub’s own paperwork: typewritten forms, a red rubber stamp and the waiter’s pencil.'),
    ]),
  planned('accommodation', 'hospitality', 'sheep',
    { cs: 'Ubytování', en: 'Accommodation' },
    { cs: 'Pokoje, ceník, okolí a poptávka pobytu.', en: 'Rooms, prices, the surroundings and a stay request.' },
    [{ cs: 'Pokoje a ceník', en: 'Rooms and prices' }, { cs: 'Výlety v okolí', en: 'Trips nearby' }, { cs: 'Poptávka pobytu', en: 'Stay request' }],
    [
      look('cely-rok', 'Celý rok', 'All Year', 'Tichá tmavá stránka s jednou fotografií přes celou šířku a pásem dvanácti měsíců, který nese ceny.', 'A quiet dark page led by one full-width photograph, with a ribbon of twelve months that carries the prices.'),
      look('ode-dveri', 'Ode dveří', 'From the Door', 'Světlá vzdušná stránka, kde vedou fotografie a pokoje a všechno se měří ode dveří.', 'A light, airy page led by the photographs and the rooms, with everything measured from the door.'),
    ]),
  planned('sports-club', 'community', 'lion',
    { cs: 'Sportovní klub', en: 'Sports club' },
    { cs: 'Týmy, rozpis zápasů, výsledky a nábor nových členů.', en: 'Teams, fixtures, results and recruiting new members.' },
    [{ cs: 'Týmy', en: 'Teams' }, { cs: 'Zápasy a výsledky', en: 'Fixtures and results' }, { cs: 'Aktuality', en: 'News' }, { cs: 'Nábor', en: 'Recruiting' }],
    [
      look('zpravodaj', 'Zpravodaj', 'Bulletin', 'Klubový zpravodaj: teplý bílý papír, tenké linky a barevné fotografie s popisky.', 'The club bulletin: warm white paper, hairlines and colour photographs with captions.'),
      look('dres', 'Dres', 'Jersey', 'Stránka v klubovém dresu: plochy klubové barvy, pruhy, široké verzálky a velká čísla.', 'The page wears the kit: blocks of the club colour, stripes, wide capitals and huge numbers.'),
      look('hriste', 'Hřiště', 'Pitch', 'Sobotní odpoledne na hřišti: čistá bílá stránka, velké fotografie a zápasy přehledně jako na výsledkové tabuli.', 'A Saturday afternoon at the ground: a clean white page, big photographs and matches as clear as a scoreboard.'),
    ]),
  planned('studio', 'community', 'deer',
    { cs: 'Taneční, jógové a fitness studio', en: 'Dance, yoga and fitness studio' },
    { cs: 'Rozvrh lekcí, kurzy, lektoři, ceník a přihlášky.', en: 'The class timetable, courses, teachers, prices and sign-ups.' },
    [{ cs: 'Rozvrh', en: 'Timetable' }, { cs: 'Kurzy a lektoři', en: 'Courses and teachers' }, { cs: 'Ceník', en: 'Prices' }, { cs: 'Přihlášky', en: 'Sign-ups' }],
    [
      look('sal', 'Sál', 'Hall', 'Sál za denního světla: tichá vzdušná stránka, knižní písmo a bílé karty na světlém papíře.', 'The room in daylight: a quiet, airy page, a bookish serif and white cards on pale paper.'),
      look('tabule', 'Tabule', 'Board', 'Odjezdová tabule: celá stránka ve vaší barvě, široké verzálky a dnešní lekce hned v úvodu.', 'A departure board: the whole page in your colour, wide capitals and today’s classes right in the opening.'),
      look('deka', 'Deka', 'Blanket', 'Pruhovaná vlněná deka: každý druh lekce má svou barvu a rozvrh týdne je z nich utkaný.', 'A striped wool blanket: every kind of class has its colour and the week’s timetable is woven from them.'),
    ]),
  planned('event', 'community', 'duck',
    { cs: 'Festival a závod', en: 'Festival and race' },
    { cs: 'Trasy nebo program, startovné, výsledky, plán místa a praktické informace.', en: 'Routes or the programme, entry fees, results, a plan of the venue and practical information.' },
    [{ cs: 'Program a trasy', en: 'Programme and routes' }, { cs: 'Startovné a vstupenky', en: 'Entry fees and tickets' }, { cs: 'Výsledky', en: 'Results' }, { cs: 'Praktické informace', en: 'Practical information' }],
    [
      look('casomira', 'Časomíra', 'Race Clock', 'Cílová časomíra: tmavá stránka, kde každé důležité číslo svítí z bodových diod.', 'The finish-line clock: a dark page where every number that matters is lit in dots.'),
      look('soutisk', 'Soutisk', 'Overprint', 'Ručně tištěný plakát ve třech barvách: tři kopce přes sebe a kulatá fotografie jako slunce nad nimi.', 'A hand-printed poster in three inks: three hills over each other and a round photograph like the sun above them.'),
    ]),
  planned('association', 'community', 'bee',
    { cs: 'Spolek a nezisková organizace', en: 'Association and non-profit' },
    { cs: 'Poslání, projekty, akce, dokumenty a jak vás podpořit.', en: 'Your mission, projects, events, documents and how to support you.' },
    [{ cs: 'Projekty', en: 'Projects' }, { cs: 'Akce', en: 'Events' }, { cs: 'Dokumenty a hospodaření', en: 'Documents and accounts' }, { cs: 'Podpora', en: 'Ways to support' }],
    [
      look('ctvero-dob', 'Čtvero dob', 'Four Seasons', 'Rok spolku: pás dvanácti měsíců říká, co se kdy dělá, a každý projekt nese barvu svého ročního období.', 'The association’s year: a strip of twelve months says what is done when, and every project wears the tint of its season.'),
    ]),
  planned('realty', 'property', 'seal',
    { cs: 'Realitní makléř a kancelář', en: 'Estate agent and agency' },
    { cs: 'Nabídka nemovitostí s fotkami a parametry, makléři a reference.', en: 'Property listings with photos and details, the agents and references.' },
    [{ cs: 'Nabídka nemovitostí', en: 'Listings' }, { cs: 'Makléři', en: 'Agents' }, { cs: 'Reference', en: 'References' }],
    [
      look('katastr', 'Katastr', 'Land Register', 'Klidná kancelář pečlivého makléře: bílý papír, tenké linky a nabídky psané jako záznamy z katastru.', 'The calm office of a careful agent: white paper, hairlines and listings set like land-register records.'),
      look('cedule', 'Cedule', 'Banner', 'Cedule z balkonu: jedna výrazná barva, těžké písmo a nabídky s cenou na prvním místě.', 'The banner from a balcony: one loud colour, heavy type and listings with the price first.'),
      look('rozsviceno', 'Rozsvíceno', 'Lights On', 'Večerní ulice s rozsvícenými okny: teplá tmavá stránka, žluté světlo a hledání psané jako věta.', 'A street in the evening with the lights on: a warm dark page, lamp yellow and a search written as a sentence.'),
    ]),
  planned('development', 'property', 'whale',
    { cs: 'Developerský projekt', en: 'Property development' },
    { cs: 'Představení projektu, nabídka bytů s půdorysy a stav výstavby.', en: 'The project, available flats with floor plans and construction progress.' },
    [{ cs: 'Byty a půdorysy', en: 'Flats and floor plans' }, { cs: 'Lokalita', en: 'Location' }, { cs: 'Stav výstavby', en: 'Construction progress' }],
    [
      look('modrotisk', 'Modrotisk', 'Blueprint', 'Architektův modrotisk: sytě modrý list s bílými linkami, dům nakreslený jako pohled a údaje na kótách.', 'The architect’s blueprint: a deep blue sheet with white linework, the building drawn as an elevation and facts on dimension lines.'),
      look('patra', 'Patra', 'Floors', 'Dům čtený po patrech: klidná bílá stránka, úzké elegantní písmo a ceník seřazený podle podlaží.', 'The building read floor by floor: a calm white page, a narrow elegant serif and the price list stacked by floor.'),
      look('po-slunci', 'Po slunci', 'By the Sun', 'Dům podle slunce: přívětivá bílá stránka s kruhy a oblými panely, každý byt popsaný tím, kdy má světlo.', 'The house follows the sun: a friendly white page of circles and rounded panels, every flat described by when it gets light.'),
    ]),
  planned('construction', 'property', 'turtle',
    { cs: 'Stavební firma a architektonické studio', en: 'Construction company and architecture studio' },
    { cs: 'Realizace s parametry, služby s cenami, tým a poptávka.', en: 'Completed projects with their figures, services with prices, the team and an enquiry.' },
    [{ cs: 'Realizace', en: 'Completed projects' }, { cs: 'Služby a ceny', en: 'Services and prices' }, { cs: 'Poptávka', en: 'Enquiry' }],
    [
      look('vykres', 'Výkres', 'Drawing', 'Stránka kreslená jako stavební výkres: chladný bílý list, černé linky a každý údaj na kótě.', 'A page drawn like a building drawing: a cool white sheet, black lines and every figure on a dimension line.'),
      look('harmonogram', 'Harmonogram', 'Schedule', 'Harmonogram stavby: grafitová stránka s jednou zelenou laserovou linkou a každá doba jako pruh na mřížce týdnů.', 'The build schedule: a graphite page with one green laser line and every duration as a bar on a week grid.'),
      look('zdivo', 'Zdivo', 'Brickwork', 'Stránka vyzděná jako zeď: omítková barva, cihlové bloky na vazbu a dům, který roste od základů.', 'A page laid like a wall: plaster ground, terracotta blocks in a running bond and a house that grows from the footing.'),
    ]),
  planned('shop', 'business', 'mouse',
    { cs: 'Obchod s pultem', en: 'Shop with a counter' },
    { cs: 'Sortiment, vybrané zboží, novinky, otevírací doba a cesta k vám. Bez košíku.', en: 'What you sell, picked items, what is new, opening hours and how to find you. No cart.' },
    [{ cs: 'Sortiment', en: 'What you sell' }, { cs: 'Vybrané zboží', en: 'Picked items' }, { cs: 'Otevírací doba a mapa', en: 'Opening hours and map' }],
    [
      look('portal', 'Portál', 'Shopfront', 'Malovaný dřevěný portál: název na vývěsním štítu, výloha s příčkami a cedulka Otevřeno na dveřích.', 'The painted wooden shopfront: the name on a fascia board, a window with glazing bars and an Open sign on the door.'),
      look('regal', 'Regál', 'Shelf', 'Regál s cenovou lištou: všechno stojí na polici a pod ní jsou cenovky.', 'The shelf with its price rail: everything stands on a board and the labels sit under it.'),
      look('na-hacku', 'Na háčku', 'On the Hook', 'Děrovaná stěna za pultem: všechno visí na dřevěných kolících, trochu nakřivo.', 'The pegboard behind the counter: everything hangs on wooden pegs, a little crooked.'),
    ]),
  planned('software', 'business', 'octopus',
    { cs: 'Softwarový produkt', en: 'Software product' },
    { cs: 'Funkce, ceník, přehled změn a časté otázky.', en: 'Features, pricing, a changelog and frequent questions.' },
    [{ cs: 'Funkce a ceník', en: 'Features and pricing' }, { cs: 'Přehled změn', en: 'Changelog' }, { cs: 'Časté otázky', en: 'Frequent questions' }],
    [
      look('navod', 'Návod', 'Manual', 'Dobře udělaný návod: každá obrazovka je číslovaný obrázek s popisky vysvětlenými vedle.', 'A well-made manual: every screen is a numbered figure with callouts explained beside it.'),
      look('magnety', 'Magnety', 'Magnets', 'Tabule se směnami ze zázemí: výrazná barva, titulky jako pruhy na týdenní mřížce a otázky, na které produkt odpovídá.', 'The rota board from the back room: a loud colour, headlines as bars on a week grid and the questions the product answers.'),
      look('jeden-den', 'Jeden den', 'One Day', 'Jeden pracovní den: po levém okraji běží časová osa a pozadí jde od svítání do noci.', 'One working day: a time rail runs down the left edge and the background goes from dawn to night.'),
    ]),
]

export function templateById(id: string | null | undefined): TemplateDef | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}

/** A template's look by its id; the default (first) one when the id is unknown or missing. Null for a template without looks. */
export function lookOf(template: TemplateDef | null | undefined, id: string | null | undefined): LookDef | null {
  if (!template?.looks.length) return null
  return template.looks.find((l) => l.id === id) ?? template.looks[0]!
}

/** Whether a person chooses a look for this template: only when there is more than one. */
export const hasLookChoice = (template: TemplateDef | null | undefined): boolean => (template?.looks.length ?? 0) > 1

/** What the gallery shows: the ready templates, and the planned ones only when asked for. */
export function visibleTemplates(showPlanned: boolean): TemplateDef[] {
  return TEMPLATES.filter((t) => t.ready || showPlanned)
}

/** The fields that have something to show, in the filter's order. */
export function fieldsOf(templates: TemplateDef[]): FieldId[] {
  return FIELD_IDS.filter((f) => templates.some((t) => t.field === f))
}

// ── the pictures ────────────────────────────────────────────────────────────────

/**
 * The pictures of one look (cloud/public/templates/<template>/<look>-<kind>.webp):
 *   card   800 × 500, the first screen: the gallery's card (every look has it)
 *   thumb  240 × 150, the same, small (every look)
 *   top    1440 × 900, the first screen without the site's name (a ready template's looks)
 *   tall   900 × 1350, the top of the home page (a ready template's looks)
 */
export type PictureKind = 'card' | 'thumb' | 'top' | 'tall'

/** The address of a look's picture. A template without looks has one set, named after itself. */
export const pictureOf = (template: string, lookId: string | null | undefined, kind: PictureKind): string => `/templates/${template}/${lookId || template}-${kind}.webp`

/** The first look of a template, or the template itself when it has none: what its pictures are named after. */
export const pictureLooks = (template: TemplateDef): Array<{ id: string; name: L | null }> =>
  (template.looks.length ? template.looks.map((l) => ({ id: l.id, name: l.name })) : [{ id: template.id, name: null }])

/** One file of the typeface a site's name is written in (cloud/public/templates/fonts/). */
export interface WordmarkFont { src: string; weight: string; style: string; stretch: string; range: string }

/**
 * Where and how a look writes the site's name, measured on a real site 1440 px wide
 * (scripts/template-pictures.mjs --real): the "name your site" step writes the typed name
 * there, over the look's `top` picture.
 */
export interface WordmarkDef {
  /** 'left': `x` is the name's left edge; 'center': its middle. */
  anchor: 'left' | 'center'
  /** The look sets the last word in italics ("Johana *Loudová*"). */
  italicLast: boolean
  x: number
  /** The middle of the line. */
  y: number
  /** The room the name has. */
  maxWidth: number
  /** Font size in pixels. */
  size: number
  family: string
  weight: number
  stretch: string
  color: string
  transform: string
  spacing: string
  fonts: WordmarkFont[]
}

const measured = PICTURES as unknown as Record<string, { source: string; looks: Array<{ id: string; name?: string; wordmark?: WordmarkDef }> }>

/** How a look writes the site's name; null where it was not measured (a planned template). */
export function wordmarkOf(template: string | null | undefined, lookId: string | null | undefined): WordmarkDef | null {
  if (!template) return null
  return measured[template]?.looks.find((l) => l.id === (lookId || template))?.wordmark ?? null
}

/** What scripts/template-pictures.mjs found: each template's looks in order (for the spec that keeps the two equal). */
export const measuredLooks = (template: string): Array<{ id: string; name?: string }> => (measured[template]?.looks ?? []).map(({ id, name }) => ({ id, name }))
