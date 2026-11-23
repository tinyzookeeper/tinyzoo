// The templates a website can start from. Two really exist today: `basic`, built from
// packages/cms/starter, and `photographer`, from templates/photographer. The other nineteen
// are planned: they are listed here so the gallery, its filter and its texts are ready, and
// they show only with NUXT_PUBLIC_SHOW_PLANNED=true, marked as not available and not
// selectable. A customer never sees them without the flag, and the server refuses to make a
// site from one (`ready: false`) whatever the flag says.
//
// A template may come in several looks: one content model and one build, drawn in different
// designs. The person picks one when making the site; it is written into the site's settings
// (the fields `look` and `colors`), where its owner can change it later. The ids here are the ones the
// template itself lists (templates/<id>/looks.ts): a unit spec keeps the two equal.

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
  /** A picture of the finished website in this look (under /public). */
  preview: string
  /** The look's default colours, as the template names them: written into the settings beside the look. */
  colors: string
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
  /** The animal that stands for it in the gallery. */
  animal: string
  /** A picture of the finished website (under /public), when there is one. */
  preview: string | null
  /** Its looks, the default first. Empty for a template with one design. */
  looks: LookDef[]
}

const planned = (id: string, field: FieldId, animal: string, name: L, description: L, features: L[]): TemplateDef =>
  ({ id, ready: false, field, name, description, features, sourceDir: null, seed: false, animal, preview: null, looks: [] })

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
    preview: '/templates/basic.jpg',
    looks: [],
  },
  planned('individual', 'personal', 'fox',
    { cs: 'Živnostník a konzultant', en: 'Freelancer and consultant' },
    { cs: 'Kdo jste, co nabízíte a jak si s vámi domluvit schůzku.', en: 'Who you are, what you offer and how to arrange a meeting.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Reference', en: 'References' }, { cs: 'Domluvení schůzky', en: 'Arranging a meeting' }]),
  {
    id: 'photographer',
    ready: true,
    field: 'personal',
    name: { cs: 'Fotograf', en: 'Photographer' },
    description: { cs: 'Galerie zakázek, balíčky focení a poptávka termínu.', en: 'Galleries of your work, shooting packages and a date request.' },
    features: [
      { cs: 'Galerie', en: 'Galleries' },
      { cs: 'Balíčky a ceny', en: 'Packages and prices' },
      { cs: 'Poptávka termínu', en: 'Date request' },
      { cs: 'Tři vzhledy', en: 'Three looks' },
    ],
    sourceDir: 'templates/photographer',
    seed: true,
    animal: 'owl',
    preview: '/templates/photographer.jpg',
    looks: [
      {
        id: 'atelier',
        name: { cs: 'Ateliér', en: 'Atelier' },
        description: { cs: 'Klidná galerijní stěna: bílý papír, jemné linky a tenké patkové písmo.', en: 'A quiet gallery wall: white paper, fine lines and a thin serif.' },
        preview: '/templates/photographer/atelier.jpg',
        colors: 'bronz',
      },
      {
        id: 'negativ',
        name: { cs: 'Negativ', en: 'Negative' },
        description: { cs: 'Tmavý a výrazný: fotky od kraje ke kraji a velké titulky.', en: 'Dark and striking: photographs from edge to edge and large headlines.' },
        preview: '/templates/photographer/negativ.jpg',
        colors: 'mosaz',
      },
      {
        id: 'zapisnik',
        name: { cs: 'Zápisník', en: 'Notebook' },
        description: { cs: 'Osobní album: fotky s bílým okrajem a ručně psané poznámky.', en: 'A personal album: prints with white borders and handwritten notes.' },
        preview: '/templates/photographer/zapisnik.jpg',
        colors: 'inkoust',
      },
    ],
  },
  planned('wedding', 'personal', 'butterfly',
    { cs: 'Svatba', en: 'Wedding' },
    { cs: 'Web pro svatební hosty: program dne, místo, ubytování a potvrzení účasti.', en: 'A site for wedding guests: the programme of the day, the venue, places to stay and RSVP.' },
    [{ cs: 'Program dne', en: 'Programme of the day' }, { cs: 'Místo a ubytování', en: 'Venue and places to stay' }, { cs: 'Potvrzení účasti', en: 'RSVP' }]),
  planned('blog', 'personal', 'bird',
    { cs: 'Blog', en: 'Blog' },
    { cs: 'Články, rubriky a stránka o autorovi.', en: 'Articles, categories and a page about the author.' },
    [{ cs: 'Články a rubriky', en: 'Articles and categories' }, { cs: 'O autorovi', en: 'About the author' }, { cs: 'Vyhledávání', en: 'Search' }]),
  planned('trades', 'services', 'hedgehog',
    { cs: 'Řemeslník a místní služby', en: 'Trades and local services' },
    { cs: 'Co děláte, kde působíte, ukázky práce a rychlá poptávka.', en: 'What you do, where you work, examples of jobs and a quick enquiry.' },
    [{ cs: 'Služby', en: 'Services' }, { cs: 'Ukázky práce', en: 'Examples of jobs' }, { cs: 'Poptávka', en: 'Enquiry' }]),
  planned('car-service', 'services', 'raccoon',
    { cs: 'Autoservis', en: 'Car service' },
    { cs: 'Služby a ceník, značky, které opravujete, a objednání termínu.', en: 'Services and prices, the makes you repair, and booking a date.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Značky', en: 'Makes' }, { cs: 'Objednání termínu', en: 'Booking a date' }]),
  planned('salon', 'services', 'poodle',
    { cs: 'Salon a kadeřnictví', en: 'Salon and hairdresser' },
    { cs: 'Ceník služeb, tým, fotky práce a objednání.', en: 'A price list, the team, photos of your work and booking.' },
    [{ cs: 'Ceník', en: 'Price list' }, { cs: 'Tým', en: 'Team' }, { cs: 'Objednání', en: 'Booking' }]),
  planned('medical', 'services', 'koala',
    { cs: 'Ordinace', en: 'Medical practice' },
    { cs: 'Ordinační hodiny, služby, tým a informace pro pacienty.', en: 'Surgery hours, services, the team and information for patients.' },
    [{ cs: 'Ordinační hodiny', en: 'Surgery hours' }, { cs: 'Služby a tým', en: 'Services and team' }, { cs: 'Informace pro pacienty', en: 'Information for patients' }]),
  planned('office', 'services', 'penguin',
    { cs: 'Účetní, advokát a architekt', en: 'Accountant, lawyer and architect' },
    { cs: 'Služby kanceláře, tým, reference a kontakty.', en: 'The services of the practice, its team, references and contacts.' },
    [{ cs: 'Služby', en: 'Services' }, { cs: 'Tým', en: 'Team' }, { cs: 'Reference', en: 'References' }]),
  planned('restaurant', 'hospitality', 'pig',
    { cs: 'Restaurace a kavárna', en: 'Restaurant and café' },
    { cs: 'Jídelní lístek, denní menu, otevírací doba a rezervace stolu.', en: 'The menu, daily specials, opening hours and table booking.' },
    [{ cs: 'Jídelní lístek', en: 'Menu' }, { cs: 'Denní menu', en: 'Daily specials' }, { cs: 'Rezervace stolu', en: 'Table booking' }]),
  planned('accommodation', 'hospitality', 'sheep',
    { cs: 'Ubytování', en: 'Accommodation' },
    { cs: 'Pokoje, ceník, okolí a poptávka pobytu.', en: 'Rooms, prices, the surroundings and a stay request.' },
    [{ cs: 'Pokoje a ceník', en: 'Rooms and prices' }, { cs: 'Okolí', en: 'Surroundings' }, { cs: 'Poptávka pobytu', en: 'Stay request' }]),
  planned('sports-club', 'community', 'lion',
    { cs: 'Sportovní klub', en: 'Sports club' },
    { cs: 'Týmy, rozpis zápasů, výsledky a nábor nových členů.', en: 'Teams, fixtures, results and recruiting new members.' },
    [{ cs: 'Týmy', en: 'Teams' }, { cs: 'Zápasy a výsledky', en: 'Fixtures and results' }, { cs: 'Nábor', en: 'Recruiting' }]),
  planned('studio', 'community', 'deer',
    { cs: 'Taneční, jógové a fitness studio', en: 'Dance, yoga and fitness studio' },
    { cs: 'Rozvrh lekcí, kurzy, lektoři a přihlášky.', en: 'The class timetable, courses, teachers and sign-ups.' },
    [{ cs: 'Rozvrh', en: 'Timetable' }, { cs: 'Kurzy a lektoři', en: 'Courses and teachers' }, { cs: 'Přihlášky', en: 'Sign-ups' }]),
  planned('event', 'community', 'duck',
    { cs: 'Festival a závod', en: 'Festival and race' },
    { cs: 'Program, startovné nebo vstupenky, mapa místa a praktické informace.', en: 'The programme, entry fees or tickets, a map of the venue and practical information.' },
    [{ cs: 'Program', en: 'Programme' }, { cs: 'Vstupenky a startovné', en: 'Tickets and entry fees' }, { cs: 'Praktické informace', en: 'Practical information' }]),
  planned('association', 'community', 'bee',
    { cs: 'Spolek a nezisková organizace', en: 'Association and non-profit' },
    { cs: 'Poslání, projekty, akce a jak vás podpořit.', en: 'Your mission, projects, events and how to support you.' },
    [{ cs: 'Poslání a projekty', en: 'Mission and projects' }, { cs: 'Akce', en: 'Events' }, { cs: 'Podpora', en: 'Ways to support' }]),
  planned('realty', 'property', 'seal',
    { cs: 'Realitní makléř a kancelář', en: 'Estate agent and agency' },
    { cs: 'Nabídka nemovitostí s fotkami, parametry a poptávkou prohlídky.', en: 'Property listings with photos, details and a viewing request.' },
    [{ cs: 'Nabídka nemovitostí', en: 'Listings' }, { cs: 'Parametry a fotky', en: 'Details and photos' }, { cs: 'Poptávka prohlídky', en: 'Viewing request' }]),
  planned('development', 'property', 'whale',
    { cs: 'Developerský projekt', en: 'Property development' },
    { cs: 'Představení projektu, nabídka bytů s půdorysy a stav výstavby.', en: 'The project, available flats with floor plans and construction progress.' },
    [{ cs: 'Byty a půdorysy', en: 'Flats and floor plans' }, { cs: 'Lokalita', en: 'Location' }, { cs: 'Stav výstavby', en: 'Construction progress' }]),
  planned('construction', 'property', 'turtle',
    { cs: 'Stavební firma a architektonické studio', en: 'Construction company and architecture studio' },
    { cs: 'Realizace s fotkami, služby, certifikace a poptávka.', en: 'Completed projects with photos, services, certifications and enquiries.' },
    [{ cs: 'Realizace', en: 'Completed projects' }, { cs: 'Služby', en: 'Services' }, { cs: 'Poptávka', en: 'Enquiry' }]),
  planned('shop', 'business', 'mouse',
    { cs: 'Obchod s pultem', en: 'Shop with a counter' },
    { cs: 'Sortiment, novinky, otevírací doba a cesta k vám. Bez košíku.', en: 'What you sell, what is new, opening hours and how to find you. No cart.' },
    [{ cs: 'Sortiment', en: 'What you sell' }, { cs: 'Novinky', en: 'What is new' }, { cs: 'Otevírací doba a mapa', en: 'Opening hours and map' }]),
  planned('software', 'business', 'octopus',
    { cs: 'Softwarový produkt', en: 'Software product' },
    { cs: 'Funkce, ceník, dokumentace a přehled změn.', en: 'Features, pricing, documentation and a changelog.' },
    [{ cs: 'Funkce a ceník', en: 'Features and pricing' }, { cs: 'Dokumentace', en: 'Documentation' }, { cs: 'Přehled změn', en: 'Changelog' }]),
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
