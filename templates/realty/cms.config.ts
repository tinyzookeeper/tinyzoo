import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'
import { OWN_COLOR_FIELD } from 'tinyzoo-template-kit/looks'
import { kitEntryBlocks } from 'tinyzoo-template-kit/sections'

// The content model of the Realty template: what an agency can write and change. One model for
// all three looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní (kurzivou, barvou nebo tučně, podle vzhledu).',
  en: 'Text between *asterisks* stands out (in italics, a colour or bold, depending on the look).',
}

// ── the whole site: who, where, the colours ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The name of your agency, the office, the look and the colours.', cs: 'Název kanceláře, kancelář, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'descriptor', 'logo', 'look', 'colors', 'ownColor'] },
      { label: { en: 'Office and contacts', cs: 'Kancelář a kontakty' }, fields: ['town', 'townIn', 'street', 'postcode', 'phone', 'email', 'hours'] },
      { label: { en: 'The offer and the header button', cs: 'Nabídka a tlačítko v záhlaví' }, fields: ['offerTotal', 'ctaLabel', 'ctaUrl'] },
      { label: { en: 'Footer and company', cs: 'Zápatí a firma' }, fields: ['about', 'company', 'companyId', 'vatId', 'register', 'legalNote'] },
      { label: { en: 'Drawn plan (Land Register)', cs: 'Kreslený plán (Katastr)' }, fields: ['planStreet', 'planLane'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the agency', cs: 'Název kanceláře' })
      .help({ en: 'The short name in the header and the footer, for example “Práh”. Banner sets it in a box, Land Register in a serif.', cs: 'Krátký název do záhlaví a zápatí, například „Práh“. Cedule ho vloží do černého rámečku, Katastr ho vysází patkovým písmem.' }),
    descriptor: f.text().optional().label({ en: 'Word after the name', cs: 'Slovo za názvem' })
      .help({ en: 'A small word after the name, for example “reality”. Leave it empty to show none.', cs: 'Malé slovo za názvem, například „reality“. Když pole necháte prázdné, žádné se nezobrazí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the name.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo názvu.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    // The owner's own main colour: the palette of the chosen colours follows it (templates/kit/palette.ts).
    ownColor: f.color().optional().label(OWN_COLOR_FIELD.label).help(OWN_COLOR_FIELD.help),
    town: f.text().optional().label({ en: 'Town', cs: 'Město' })
      .help({ en: 'The town the agency works from, for example “Písek”. It stands in the header, the search and the map.', cs: 'Město, ze kterého kancelář působí, například „Písek“. Objeví se v záhlaví, ve vyhledávání a na mapě.' }),
    townIn: f.text().optional().label({ en: 'The town after “in”', cs: 'Město po „v“' })
      .help({ en: 'The town as Czech says it after “in”, for example “v Písku”. Lights On writes its search as a sentence with it (“… v Písku a okolí”).', cs: 'Město, jak se říká po „v“, například „v Písku“. Rozsvíceno s ním píše vyhledávání jako větu („… v Písku a okolí“).' }),
    street: f.text().optional().label({ en: 'Street and number', cs: 'Ulice a číslo' }),
    postcode: f.text().optional().label({ en: 'Postcode', cs: 'PSČ' }),
    phone: f.text().optional().label({ en: 'Phone of the office', cs: 'Telefon kanceláře' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail of the office', cs: 'E-mail kanceláře' }),
    hours: f.text().optional().label({ en: 'Opening hours', cs: 'Otevírací doba' })
      .help({ en: 'As you want it written, for example “po–čt 9–17, pá 9–14”.', cs: 'Tak, jak ji chcete napsat, například „po–čt 9–17, pá 9–14“.' }),
    offerTotal: f.number({ int: true, min: 0 }).optional().label({ en: 'Number of properties in the offer', cs: 'Počet nemovitostí v nabídce' })
      .help({ en: 'The number written in the opening, the menu and the link to all listings. Leave it empty and the site counts the listings it holds; a larger number says the agency has more than the website shows.', cs: 'Číslo v úvodu, v menu a v odkazu na všechny nemovitosti. Když pole necháte prázdné, web spočítá nemovitosti, které na něm jsou; vyšší číslo říká, že kancelář jich má víc, než web ukazuje.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    about: f.text({ multiline: true }).optional().label({ en: 'A few words about the agency', cs: 'Pár slov o kanceláři' })
      .help({ en: 'Under the name in the footer (Land Register and Lights On; Banner has none).', cs: 'Pod názvem v zápatí (Katastr a Rozsvíceno; Cedule žádný nemá).' }),
    company: f.text().optional().label({ en: 'Company name', cs: 'Obchodní jméno' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    vatId: f.text().optional().label({ en: 'VAT number (DIČ)', cs: 'DIČ' }),
    register: f.text().optional().label({ en: 'Register entry', cs: 'Zápis v rejstříku' })
      .help({ en: 'For example “C 12345, Krajský soud v Českých Budějovicích”.', cs: 'Například „C 12345, Krajský soud v Českých Budějovicích“.' }),
    legalNote: f.text().optional().label({ en: 'Line under the footer', cs: 'Řádek pod zápatím' })
      .help({ en: 'After “© year company”, for example the law that licenses the agency.', cs: 'Za „© rok firma“, například zákon, podle kterého kancelář zprostředkovává.' }),
    planStreet: f.text().optional().label({ en: 'Street on the plan', cs: 'Ulice na plánu' })
      .help({ en: 'Land Register draws a cadastral plan of the street the office stands in. This is the name written along it.', cs: 'Katastr kreslí katastrální plán ulice, ve které kancelář sídlí. Tohle je název napsaný podél ní.' }),
    planLane: f.text().optional().label({ en: 'Lane on the plan', cs: 'Ulička na plánu' })
      .help({ en: 'The name of the lane that crosses the street on the plan.', cs: 'Název uličky, která na plánu ulici kříží.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the agents ──
export const Agent = defineEntity('agent', {
  label: { en: 'Agents', cs: 'Makléři' },
  labelSingular: { en: 'Agent', cs: 'Makléř' },
  description: { en: 'The people a client calls. Every listing names the agent who looks after it.', cs: 'Lidé, kterým klient volá. U každé nemovitosti je makléř, který se o ni stará.' },
  icon: 'i-lucide-user-round',
  titleField: 'name',
  admin: { list: { columns: ['photo', 'name', 'role', 'phone'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Portrait', cs: 'Portrét' })
      .help({ en: 'Best on the upright side. Land Register and Banner show it as it is, Lights On in a window shape.', cs: 'Nejlépe na výšku. Katastr a Cedule ho ukážou tak, jak je, Rozsvíceno v okně s obloukem.' }),
    role: f.text().optional().label({ en: 'What the agent does', cs: 'Čím se zabývá' })
      .help({ en: 'A short line under the name, for example “Zakladatelka · rodinné domy”.', cs: 'Krátký řádek pod jménem, například „Zakladatelka · rodinné domy“.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'A sentence or two', cs: 'Věta nebo dvě' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── the listings: each has a page of its own ──
export const Listing = defineEntity('listing', {
  label: { en: 'Properties', cs: 'Nemovitosti' },
  labelSingular: { en: 'Property', cs: 'Nemovitost' },
  description: { en: 'Flats, houses, cottages and plots on offer. Each has a page of its own, and the filter on the website is made of them.', cs: 'Byty, domy, chalupy a pozemky v nabídce. Každá nemovitost má vlastní stránku a filtr na webu se skládá z nich.' },
  icon: 'i-lucide-house',
  titleField: 'title',
  admin: { list: { columns: ['photos', 'title', 'deal', 'price', 'state', 'status'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' })
      .help({ en: 'For example “Byt 2+1 v cihlovém domě”.', cs: 'Například „Byt 2+1 v cihlovém domě“.' }),
    shortLine: f.text().optional().label({ en: 'Short line for lists', cs: 'Krátký řádek do seznamů' })
      .help({ en: 'The title with the place, for compact lists, for example “Byt 2+1 v cihlovém domě, Písek”. Banner’s list of this week’s new properties uses it; leave it empty and the title and the town are used.', cs: 'Název s místem do úsporných seznamů, například „Byt 2+1 v cihlovém domě, Písek“. Použije ho seznam nových nemovitostí tohoto týdne ve vzhledu Cedule; když pole necháte prázdné, vezme se název a obec.' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    deal: f.select({
      options: ['sale', 'rent'] as const, default: 'sale',
      labels: { sale: { en: 'For sale', cs: 'Prodej' }, rent: { en: 'To let', cs: 'Pronájem' } },
    }).label({ en: 'Sale or rent', cs: 'Prodej nebo pronájem' }),
    kind: f.select({
      options: ['flat', 'house', 'cottage', 'plot', 'commercial'] as const, default: 'flat',
      labels: {
        flat: { en: 'Flat', cs: 'Byt' }, house: { en: 'House', cs: 'Dům' }, cottage: { en: 'Cottage', cs: 'Chalupa, chata' },
        plot: { en: 'Plot', cs: 'Pozemek' }, commercial: { en: 'Commercial', cs: 'Komerční' },
      },
    }).label({ en: 'Kind of property', cs: 'Druh nemovitosti' })
      .help({ en: 'The filter groups houses and cottages as “houses”.', cs: 'Filtr řadí domy i chalupy mezi „domy“.' }),
    state: f.select({
      options: ['none', 'new', 'reserved', 'sold'] as const, default: 'none',
      labels: { none: { en: 'Nothing', cs: 'Nic' }, new: { en: 'New', cs: 'Novinka' }, reserved: { en: 'Reserved', cs: 'Rezervováno' }, sold: { en: 'Sold', cs: 'Prodáno' } },
    }).label({ en: 'Label on the photograph', cs: 'Štítek na fotografii' })
      .help({ en: 'Reserved and sold properties stay in the offer and look quieter (sold ones are greyed out). “New” also puts the property into the list of this week’s new ones.', cs: 'Rezervované a prodané nemovitosti zůstávají v nabídce a vypadají klidněji (prodané jsou zašedlé). „Novinka“ dá nemovitost i do seznamu nových tohoto týdne.' }),
    code: f.text().optional().label({ en: 'Listing number', cs: 'Číslo zakázky' }),
    published: f.datetime({ allDay: true }).optional().label({ en: 'Listed on', cs: 'Zveřejněno dne' })
      .help({ en: 'Banner writes the day beside each of this week’s new properties.', cs: 'Cedule píše den u každé z nových nemovitostí tohoto týdne.' }),
    featured: f.boolean().label({ en: 'Show in the opening and in the detail section', cs: 'Ukázat na úvodu a v detailu' })
      .help({ en: 'The first property marked so is the one the “detail” section shows, and Lights On’s opening puts its photograph in a window with a price sticker.', cs: 'První takto označená nemovitost je ta, kterou ukáže sekce „detail“, a Rozsvíceno ji dá na úvodu do okna s cenovkou.' }),
    price: f.number({ int: true, min: 0 }).optional().label({ en: 'Price in Kč', cs: 'Cena v Kč' })
      .help({ en: 'The whole price for a sale, the monthly rent for a rental.', cs: 'U prodeje celá cena, u pronájmu měsíční nájem.' }),
    priceUnit: f.text().optional().label({ en: 'Note beside the price', cs: 'Poznámka u ceny' })
      .help({ en: 'Beside the price on the card, for example “měsíčně + energie”. Only Land Register shows it; the other looks say “monthly” on their own.', cs: 'U ceny na kartě, například „měsíčně + energie“. Ukáže ji jen Katastr, ostatní vzhledy napíšou „měsíčně“ samy.' }),
    priceNote: f.text().optional().label({ en: 'Note under the price', cs: 'Poznámka pod cenou' })
      .help({ en: 'On the property’s page, for example “Včetně provize a právního servisu.”.', cs: 'Na stránce nemovitosti, například „Včetně provize a právního servisu.“.' }),
    layout: f.text().optional().label({ en: 'Layout', cs: 'Dispozice' }).help({ en: 'For example “2+kk”.', cs: 'Například „2+kk“.' }),
    area: f.number({ int: true, min: 0 }).optional().label({ en: 'Floor area in m²', cs: 'Užitná plocha v m²' }),
    landArea: f.number({ int: true, min: 0 }).optional().label({ en: 'Plot in m²', cs: 'Plocha pozemku v m²' })
      .help({ en: 'For a plot its whole area; for a house the garden.', cs: 'U pozemku jeho celá plocha, u domu zahrada.' }),
    floor: f.number({ int: true, min: 0 }).optional().label({ en: 'Floor', cs: 'Patro' }),
    floorsTotal: f.number({ int: true, min: 1 }).optional().label({ en: 'Floors in the building', cs: 'Pater v domě' })
      .help({ en: 'With the floor above it reads “2. ze 3” (Land Register).', cs: 'S patrem výše se napíše „2. ze 3“ (Katastr).' }),
    town: f.text().optional().label({ en: 'Town', cs: 'Obec' }).help({ en: 'For example “Písek”. The search offers the towns of the listings.', cs: 'Například „Písek“. Vyhledávání nabízí obce z nemovitostí.' }),
    townIn: f.text().optional().label({ en: 'The town after “in”', cs: 'Obec po „v“' })
      .help({ en: 'For example “v Písku”. Lights On writes its search as a sentence with it.', cs: 'Například „v Písku“. Rozsvíceno s ní píše vyhledávání jako větu.' }),
    district: f.text().optional().label({ en: 'Part of the town', cs: 'Část obce' }).help({ en: 'For example “Hradiště”.', cs: 'Například „Hradiště“.' }),
    street: f.text().optional().label({ en: 'Street', cs: 'Ulice' }).help({ en: 'As it stands after the place on the property’s page, for example “ulice U Hrušky”.', cs: 'Tak, jak se píše za místem na stránce nemovitosti, například „ulice U Hrušky“.' }),
    storeys: f.text().optional().label({ en: 'Storeys', cs: 'Podlaží' }),
    ownership: f.text().optional().label({ en: 'Ownership', cs: 'Vlastnictví' }),
    energyClass: f.text().optional().label({ en: 'Energy class', cs: 'Energetická třída' }),
    parking: f.text().optional().label({ en: 'Parking', cs: 'Parkování' }),
    extras: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }).help({ en: 'For example “Rekonstrukce”.', cs: 'Například „Rekonstrukce“.' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }).help({ en: 'For example “2021”.', cs: 'Například „2021“.' }),
      },
      max: 8, itemLabel: { en: 'Parameter', cs: 'Parametr' },
    }).label({ en: 'More parameters', cs: 'Další parametry' })
      .help({ en: 'They end the table of parameters. For a plot the first two (“Druh: stavební”, “Sítě: na hranici”) also stand on the card.', cs: 'Doplní tabulku parametrů. U pozemku první dva („Druh: stavební“, „Sítě: na hranici“) stojí i na kartě.' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Description', cs: 'Popis' })
      .help({ en: 'An empty line starts a new paragraph.', cs: 'Prázdný řádek začíná nový odstavec.' }),
    viewings: f.text().optional().label({ en: 'Viewings', cs: 'Termíny prohlídek' })
      .help({ en: 'For example “ve středu 25. 11. odpoledne a v sobotu 28. 11. dopoledne”.', cs: 'Například „ve středu 25. 11. odpoledne a v sobotu 28. 11. dopoledne“.' }),
    photos: f.gallery({ accept: 'image/*', max: 60 }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Drag to change the order. The first is the photograph on the card. The detail section shows the three after it.', cs: 'Pořadí změníte přetažením. První je fotografie na kartě. Sekce s detailem ukáže tři další za ní.' }),
    agent: f.relation({ to: () => Agent, kind: 'many-to-one', onDelete: 'set null' }).optional().label({ en: 'Agent', cs: 'Makléř' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/nabidka/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/nabidka/:slug',
    populate: ['photos', 'agent', 'ogImage'],
  },
})

// ── what was sold, and how fast ──
export const Sale = defineEntity('sale', {
  label: { en: 'Sold', cs: 'Prodáno' },
  labelSingular: { en: 'Sale', cs: 'Prodej' },
  description: { en: 'What you sold lately and how long it took, with a word from the client.', cs: 'Co jste naposledy prodali a jak dlouho to trvalo, se slovem klienta.' },
  icon: 'i-lucide-key-round',
  titleField: 'what',
  admin: { list: { columns: ['what', 'place', 'duration', 'client'], orderField: 'position' } },
  fields: {
    what: f.text({ required: true }).label({ en: 'What was sold', cs: 'Co se prodalo' }).help({ en: 'For example “Byt 2+1”.', cs: 'Například „Byt 2+1“.' }),
    place: f.text().optional().label({ en: 'Where', cs: 'Kde' }).help({ en: 'For example “Písek – Portyč”.', cs: 'Například „Písek – Portyč“.' }),
    duration: f.text({ required: true, max: 40 }).label({ en: 'How long it took', cs: 'Jak dlouho to trvalo' })
      .help({ en: 'A number and a unit, for example “17 dní” or “3 měsíce”. The number is written large.', cs: 'Číslo a jednotka, například „17 dní“ nebo „3 měsíce“. Číslo se napíše velkým písmem.' }),
    quote: f.text({ multiline: true }).optional().label({ en: 'What the client said', cs: 'Co řekl klient' }),
    client: f.text().optional().label({ en: 'Client', cs: 'Klient' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── where the agency works ──
export const Area = defineEntity('area', {
  label: { en: 'Where we work', cs: 'Kde působíme' },
  labelSingular: { en: 'Place', cs: 'Místo' },
  description: { en: 'Towns and parts of towns, with how many properties are on offer there.', cs: 'Obce a části obcí s počtem nemovitostí, které tam právě nabízíte.' },
  icon: 'i-lucide-map-pin',
  titleField: 'name',
  admin: { list: { columns: ['name', 'group', 'count', 'onRequest'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' })
      .help({ en: 'A town, a part of one or several together, for example “Čížová, Mirotice, Čimelice”.', cs: 'Obec, její část nebo více míst dohromady, například „Čížová, Mirotice, Čimelice“.' }),
    group: f.select({
      options: ['town', 'surroundings'] as const, default: 'town',
      labels: { town: { en: 'In the town', cs: 'Ve městě' }, surroundings: { en: 'Around', cs: 'V okolí' } },
    }).label({ en: 'Where it lies', cs: 'Kde leží' })
      .help({ en: 'Land Register writes two columns, the town and the surroundings. The other looks write one list.', cs: 'Katastr píše dva sloupce, město a okolí. Ostatní vzhledy píšou jeden seznam.' }),
    count: f.number({ int: true, min: 0 }).optional().label({ en: 'Properties on offer', cs: 'Počet nemovitostí' })
      .help({ en: 'Leave it empty and the site counts the published properties whose town is this name.', cs: 'Když pole necháte prázdné, web spočítá zveřejněné nemovitosti, jejichž obec se tak jmenuje.' }),
    onRequest: f.boolean().label({ en: 'Only by arrangement', cs: 'Jen po domluvě' })
      .help({ en: 'Shows “po domluvě” instead of a number; Banner and Lights On show the place quieter.', cs: 'Místo čísla napíše „po domluvě“; Cedule a Rozsvíceno místo ztlumí.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })

const opening = defineBlock({
  label: { en: 'Opening with the search', cs: 'Úvod s hledáním' },
  description: { en: 'The first screen: what the agency does, a photograph and a search over the properties (its choices come from the properties themselves).', cs: 'První obrazovka: čím se kancelář zabývá, fotografie a vyhledávání v nemovitostech (jeho volby se berou z nemovitostí samotných).' },
  icon: 'i-lucide-search',
  fields: {
    eyebrow: eyebrow().help({ en: 'Banner adds how many properties are on offer after it. Lights On writes it as a greeting.', cs: 'Cedule za něj připíše počet nemovitostí v nabídce. Rozsvíceno ho píše jako pozdrav.' }),
    heading: heading().help({ en: 'Banner sets each sentence on its own line. Text between *asterisks* stands out.', cs: 'Cedule vysází každou větu na samostatný řádek. Text mezi *hvězdičkami* se zvýrazní.' }),
    text: text().help({ en: 'Land Register and Banner write it under the heading; Lights On has none.', cs: 'Katastr a Cedule ho píšou pod nadpis; Rozsvíceno žádný text nemá.' }),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph of the town', cs: 'Fotografie města' })
      .help({ en: 'Land Register frames it beside the heading. Lights On takes the photograph of the property marked for the opening instead; Banner has none.', cs: 'Katastr ji dá do rámu vedle nadpisu. Rozsvíceno místo ní vezme fotografii nemovitosti označené pro úvod; Cedule žádnou nemá.' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'Land Register only.', cs: 'Jen Katastr.' }),
    primaryLabel: f.text().label({ en: 'First link', cs: 'První odkaz' }).help({ en: 'Land Register writes how many properties are on offer after it.', cs: 'Katastr za něj připíše počet nemovitostí v nabídce.' }),
    primaryUrl: link('First link destination', 'Cíl prvního odkazu'),
    secondaryLabel: f.text().label({ en: 'Second link', cs: 'Druhý odkaz' }),
    secondaryUrl: link('Second link destination', 'Cíl druhého odkazu'),
    quickLabel: f.text().label({ en: 'Words before the quick searches', cs: 'Slova před rychlými hledáními' }).help({ en: 'Land Register only, for example “Často hledáte:”.', cs: 'Jen Katastr, například „Často hledáte:“.' }),
    quickLinks: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Text', cs: 'Text' }),
        url: f.text({ format: 'link', required: true }).label({ en: 'Destination', cs: 'Cíl' }).help({ en: 'For example /nabidka?kind=flat&town=Písek (deal=sale|rent, kind=flat|houses|plot|commercial, town, max=price).', cs: 'Například /nabidka?kind=flat&town=Písek (deal=sale|rent, kind=flat|houses|plot|commercial, town, max=cena).' }),
      },
      max: 6, itemLabel: { en: 'Quick search', cs: 'Rychlé hledání' },
    }).label({ en: 'Quick searches', cs: 'Rychlá hledání' }).help({ en: 'Land Register only: links to the list of properties with a filter already set.', cs: 'Jen Katastr: odkazy na seznam nemovitostí s filtrem už nastaveným.' }),
  },
})

const listings = defineBlock({
  label: { en: 'Properties on offer', cs: 'Nabídka nemovitostí' },
  description: { en: 'The properties as cards, with a filter made of the properties themselves, and a box that watches the offer for an e-mail address.', cs: 'Nemovitosti jako karty s filtrem, který se skládá z nemovitostí samotných, a políčko, které za e-mail hlídá nabídku.' },
  icon: 'i-lucide-layout-grid',
  fields: {
    eyebrow: eyebrow().help({ en: 'Land Register and Lights On; Banner has none.', cs: 'Katastr a Rozsvíceno; Cedule žádný nemá.' }),
    heading: heading(),
    limit: f.number({ int: true, min: 0 }).label({ en: 'How many cards', cs: 'Kolik karet' })
      .help({ en: 'The first properties in your order. 0 shows all of them and leaves out the link to the full list.', cs: 'První nemovitosti ve vašem pořadí. 0 ukáže všechny a vynechá odkaz na celý seznam.' }),
    watchdog: f.boolean().label({ en: 'Show the box that watches the offer', cs: 'Ukázat hlídacího psa' })
      .help({ en: 'A card with an e-mail field: the agency writes to the visitor when something new comes.', cs: 'Karta s políčkem na e-mail: kancelář návštěvníkovi napíše, když přibude něco nového.' }),
    watchdogEyebrow: f.text().label({ en: 'Box: line above', cs: 'Pes: řádek nad nadpisem' }),
    watchdogHeading: f.text().label({ en: 'Box: heading', cs: 'Pes: nadpis' }),
    watchdogText: f.text().label({ en: 'Box: note under the field', cs: 'Pes: poznámka pod políčkem' }).help({ en: 'Land Register only.', cs: 'Jen Katastr.' }),
    watchdogButton: f.text().label({ en: 'Box: button', cs: 'Pes: tlačítko' }),
    watchdogSent: f.text().label({ en: 'Box: after it is sent', cs: 'Pes: po odeslání' }),
  },
})

const detail = defineBlock({
  label: { en: 'One property in detail', cs: 'Jedna nemovitost podrobně' },
  description: { en: 'The property marked for the opening: photographs, price, parameters, a word about it and the agent’s phone.', cs: 'Nemovitost označená pro úvod: fotografie, cena, parametry, pár slov o ní a telefon makléře.' },
  icon: 'i-lucide-house',
  fields: {
    eyebrow: eyebrow(),
    caption: f.text().label({ en: 'Under the photographs', cs: 'Pod fotografiemi' }).help({ en: 'Land Register and Lights On; Banner has none.', cs: 'Katastr a Rozsvíceno; Cedule žádný nemá.' }),
    moreLabel: f.text().label({ en: 'Link to the property’s page', cs: 'Odkaz na stránku nemovitosti' }),
    badge: f.text().label({ en: 'Note on the third photograph', cs: 'Poznámka na třetí fotografii' }).help({ en: 'Banner only, for example “+ 21 fotek”.', cs: 'Jen Cedule, například „+ 21 fotek“.' }),
  },
})

const sellers = defineBlock({
  label: { en: 'For sellers', cs: 'Pro prodávající' },
  description: { en: 'What the agency does for a seller, in a few steps, the commission and a form that asks for a price estimate.', cs: 'Co kancelář pro prodávajícího dělá, v několika krocích, provize a formulář, který žádá o odhad ceny.' },
  icon: 'i-lucide-handshake',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'Lights On writes it under the heading.', cs: 'Rozsvíceno ho píše pod nadpis.' }),
    steps: f.list({
      fields: {
        title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 6, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'Steps', cs: 'Kroky' }),
    commission: f.text({ multiline: true }).label({ en: 'About the commission', cs: 'O provizi' })
      .help({ en: 'Text between *asterisks* stands out (Banner colours it).', cs: 'Text mezi *hvězdičkami* se zvýrazní (Cedule ho obarví).' }),
    formHeading: f.text().label({ en: 'Form: heading', cs: 'Formulář: nadpis' }),
    formText: f.text({ multiline: true }).label({ en: 'Form: text', cs: 'Formulář: text' }),
    formButton: f.text().label({ en: 'Form: button', cs: 'Formulář: tlačítko' }),
  },
})

const sold = defineBlock({
  label: { en: 'Sold', cs: 'Prodáno' },
  description: { en: 'The latest sales and how long each took, from the Sold section.', cs: 'Poslední prodeje a jak dlouho každý trval, ze sekce Prodáno.' },
  icon: 'i-lucide-key-round',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
  },
})

const agents = defineBlock({
  label: { en: 'Agents', cs: 'Makléři' },
  description: { en: 'The agents from the Agents section, with a portrait and a phone number.', cs: 'Makléři ze sekce Makléři s portrétem a telefonem.' },
  icon: 'i-lucide-users-round',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
  },
})

const areas = defineBlock({
  label: { en: 'Where we work', cs: 'Kde působíme' },
  description: { en: 'The places from the Where we work section with the number of properties in each. Land Register draws them on a map.', cs: 'Místa ze sekce Kde působíme s počtem nemovitostí v každém. Katastr je nakreslí na mapu.' },
  icon: 'i-lucide-map',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Banner writes it only for screen readers: the names of the places are the heading there.', cs: 'Cedule ho píše jen pro čtečky: nadpisem jsou tam názvy míst.' }),
    text: text(),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph of the region', cs: 'Fotografie kraje' })
      .help({ en: 'Banner lays the places over it, Lights On shows it beside them; Land Register draws a map instead.', cs: 'Cedule přes ni položí místa, Rozsvíceno ji ukáže vedle nich; Katastr místo ní kreslí mapu.' }),
    towns: f.list({
      fields: {
        name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
        x: f.number({ int: true, min: 0, max: 520 }).label({ en: 'Across (0–520)', cs: 'Zleva (0–520)' }),
        y: f.number({ int: true, min: 0, max: 500 }).label({ en: 'Down (0–500)', cs: 'Shora (0–500)' }),
        labelX: f.number({ int: true, min: 0, max: 520 }).optional().label({ en: 'Name: across', cs: 'Název: zleva' })
          .help({ en: 'Where the name is written. Leave both empty to put it right of the dot.', cs: 'Kam se název napíše. Když necháte obě pole prázdná, napíše se vpravo od tečky.' }),
        labelY: f.number({ int: true, min: 0, max: 500 }).optional().label({ en: 'Name: down', cs: 'Název: shora' }),
        anchor: f.select({
          options: ['start', 'end', 'middle'] as const, default: 'start',
          labels: { start: { en: 'The name begins there', cs: 'Název tam začíná' }, end: { en: 'The name ends there', cs: 'Název tam končí' }, middle: { en: 'The name is centred there', cs: 'Název je tam vystředěn' } },
        }).label({ en: 'Name placed', cs: 'Umístění názvu' }),
        kind: f.select({
          options: ['main', 'offer', 'request'] as const, default: 'offer',
          labels: { main: { en: 'The agency’s town', cs: 'Sídlo kanceláře' }, offer: { en: 'Something on offer now', cs: 'Právě něco nabízíme' }, request: { en: 'By arrangement', cs: 'Po domluvě' } },
        }).label({ en: 'Dot', cs: 'Tečka' }),
      },
      max: 24, itemLabel: { en: 'Place on the map', cs: 'Místo na mapě' },
    }).label({ en: 'Places on the map', cs: 'Místa na mapě' })
      .help({ en: 'Land Register only: it draws the districts rivers and rings itself, you place the towns on a grid of 520 × 500 points (the town of the agency is at 250 × 262).', cs: 'Jen Katastr: řeky a kruhy kolem okresu nakreslí sám, vy rozmístíte obce na mřížce 520 × 500 bodů (sídlo kanceláře je na 250 × 262).' }),
  },
})

const contact = defineBlock({
  label: { en: 'Contact with a form', cs: 'Kontakt s formulářem' },
  description: { en: 'The office from Site settings and a form. The messages arrive in the admin.', cs: 'Kancelář z Nastavení webu a formulář. Zprávy najdete v administraci.' },
  icon: 'i-lucide-mail',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    viewings: f.text().label({ en: 'About viewings', cs: 'O prohlídkách' }).help({ en: 'Banner only: a row of the contact table, for example “i večer a v sobotu”.', cs: 'Jen Cedule: řádek tabulky s kontakty, například „i večer a v sobotu“.' }),
    topics: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Topic', cs: 'Téma' }) },
      max: 8, itemLabel: { en: 'Topic', cs: 'Téma' },
    }).label({ en: 'What the visitor can ask about', cs: 'S čím se návštěvník může ozvat' })
      .help({ en: 'The choices of “What do you need help with”. Leave the list empty and the form does not ask.', cs: 'Nabídka u otázky „S čím potřebujete pomoct“. Když seznam necháte prázdný, formulář se neptá.' }),
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
  blocks: { opening, listings, detail, sellers, sold, agents, areas, contact, text: richText, ...kitEntryBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    offer: { en: 'Offer links in the footer', cs: 'Odkazy na nabídku v zápatí' },
    legal: { en: 'Links under the footer', cs: 'Odkazy pod zápatím' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the messages of the forms below
]

// ── the forms ──
// The website draws each per look (the kit's useSiteForm). The topic of the contact form is
// worded by the agency in the "Contact" block.
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Messages', cs: 'Zprávy' },
  labelSingular: { en: 'Message', cs: 'Zpráva' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    contact: f.text({ required: true, max: 200 }).label({ en: 'Phone or e-mail', cs: 'Telefon nebo e-mail' }),
    topic: f.text({ max: 200 }).optional().label({ en: 'What they need help with', cs: 'S čím potřebujete pomoct' }),
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'Message', cs: 'Zpráva' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send message', cs: 'Odeslat zprávu' },
  successMessage: { en: 'Thank you, we have your message and will get back to you.', cs: 'Děkujeme, zprávu máme a ozveme se vám.' },
})

export const Valuation = defineForm('valuation', {
  label: { en: 'Price estimates', cs: 'Odhady ceny' },
  labelSingular: { en: 'Price estimate', cs: 'Odhad ceny' },
  fields: {
    address: f.text({ required: true, max: 300 }).label({ en: 'Address of the property', cs: 'Adresa nemovitosti' }),
    kind: f.select({
      options: ['flat', 'house', 'cottage', 'plot', 'other'] as const, default: 'flat',
      labels: { flat: { en: 'Flat', cs: 'Byt' }, house: { en: 'House', cs: 'Rodinný dům' }, cottage: { en: 'Cottage', cs: 'Chalupa, chata' }, plot: { en: 'Plot', cs: 'Pozemek' }, other: { en: 'Other', cs: 'Jiné' } },
    }).label({ en: 'Kind', cs: 'Druh' }),
    area: f.text({ max: 40 }).optional().label({ en: 'Area in m²', cs: 'Plocha v m²' }),
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    contact: f.text({ required: true, max: 200 }).label({ en: 'Phone or e-mail', cs: 'Telefon nebo e-mail' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Ask for an estimate', cs: 'Chci odhad zdarma' },
  successMessage: { en: 'Thank you, we have your request and will get in touch by the second working day.', cs: 'Děkujeme, žádost máme a ozveme se vám do druhého pracovního dne.' },
})

export const Watchdog = defineForm('watchdog', {
  label: { en: 'Offer watchers', cs: 'Hlídací pes' },
  labelSingular: { en: 'Watcher', cs: 'Hlídání nabídky' },
  fields: {
    email: f.text({ required: true, format: 'email', max: 200 }).label({ en: 'E-mail', cs: 'E-mail' }),
  },
  titleField: 'email',
  submitLabel: { en: 'Watch the offer', cs: 'Hlídat nabídku' },
  successMessage: { en: 'Thank you. We write to you when something new comes.', cs: 'Děkujeme. Ozveme se, až přibude něco nového.' },
})
export const FormSettings = defineFormSettings()
