// The templates a website can start from. One really exists today: `basic`, built from
// packages/cms/starter. The other twenty are planned: they are listed here so the gallery,
// its filter and its texts are ready, and they show only with NUXT_PUBLIC_SHOW_PLANNED=true,
// marked as not available and not selectable. A customer never sees them without the flag,
// and the server refuses to make a site from one (`ready: false`) whatever the flag says.

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
}

const planned = (id: string, field: FieldId, animal: string, name: L, description: L, features: L[]): TemplateDef =>
  ({ id, ready: false, field, name, description, features, sourceDir: null, seed: false, animal, preview: null })

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
  },
  planned('individual', 'personal', 'fox',
    { cs: 'Živnostník a konzultant', en: 'Freelancer and consultant' },
    { cs: 'Kdo jste, co nabízíte a jak si s vámi domluvit schůzku.', en: 'Who you are, what you offer and how to arrange a meeting.' },
    [{ cs: 'Služby a ceník', en: 'Services and prices' }, { cs: 'Reference', en: 'References' }, { cs: 'Domluvení schůzky', en: 'Arranging a meeting' }]),
  planned('photographer', 'personal', 'owl',
    { cs: 'Fotograf', en: 'Photographer' },
    { cs: 'Galerie zakázek, balíčky focení a poptávka termínu.', en: 'Galleries of your work, shooting packages and a date request.' },
    [{ cs: 'Galerie', en: 'Galleries' }, { cs: 'Balíčky a ceny', en: 'Packages and prices' }, { cs: 'Poptávka termínu', en: 'Date request' }]),
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

/** What the gallery shows: the ready templates, and the planned ones only when asked for. */
export function visibleTemplates(showPlanned: boolean): TemplateDef[] {
  return TEMPLATES.filter((t) => t.ready || showPlanned)
}

/** The fields that have something to show, in the filter's order. */
export function fieldsOf(templates: TemplateDef[]): FieldId[] {
  return FIELD_IDS.filter((f) => templates.some((t) => t.field === f))
}
