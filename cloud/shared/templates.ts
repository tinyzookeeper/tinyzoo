// The templates a website can start from. Some really exist: `basic`, built from
// packages/cms/starter, and the hosted ones (`hosted(…)` below and Photographer), which are
// designs of one Nuxt app (templates/app) and keep their own folder (templates/<id>) for their
// demo content and tinyzoo's command line. An APP is what is built and run: it serves a set of
// templates (`APPS`, `appOf`, `templatesOfApp`). The rest are planned: their designs are finished and approved, so the gallery shows each as it will
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
  hospitality: { cs: 'Jídlo a ubytování', en: 'Food and accommodation' },
  community: { cs: 'Sport a komunita', en: 'Sport and community' },
  property: { cs: 'Reality a stavby', en: 'Property and construction' },
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

export type AppId = 'templates' | 'basic'

/** A Nuxt app that is built and run for websites. One app serves a set of templates. */
export interface AppDef {
  id: AppId
  /** The app's source folder, from the repository's root (its build is `<sourceDir>/.output`). */
  sourceDir: string
  /** Whether the app has no content model of its own: each site's row names its template as its content model (and the site is drawn in the design of that name). */
  models: boolean
}

export const APPS: AppDef[] = [
  // The one app: every hosted template is a design of it, and each site's row names its template as its content model.
  { id: 'templates', sourceDir: 'templates/app', models: true },
  // The Basic website: its own app with its own model (a row without a model uses it).
  { id: 'basic', sourceDir: 'packages/cms/starter', models: false },
]

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
  /** The app that serves it. Null for a planned template. */
  app: AppId | null
  /** The template's own folder, from the repository's root: its demo content (`seed/`) and tinyzoo's command line run there. The build is the app's (`<app.sourceDir>/.output`). Null until it exists. */
  sourceDir: string | null
  /** Whether the template brings demo content (`seed/index.ts`, put in with `tinyzoo seed`). */
  seed: boolean
  /** The animal that stands for it (the being-made scene, an empty place). */
  animal: string
  /** Its looks, the default first. Empty for a template with one design and no name for it (Basic). */
  looks: LookDef[]
}

const look = (id: string, cs: string, en: string, csText: string, enText: string, colors?: string): LookDef => ({ id, name: { cs, en }, description: { cs: csText, en: enText }, ...(colors ? { colors } : {}) })
const planned = (id: string, field: FieldId, animal: string, name: L, description: L, features: L[], looks: LookDef[]): TemplateDef =>
  ({ id, ready: false, field, name, description, features, app: null, sourceDir: null, seed: false, animal, looks })
/** A hosted template that is built (templates/<id>): each of its looks names its default colours as the sixth argument of `look(…)`. */
const hosted = (id: string, field: FieldId, animal: string, name: L, description: L, features: L[], looks: LookDef[]): TemplateDef =>
  ({ id, ready: true, field, name, description, features, app: 'templates', sourceDir: `templates/${id}`, seed: true, animal, looks })

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'basic',
    ready: true,
    field: 'general',
    name: { cs: 'Základní web', en: 'Basic website' },
    description: {
      cs: 'Web s úvodní stránkou, dalšími stránkami, aktualitami a kontaktem.',
      en: 'A website with a home page, extra pages, news and contact details.',
    },
    features: [
      { cs: 'Stránky skládané z bloků', en: 'Pages built from blocks' },
      { cs: 'Aktuality', en: 'News' },
      { cs: 'Kontakt a otevírací doba', en: 'Contact and opening hours' },
      { cs: 'Česky a anglicky', en: 'Czech and English' },
    ],
    app: 'basic',
    sourceDir: 'packages/cms/starter',
    seed: true,
    animal: 'elephant',
    looks: [],
  },
  hosted('individual', 'personal', 'fox',
    { cs: 'Živnostník a konzultant', en: 'Freelancer and consultant' },
    { cs: 'Představte se a ukažte své služby, ceny a práci pro klienty.', en: 'Introduce yourself and show your services, prices and client work.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Projekty a reference', en: 'Projects and testimonials' }, { cs: 'Články', en: 'Articles' }],
    [
      look('vizitka', 'Vizitka', 'Business Card', 'Sytá barva, výrazné patkové písmo a služby v přehledném ceníku.', 'A solid block of colour, bold serif type and a clear price list for your services.', 'petrol'),
      look('zvyraznovac', 'Zvýrazňovač', 'Highlighter', 'Velký černý nadpis na bílém podkladu se slovy zvýrazněnými barvou.', 'A big black headline on white, with colour highlighting the key words.', 'zluta'),
      look('rozhovor', 'Rozhovor', 'Conversation', 'Otázky v bublinách, odpovědi pod nimi a měkké oblé tvary.', 'Questions in speech bubbles, answers underneath and softly rounded shapes.', 'rajce'),
    ]),
  {
    id: 'photographer',
    ready: true,
    field: 'personal',
    name: { cs: 'Fotograf', en: 'Photographer' },
    description: { cs: 'Ukažte své fotografie, nabídněte balíčky a přijímejte poptávky.', en: 'Show your photos, list your packages and take enquiries.' },
    features: [
      { cs: 'Galerie a alba', en: 'Galleries and albums' },
      { cs: 'Balíčky a ceny', en: 'Packages and prices' },
      { cs: 'Poptávka termínu', en: 'Photography enquiries' },
    ],
    app: 'templates',
    sourceDir: 'templates/photographer',
    seed: true,
    animal: 'owl',
    looks: [
      {
        id: 'atelier',
        name: { cs: 'Ateliér', en: 'Atelier' },
        description: { cs: 'Světlé pozadí, tenké linky a jemné patkové písmo.', en: 'A light background, fine lines and delicate serif type.' },
        colors: 'bronz',
      },
      {
        id: 'negativ',
        name: { cs: 'Negativ', en: 'Negative' },
        description: { cs: 'Na tmavém pozadí vyniknou velké nadpisy a fotografie od kraje ke kraji.', en: 'Large headlines and edge-to-edge photos stand out against a dark background.' },
        colors: 'mosaz',
      },
      {
        id: 'zapisnik',
        name: { cs: 'Zápisník', en: 'Notebook' },
        description: { cs: 'Fotografie s bílými okraji a ručně psané popisky připomínají rodinné album.', en: 'White-bordered photos and handwritten captions give the page the feel of a family album.' },
        colors: 'inkoust',
      },
    ],
  },
  hosted('wedding', 'personal', 'butterfly',
    { cs: 'Svatba', en: 'Wedding' },
    { cs: 'Hosté najdou program, místo, ubytování a dary a mohou potvrdit účast.', en: 'Give guests the schedule, venue, places to stay, gift ideas and a way to RSVP.' },
    [{ cs: 'Program dne', en: 'Wedding schedule' }, { cs: 'Místo a ubytování', en: 'Venue and places to stay' }, { cs: 'Dary', en: 'Gifts' }, { cs: 'Potvrzení účasti', en: 'RSVP' }],
    [
      look('oznameni', 'Oznámení', 'Announcement', 'Jména na střed, klasické písmo a fotografie v paspartách jako na svatebním oznámení.', 'Centred names, classic type and framed photos give it the feel of a printed wedding invitation.', 'salvej'),
      look('vecer', 'Večer', 'Evening', 'Tmavé pozadí se světýlky, jména v jemné kurzivě a kartička k potvrzení účasti.', 'Fairy lights on a dark background, names in delicate italics and an RSVP card.', 'les'),
      look('magazin', 'Magazín', 'Magazine', 'Velká jména a široké fotografie na bílé stránce jako ve svatebním časopise.', 'Large names and wide photos on a white page, laid out like a wedding magazine.', 'pisek'),
    ]),
  hosted('blog', 'personal', 'bird',
    { cs: 'Blog a magazín', en: 'Blog and magazine' },
    { cs: 'Články, rubriky, seriály, autoři a odběr novinek.', en: 'Articles, sections, series, authors and a newsletter.' },
    [{ cs: 'Články a rubriky', en: 'Articles and sections' }, { cs: 'Seriály', en: 'Series' }, { cs: 'Autoři', en: 'Authors' }, { cs: 'Odběr novinek', en: 'Newsletter' }],
    [
      look('obalka', 'Obálka', 'Cover', 'Úvodní fotografie přes celou obrazovku připomíná obálku časopisu.', 'A full-screen lead photo gives the home page the feel of a magazine cover.', 'mech'),
      look('ctvrthodinka', 'Čtvrthodinka', 'Quarter of an Hour', 'Články se řadí podle délky čtení a každý má vlastní ciferník.', 'Articles are grouped by reading time, with a clock face on each one.', 'jedle'),
    ]),
  hosted('trades', 'services', 'hedgehog',
    { cs: 'Řemeslník a místní služby', en: 'Trades and local services' },
    { cs: 'Ukažte své služby, ceny a hotové zakázky i to, kam za zákazníky jezdíte.', en: 'Show your services, prices, past jobs and the areas you cover.' },
    [{ cs: 'Služby a ceny', en: 'Services and prices' }, { cs: 'Ukázky zakázek', en: 'Past work' }, { cs: 'Recenze', en: 'Reviews' }, { cs: 'Poptávka', en: 'Enquiry' }],
    [
      look('mistr', 'Mistr', 'Master', 'Teplá bílá, tenké linky a ceník rozdělený podle služeb.', 'Warm white, fine lines and a price list grouped by service.', 'modra'),
      look('reflex', 'Reflex', 'Hi-Vis', 'Výrazná barva, černé plochy a telefonní číslo, které hned uvidíte.', 'A high-visibility colour, black panels and a phone number that’s easy to spot.', 'zluta'),
    ]),
  hosted('car-service', 'services', 'raccoon',
    { cs: 'Autoservis', en: 'Garage' },
    { cs: 'Uveďte služby, ceny, značky aut a sezónní akce i možnost objednat se.', en: 'List your services, prices, makes and seasonal offers, with a way to book.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Značky', en: 'Car makes' }, { cs: 'Sezónní akce', en: 'Seasonal offers' }, { cs: 'Objednání termínu', en: 'Bookings' }],
    [
      look('cesta', 'Cesta', 'Road', 'Světlé pozadí, velké písmo, sytá zelená a průběh opravy ve čtyřech krocích.', 'A light background, large type, deep green and four steps showing how a repair works.', 'modra'),
      look('kontrolky', 'Kontrolky', 'Warning Lights', 'Na tmavém pozadí svítí šest kontrolek, které vedou k jednotlivým službám v ceníku.', 'Six dashboard lights on a dark background link to services in the price list.', 'podsviceni'),
      look('supliky', 'Šuplíky', 'Drawers', 'Červená skříňka na nářadí dává každé skupině služeb v ceníku vlastní šuplík.', 'A red tool chest gives each group of services its own drawer in the price list.', 'cervena'),
    ]),
  hosted('salon', 'services', 'poodle',
    { cs: 'Salon a kadeřnictví', en: 'Hair and beauty salon' },
    { cs: 'Představte svůj tým, služby, ceník a ukázky práce a dejte zákazníkům možnost se objednat.', en: 'Introduce your team, show your work and prices, and let customers book.' },
    [{ cs: 'Ceník', en: 'Price list' }, { cs: 'Tým', en: 'Team' }, { cs: 'Ukázky práce', en: 'Portfolio' }, { cs: 'Objednání', en: 'Booking' }],
    [
      look('zrcadlo', 'Zrcadlo', 'Mirror', 'Chladné odstíny, fotografie v oválech a malé ciferníky s délkou služby.', 'Cool tones, oval photos and small clock faces showing how long each service takes.', 'mlha'),
      look('sachovnice', 'Šachovnice', 'Chessboard', 'Široké písmo a čtvercové dlaždice na pozadí ve výrazné barvě.', 'Wide lettering and square tiles on a bold background.', 'malina'),
      look('vyloha', 'Výloha', 'Shop Window', 'Krémové a mosazné písmo a smaltované cedulky vyniknou na tmavě zelené.', 'Cream and brass lettering and enamel signs stand out against dark green.', 'lahvova'),
    ]),
  hosted('medical', 'services', 'koala',
    { cs: 'Ordinace', en: 'Medical practice' },
    { cs: 'Ordinační hodiny, oznámení, služby, tým a žádost o termín.', en: 'Opening hours, notices, services, staff and a way to request an appointment.' },
    [{ cs: 'Ordinační hodiny', en: 'Opening hours' }, { cs: 'Oznámení', en: 'Notices' }, { cs: 'Služby a tým', en: 'Services and team' }, { cs: 'Žádost o termín', en: 'Appointment request' }],
    [
      look('cekarna', 'Čekárna', 'Waiting Room', 'Bílá stránka s dobře čitelným písmem a dnešními ordinačními hodinami v úvodu.', 'A white page with clear lettering and today’s opening hours near the top.', 'inkoust'),
      look('cifernik', 'Ciferník', 'Clock Face', 'Každý den má vlastní ciferník s barevně vyznačenými ordinačními hodinami.', 'Each day has a clock face with opening hours marked in colour.', 'tyrkys'),
    ]),
  hosted('office', 'services', 'penguin',
    { cs: 'Účetní, advokát a architekt', en: 'Accountant, lawyer and architect' },
    { cs: 'Služby s cenami, tým, případy z praxe a články.', en: 'Services and prices, profiles of your team, case studies and articles.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Tým', en: 'Team' }, { cs: 'Případy z praxe', en: 'Case studies' }],
    [
      look('lhuty', 'Lhůty', 'Deadlines', 'Pod úvodem najdete nejbližší termíny na časové ose připomínající pravítko.', 'Below the introduction, upcoming deadlines sit on a timeline marked like a ruler.', 'inkoust'),
      look('sanony', 'Šanony', 'Binders', 'Karty služeb připomínají hřbety šanonů a ceník má vlastní sloupec.', 'Service cards look like binder spines, with the price list in its own column.', 'rumelka'),
    ]),
  hosted('restaurant', 'hospitality', 'pig',
    { cs: 'Restaurace a kavárna', en: 'Restaurant and café' },
    { cs: 'Jídelní lístek, denní menu, otevírací doba a rezervace stolu.', en: 'Show your menu, daily specials and opening hours, and let guests book a table.' },
    [{ cs: 'Jídelní lístek', en: 'Menu' }, { cs: 'Denní menu', en: 'Daily specials' }, { cs: 'Rezervace stolu', en: 'Table booking' }],
    [
      look('salon', 'Salon', 'Dining Room', 'Tmavá stránka s mosaznými linkami a jídelním lístkem na krémových kartách.', 'A dark page with fine brass lines and a menu on cream cards.', 'lahvova'),
      look('talir', 'Talíř', 'Plate', 'Sytá barva, velký nadpis a fotografie jídel pořízené shora.', 'A bold colour, a large headline and overhead photos of the food.', 'horcice'),
      look('paragon', 'Paragon', 'Receipt', 'Strojové písmo, červené razítko a poznámky tužkou připomínají hospodský účet.', 'Typewriter lettering, a red stamp and pencil notes recall a pub receipt.', 'inkoust'),
    ]),
  hosted('accommodation', 'hospitality', 'sheep',
    { cs: 'Ubytování', en: 'Accommodation' },
    { cs: 'Představte pokoje, ceny a tipy na výlety a dejte hostům možnost se ozvat.', en: 'Show your rooms, rates and things to do nearby, with a way to enquire about a stay.' },
    [{ cs: 'Pokoje a ceník', en: 'Rooms and prices' }, { cs: 'Výlety v okolí', en: 'Things to do nearby' }, { cs: 'Poptávka pobytu', en: 'Booking enquiries' }],
    [
      look('cely-rok', 'Celý rok', 'All Year', 'Tmavé pozadí, široká úvodní fotografie a ceny v pásu s dvanácti měsíci.', 'A dark background, a wide lead photo and prices along a twelve-month strip.', 'vres'),
      look('ode-dveri', 'Ode dveří', 'From the Door', 'Světlá stránka s fotografiemi pokojů a tipy na výlety s uvedenou vzdáleností.', 'A light page with room photos and tips for days out, with distances from the door.', 'bridlice'),
    ]),
  hosted('sports-club', 'community', 'lion',
    { cs: 'Sportovní klub', en: 'Sports club' },
    { cs: 'Týmy, rozpis zápasů, výsledky a nábor nových členů.', en: 'Show your teams, fixtures and results, and invite new members to join.' },
    [{ cs: 'Týmy', en: 'Teams' }, { cs: 'Zápasy a výsledky', en: 'Fixtures and results' }, { cs: 'Aktuality', en: 'News' }, { cs: 'Nábor', en: 'Join the club' }],
    [
      look('zpravodaj', 'Zpravodaj', 'Bulletin', 'Teplý odstín bílé, tenké linky a barevné fotografie s popisky jako v klubovém zpravodaji.', 'Warm white, fine lines and captioned colour photos in a club bulletin layout.', 'cervenobili'),
      look('dres', 'Dres', 'Jersey', 'Klubové barvy, pruhy a velká čísla jako na dresu.', 'Club colours, stripes and large numbers like those on a team shirt.', 'rudi'),
      look('hriste', 'Hřiště', 'Pitch', 'Bílé pozadí, velké fotografie a rozpis zápasů ve stylu výsledkové tabule.', 'A white background, large photos and fixtures laid out like a scoreboard.', 'cervena'),
    ]),
  hosted('studio', 'community', 'deer',
    { cs: 'Taneční, jógové a fitness studio', en: 'Dance, yoga and fitness studio' },
    { cs: 'Rozvrh lekcí, kurzy, lektoři, ceník a přihlášky.', en: 'Class timetables, courses, instructors, prices and sign-ups.' },
    [{ cs: 'Rozvrh', en: 'Timetable' }, { cs: 'Kurzy a lektoři', en: 'Courses and instructors' }, { cs: 'Ceník', en: 'Prices' }, { cs: 'Přihlášky', en: 'Sign-ups' }],
    [
      look('sal', 'Sál', 'Hall', 'Světlé pozadí, bílé karty a patkové písmo jako v knize.', 'A pale background, white cards and classic book-style lettering.', 'borovice'),
      look('tabule', 'Tabule', 'Board', 'Dnešní lekce najdete hned v úvodu, vysázené jako na odjezdové tabuli.', 'Today’s classes appear at the top, laid out like a departures board.', 'kobalt'),
      look('deka', 'Deka', 'Blanket', 'Každý druh lekce má svou barvu a v týdenním rozvrhu z nich vznikají pruhy.', 'Each type of class has a colour, forming stripes across the weekly timetable.', 'slunce'),
    ]),
  hosted('event', 'community', 'duck',
    { cs: 'Festival a závod', en: 'Festival and race' },
    { cs: 'Přehled programu nebo tras, vstupenek či startovného, výsledků a informací k návštěvě.', en: 'Share the programme or routes, tickets or entry fees, results and visitor information.' },
    [{ cs: 'Program a trasy', en: 'Programme and routes' }, { cs: 'Startovné a vstupenky', en: 'Entry fees and tickets' }, { cs: 'Výsledky', en: 'Results' }, { cs: 'Praktické informace', en: 'Practical information' }],
    [
      look('casomira', 'Časomíra', 'Race Clock', 'Čísla na tmavém pozadí svítí jako časomíra v cíli.', 'Numbers glow on a dark background like a clock at the finish line.', 'cervena'),
      look('soutisk', 'Soutisk', 'Overprint', 'Tři překrývající se kopce a kulatá fotografie nad nimi jako na tištěném plakátu.', 'Three overlapping hills and a round photo above them, laid out like a printed poster.', 'cinober'),
    ]),
  hosted('association', 'community', 'bee',
    { cs: 'Spolek a nezisková organizace', en: 'Association and non-profit' },
    { cs: 'Ukažte, čemu se věnujete, co chystáte a jak vás mohou lidé podpořit.', en: 'Explain what you do, what’s coming up and how people can support you.' },
    [{ cs: 'Projekty', en: 'Projects' }, { cs: 'Akce', en: 'Events' }, { cs: 'Dokumenty a hospodaření', en: 'Documents and accounts' }, { cs: 'Podpora', en: 'Ways to help' }],
    [
      look('ctvero-dob', 'Čtvero dob', 'Four Seasons', 'Pás dvanácti měsíců ukazuje, co se kdy koná, a projekty mají barvy ročních období.', 'A twelve-month strip shows what’s on, with projects in seasonal colours.', 'sad'),
    ]),
  hosted('realty', 'property', 'seal',
    { cs: 'Realitní makléř a kancelář', en: 'Estate agent and agency' },
    { cs: 'Představte nemovitosti s fotografiemi a podrobnostmi, své makléře i reference.', en: 'Show property listings with photos and details, introduce your agents and share testimonials.' },
    [{ cs: 'Nabídka nemovitostí', en: 'Listings' }, { cs: 'Makléři', en: 'Agents' }, { cs: 'Reference', en: 'Testimonials' }],
    [
      look('katastr', 'Katastr', 'Land Register', 'Na bílém pozadí oddělují tenké linky nabídky vysázené jako záznamy z katastru.', 'Fine lines on a white background separate listings laid out like land register entries.', 'petrol'),
      look('cedule', 'Cedule', 'Banner', 'Výrazná barva, tučné písmo a nabídky, u kterých hned vidíte cenu.', 'A bold colour, heavy type and listings that put the price first.', 'zluta'),
      look('rozsviceno', 'Rozsvíceno', 'Lights On', 'Teplá žlutá na tmavém pozadí a vyhledávání ve formě krátké věty.', 'Warm yellow against a dark background, with search controls that read like a sentence.', 'soumrak'),
    ]),
  hosted('development', 'property', 'whale',
    { cs: 'Developerský projekt', en: 'Property development' },
    { cs: 'Představení projektu, nabídka bytů s půdorysy a stav výstavby.', en: 'Introduce the development, show available flats and floor plans, and share construction updates.' },
    [{ cs: 'Byty a půdorysy', en: 'Flats and floor plans' }, { cs: 'Místo', en: 'Location' }, { cs: 'Stav výstavby', en: 'Construction progress' }],
    [
      look('modrotisk', 'Modrotisk', 'Blueprint', 'Bílé linky na sytě modrém pozadí ukazují pohled na dům i jeho rozměry.', 'White lines on deep blue show the building and its dimensions.', 'modrotisk'),
      look('patra', 'Patra', 'Floors', 'Bílá stránka s úzkým písmem a ceníkem bytů podle podlaží.', 'A white page with narrow lettering and flat prices grouped by floor.', 'bronz'),
      look('po-slunci', 'Po slunci', 'By the Sun', 'Bílá stránka s oblými tvary ukazuje, kdy do kterého bytu svítí slunce.', 'A white page with rounded shapes shows when each flat gets sunlight.', 'more'),
    ]),
  hosted('construction', 'property', 'turtle',
    { cs: 'Stavební firma a architektonické studio', en: 'Builders and architects' },
    { cs: 'Ukažte dokončené stavby, představte tým a služby a přijímejte poptávky.', en: 'Show completed projects, introduce your team and services, and take enquiries.' },
    [{ cs: 'Hotové projekty', en: 'Completed projects' }, { cs: 'Služby a ceny', en: 'Services and prices' }, { cs: 'Poptávka', en: 'Enquiry' }],
    [
      look('vykres', 'Výkres', 'Drawing', 'Na bílém pozadí vystupují černé linky a údaje zapsané jako kóty ve výkresu.', 'Black lines and labels on white recall the dimensions on a building plan.', 'tuzka'),
      look('harmonogram', 'Harmonogram', 'Schedule', 'Na grafitovém pozadí ukazují pruhy v týdenní mřížce, jak dlouho práce trvají.', 'Bars on a weekly grid show how long each stage takes, against a graphite background.', 'laser'),
      look('zdivo', 'Zdivo', 'Brickwork', 'Na světlém pozadí se střídají cihlové bloky a kresba domu od základů po střechu.', 'Brick-coloured blocks sit on a pale background beside a drawing of a house from foundations to roof.', 'cihla'),
    ]),
  hosted('shop', 'business', 'mouse',
    { cs: 'Kamenný obchod', en: 'Local shop' },
    { cs: 'Ukažte, co prodáváte, co je u vás nového, kdy máte otevřeno a jak se k vám lidé dostanou.', en: 'Show what’s on your shelves, what’s new, when you’re open and how to find you.' },
    [{ cs: 'Sortiment', en: 'What you sell' }, { cs: 'Vybrané zboží', en: 'Featured products' }, { cs: 'Otevírací doba a mapa', en: 'Opening hours and map' }],
    [
      look('portal', 'Portál', 'Shopfront', 'Název je na dřevěném štítu a v úvodu se objevuje výloha s cedulkou „Otevřeno“.', 'A wooden sign carries the name, above a shop window with an ‘Open’ sign.', 'lahvova'),
      look('regal', 'Regál', 'Shelf', 'Zboží je v řadách jako v regálu, s cenovkami přímo pod ním.', 'Products sit in rows like items on a shelf, with price labels underneath.', 'smalt'),
      look('na-hacku', 'Na háčku', 'On the Hook', 'Zboží je rozvěšené na dřevěných kolících jako na děrované stěně za pultem.', 'Products hang from wooden pegs like items on a shop’s pegboard.', 'zelena'),
    ]),
  hosted('software', 'business', 'octopus',
    { cs: 'Softwarový produkt', en: 'Software product' },
    { cs: 'Funkce, ceník, přehled změn a časté otázky.', en: 'Explain what your product does, show prices, share updates and answer common questions.' },
    [{ cs: 'Funkce a ceník', en: 'Features and pricing' }, { cs: 'Přehled změn', en: 'Changelog' }, { cs: 'Časté otázky', en: 'FAQs' }],
    [
      look('navod', 'Návod', 'Manual', 'Očíslované obrázky ukazují jednotlivé obrazovky a popisky vysvětlují, co na nich najdete.', 'Numbered screenshots show each screen, with notes pointing out what’s on it.', 'zelena'),
      look('magnety', 'Magnety', 'Magnets', 'Výrazná barva a názvy funkcí na pruzích připomínají tabuli s rozpisem směn.', 'A bold colour and feature names on strips give the page the look of a shift board.', 'odpoledne'),
      look('jeden-den', 'Jeden den', 'One Day', 'Vlevo běží časová osa a pozadí se mění od ranního světla po noční tmu.', 'A timeline runs down the left as the background shifts from dawn to night.', 'podzim'),
    ]),
]

export function templateById(id: string | null | undefined): TemplateDef | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}

export const appById = (id: string | null | undefined): AppDef | null => APPS.find((a) => a.id === id) ?? null

/** The app that serves a template; null for a planned one. */
export const appOf = (template: TemplateDef | null | undefined): AppDef | null => appById(template?.app)

/** The ready templates an app serves, in the order of TEMPLATES. */
export const templatesOfApp = (appId: AppId): TemplateDef[] => TEMPLATES.filter((t) => t.ready && t.app === appId)

/** The content model a site of this template names in its row: the template's id, when its app carries several models; else null (the app's own model). */
export const modelOf = (template: TemplateDef | null | undefined): string | null => (template && appOf(template)?.models ? template.id : null)

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
  /** A name too long for its room is set smaller until it fits (a wedding's names open the page, large); without it the name is cut. */
  fit?: boolean
  /** The look sets the whole name in italics. */
  italic?: boolean
  /** The kind of typeface the look falls back on (`serif`…), until the look's own has loaded. */
  generic?: string
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
