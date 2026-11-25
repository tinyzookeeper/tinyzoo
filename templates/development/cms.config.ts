import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Development template: what a developer of a building can write and
// change. One model for all three looks (looks.ts): a look decides how a block is drawn, never
// what it holds. Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and
// `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

// The icons Po slunci puts in front of a standard. Listed here (and drawn from the list in
// app/utils/site.ts) so every icon is known when the site is built.
const ICONS = ['house', 'blinds', 'layers', 'thermometer-sun', 'wind', 'shower-head', 'door-closed', 'car', 'bike', 'zap', 'sun', 'shield-check', 'trees', 'sofa', 'key-round', 'ruler'] as const

// ── the whole project: its name, where, when, who builds and sells it ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The project, the address, who sells and who builds, the look and the colours.', cs: 'Projekt, adresa, kdo prodává a kdo staví, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Project and look', cs: 'Projekt a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'tagline'] },
      { label: { en: 'The building', cs: 'Dům' }, fields: ['address', 'completion', 'approval', 'asOf', 'elevationCaption'] },
      { label: { en: 'Sales', cs: 'Prodej' }, fields: ['sellerName', 'sellerRole', 'sellerPhoto', 'phone', 'email', 'officeHours', 'ctaLabel', 'ctaUrl'] },
      { label: { en: 'Developer and footer', cs: 'Developer a patička' }, fields: ['developerName', 'developerAddress', 'companyId', 'vatId', 'registry', 'footerText', 'legalText', 'pricelistFile', 'standardsFile'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the project', cs: 'Název projektu' })
      .help({ en: 'For example “Starý sad”. It opens the website (Blueprint and Floors set it large) and stands in the header and the footer.', cs: 'Například „Starý sad“. Otevírá web (Modrotisk a Patra ho vysází velkým písmem) a stojí v záhlaví i zápatí.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Mark', cs: 'Značka' })
      .help({ en: 'Upload your own mark to show it beside the name in the header in place of the drawn one.', cs: 'Nahrajte vlastní značku a v záhlaví se zobrazí vedle názvu místo nakreslené.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    tagline: f.text().optional().label({ en: 'Line beside the name', cs: 'Řádek vedle názvu' })
      .help({ en: 'For example “Apartment building · Olomouc”. Only Blueprint writes it, in the header on a tablet.', cs: 'Například „Bytový dům · Olomouc“. Píše ho jen Modrotisk, v záhlaví na tabletu.' }),
    address: f.text({ multiline: true }).optional().label({ en: 'Address of the building', cs: 'Adresa stavby' })
      .help({ en: 'Two lines: the street, then the postcode and the town. It stands in the footer.', cs: 'Dva řádky: ulice, pak PSČ a obec. Stojí v zápatí.' }),
    completion: f.datetime({ allDay: true }).optional().label({ en: 'Handover of the flats', cs: 'Předání bytů' })
      .help({ en: 'Only the month and the year are shown. It is the “Completion” fact of the opening and is written in the footer.', cs: 'Zobrazí se jen měsíc a rok. Je to údaj „Dokončení“ v úvodu a píše se i do zápatí.' }),
    approval: f.datetime({ allDay: true }).optional().label({ en: 'Occupancy approval', cs: 'Kolaudace' })
      .help({ en: 'Only the month and the year are shown, under the completion in the opening.', cs: 'Zobrazí se jen měsíc a rok, v úvodu pod datem dokončení.' }),
    asOf: f.datetime({ allDay: true }).optional().label({ en: 'Status as of', cs: 'Stav k datu' })
      .help({ en: 'The day the flats, the prices and the construction were last checked. It stands by the price list, the construction status and in the footer.', cs: 'Den, kdy jste naposledy zkontrolovali byty, ceny a stavbu. Stojí u ceníku, u stavu stavby a v zápatí.' }),
    elevationCaption: f.text().optional().label({ en: 'Caption of the elevation', cs: 'Popisek pohledu na dům' })
      .help({ en: 'For example “South view, to the garden · diagram”. Blueprint writes it under its drawing of the building.', cs: 'Například „Pohled jižní, do zahrady · schéma“. Modrotisk ho píše pod kresbou domu.' }),
    sellerName: f.text().optional().label({ en: 'Name of the salesperson', cs: 'Jméno prodejce' }),
    sellerRole: f.text().optional().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “Flat sales”.', cs: 'Například „Prodej bytů“.' }),
    sellerPhoto: f.media({ accept: 'image/*' }).optional().label({ en: 'Photo of the salesperson', cs: 'Fotografie prodejce' })
      .help({ en: 'Blueprint and Floors show it as a portrait in a frame, By the Sun as a circle.', cs: 'Modrotisk a Patra ji ukážou jako portrét v rámečku, Po slunci v kruhu.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }).help({ en: 'It stands in the header, the contact and the footer.', cs: 'Stojí v záhlaví, v kontaktu a v zápatí.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail for buyers', cs: 'E-mail pro zájemce' }),
    officeHours: f.text().optional().label({ en: 'Sales office hours', cs: 'Otevírací doba kanceláře' })
      .help({ en: 'For example “Thursday 3–6 pm”. It stands in the footer.', cs: 'Například „čtvrtek 15–18 h“. Stojí v zápatí.' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    developerName: f.text().optional().label({ en: 'Developer', cs: 'Investor a zhotovitel' }),
    developerAddress: f.text().optional().label({ en: 'Registered office', cs: 'Sídlo' }),
    companyId: f.text().optional().label({ en: 'Company number', cs: 'IČO' }),
    vatId: f.text().optional().label({ en: 'VAT number', cs: 'DIČ' }),
    registry: f.text().optional().label({ en: 'Commercial register', cs: 'Spisová značka' }).help({ en: 'For example “C 12345, Regional Court in Ostrava”.', cs: 'Například „C 12345, Krajský soud v Ostravě“.' }),
    footerText: f.text({ multiline: true }).optional().label({ en: 'Line under the name in the footer', cs: 'Věta pod názvem v zápatí' })
      .help({ en: 'A sentence or two about the building.', cs: 'Věta nebo dvě o domě.' }),
    legalText: f.text({ multiline: true }).optional().label({ en: 'Legal notice', cs: 'Právní text' }).help({ en: 'The small print at the very bottom.', cs: 'Drobné písmo úplně dole.' }),
    pricelistFile: f.media({ accept: 'application/pdf' }).optional().label({ en: 'Price list (PDF)', cs: 'Ceník (PDF)' }).help({ en: 'Offered for download in the footer.', cs: 'V zápatí se nabídne ke stažení.' }),
    standardsFile: f.media({ accept: 'application/pdf' }).optional().label({ en: 'Standards (PDF)', cs: 'Standardy (PDF)' }).help({ en: 'Offered for download in the footer.', cs: 'V zápatí se nabídne ke stažení.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'sellerPhoto', 'pricelistFile', 'standardsFile', 'ogImage'] },
})

// ── the flats ──
export const Flat = defineEntity('flat', {
  label: { en: 'Flats', cs: 'Byty' },
  labelSingular: { en: 'Flat', cs: 'Byt' },
  description: { en: 'Every flat with its layout, area, price and state. The price list, the drawings of the building and the enquiry form are made from them.', cs: 'Každý byt s dispozicí, plochou, cenou a stavem. Z nich se skládá ceník, kresby domu i výběr bytu ve formuláři.' },
  icon: 'i-lucide-building-2',
  titleField: 'number',
  admin: { list: { columns: ['number', 'floor', 'layout', 'area', 'price', 'state'], searchable: ['number'] } },
  fields: {
    number: f.text({ required: true, max: 12 }).label({ en: 'Number of the flat', cs: 'Číslo bytu' })
      .help({ en: 'For example “3.02”: the floor, a dot and the number on the floor. The drawings take the position on the floor from the last digits.', cs: 'Například „3.02“: podlaží, tečka a pořadí na podlaží. Kresby podle něj řadí byty na podlaží.' }),
    slug: f.slug({ from: 'number', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' })
      .help({ en: 'The flat has a page of its own at /byt/<this>.', cs: 'Byt má vlastní stránku na adrese /byt/<tato adresa>.' }),
    floor: f.number({ min: 0, max: 99 }).label({ en: 'Floor', cs: 'Podlaží' })
      .help({ en: 'The number of the floor above ground: 1 is the ground floor.', cs: 'Číslo nadzemního podlaží: 1 je přízemí.' }),
    layout: f.select({ options: ['1+kk', '1+1', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1', '5+kk', '5+1'] as const, default: '2+kk' }).label({ en: 'Layout', cs: 'Dispozice' })
      .help({ en: 'The filter of the price list offers the layouts the flats have.', cs: 'Filtr v ceníku nabídne dispozice, které byty mají.' }),
    area: f.number({ int: false, min: 1 }).label({ en: 'Floor area in m²', cs: 'Podlahová plocha v m²' })
      .help({ en: 'The width of the flat in the drawing of the building follows it.', cs: 'Podle ní se řídí šířka bytu v kresbě domu.' }),
    outdoorKind: f.select({
      options: ['none', 'balcony', 'terrace', 'garden', 'loggia'] as const, default: 'balcony',
      labels: { none: { en: 'None', cs: 'Žádný' }, balcony: { en: 'Balcony', cs: 'Balkon' }, terrace: { en: 'Terrace', cs: 'Terasa' }, garden: { en: 'Garden', cs: 'Zahrada' }, loggia: { en: 'Loggia', cs: 'Lodžie' } },
    }).label({ en: 'Outdoor space', cs: 'Venkovní plocha' })
      .help({ en: 'Blueprint draws a balcony rail on the floors that have balconies.', cs: 'Modrotisk nakreslí zábradlí na podlažích, která mají balkony.' }),
    outdoorArea: f.number({ int: false, min: 0 }).optional().label({ en: 'Outdoor area in m²', cs: 'Venkovní plocha v m²' }),
    orientation: f.select({
      options: ['J', 'JV', 'JZ', 'V', 'Z', 'S', 'SV', 'SZ'] as const, default: 'J',
      labels: { J: { en: 'South', cs: 'Jih' }, JV: { en: 'South-east', cs: 'Jihovýchod' }, JZ: { en: 'South-west', cs: 'Jihozápad' }, V: { en: 'East', cs: 'Východ' }, Z: { en: 'West', cs: 'Západ' }, S: { en: 'North', cs: 'Sever' }, SV: { en: 'North-east', cs: 'Severovýchod' }, SZ: { en: 'North-west', cs: 'Severozápad' } },
    }).label({ en: 'Orientation', cs: 'Orientace' })
      .help({ en: 'By the Sun describes when the flat gets the sun by it and places the flat on its floor plan.', cs: 'Po slunci podle ní popíše, kdy se do bytu dostane slunce, a umístí byt do půdorysu patra.' }),
    price: f.number({ min: 0 }).optional().label({ en: 'Price in Kč with VAT', cs: 'Cena v Kč s DPH' })
      .help({ en: 'Not shown for a sold flat. The lowest price of the flats that are not sold is the “prices from” of the opening.', cs: 'U prodaného bytu se nezobrazí. Nejnižší cena z bytů, které nejsou prodané, je „cena od“ v úvodu.' }),
    state: f.select({
      options: ['free', 'reserved', 'sold'] as const, default: 'free',
      labels: { free: { en: 'Free', cs: 'Volný' }, reserved: { en: 'Reserved', cs: 'Rezervace' }, sold: { en: 'Sold', cs: 'Prodáno' } },
    }).label({ en: 'State', cs: 'Stav' })
      .help({ en: 'Free flats are lit in the drawings and can be asked about; a sold one has no price and no button.', cs: 'Volné byty se v kresbách rozsvítí a dá se na ně ptát; prodaný nemá cenu ani tlačítko.' }),
    plan: f.media({ accept: 'application/pdf,image/*' }).optional().label({ en: 'Floor plan', cs: 'Půdorys' })
      .help({ en: 'A PDF or a picture. It is offered on the page of the flat. Without it the page says the plan comes by e-mail.', cs: 'PDF nebo obrázek. Nabídne se na stránce bytu. Bez něj stránka napíše, že půdorys pošlete e-mailem.' }),
    note: f.text({ multiline: true }).optional().label({ en: 'A few words about the flat', cs: 'Pár slov o bytu' })
      .help({ en: 'Shown on the page of the flat and read out to search engines.', cs: 'Zobrazí se na stránce bytu a přečtou si ho vyhledávače.' }),
  },
  content: { public: true, slug: 'slug', path: '/byt/:slug', populate: ['plan'] },
})

// ── the floors: a note and a height mark for each ──
export const Floor = defineEntity('floor', {
  label: { en: 'Floors', cs: 'Podlaží' },
  labelSingular: { en: 'Floor', cs: 'Podlaží' },
  description: { en: 'A short note and the height mark of each floor. Optional: a floor without an entry is drawn without them.', cs: 'Krátká poznámka a výšková kóta každého podlaží. Nepovinné: podlaží bez záznamu se nakreslí bez nich.' },
  icon: 'i-lucide-layers',
  titleField: 'number',
  admin: { list: { columns: ['number', 'note', 'level'] } },
  fields: {
    number: f.number({ min: 0, max: 99 }).label({ en: 'Floor', cs: 'Podlaží' }).help({ en: 'The same number as in the flats.', cs: 'Stejné číslo jako u bytů.' }),
    note: f.text().optional().label({ en: 'Note', cs: 'Poznámka' })
      .help({ en: 'For example “Four flats with a balcony”. Floors and By the Sun write it by the floor.', cs: 'Například „Čtyři byty s balkonem“. Patra a Po slunci ji píšou u podlaží.' }),
    level: f.text({ max: 20 }).optional().label({ en: 'Height mark', cs: 'Výšková kóta' })
      .help({ en: 'For example “+3,100”. Blueprint writes it at the floor of its drawing; without it the mark is worked out from the floor.', cs: 'Například „+3,100“. Modrotisk ji píše u podlaží své kresby; bez ní se kóta dopočítá z čísla podlaží.' }),
  },
  content: { public: true },
})

// ── the standards: what is in the price ──
export const Standard = defineEntity('standard', {
  label: { en: 'Standards', cs: 'Standardy' },
  labelSingular: { en: 'Standard', cs: 'Standard' },
  description: { en: 'What the building and the flats are built and equipped with. Drag to put them in order.', cs: 'Z čeho je dům postaven a čím jsou byty vybaveny. Pořadí změníte přetažením.' },
  icon: 'i-lucide-ruler',
  titleField: 'title',
  admin: { list: { columns: ['title', 'text'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
    text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
    note: f.text().optional().label({ en: 'Price or short note', cs: 'Cena nebo krátká poznámka' })
      .help({ en: 'For example “390 000 Kč”. Floors writes it after the title; the other looks leave it out, so put it in the text too.', cs: 'Například „390 000 Kč“. Patra ji napíšou za název; ostatní vzhledy ji vynechají, uveďte ji proto i v textu.' }),
    icon: f.select({ options: ICONS, default: 'house' }).label({ en: 'Icon', cs: 'Ikona' })
      .help({ en: 'Only By the Sun draws it, in a yellow circle before the title.', cs: 'Kreslí ji jen Po slunci, ve žlutém kruhu před názvem.' }),
    closing: f.boolean().label({ en: 'Closing line', cs: 'Závěrečný řádek' })
      .help({ en: 'Floors and By the Sun set this standard as one line under the rest (usually “The building”). Blueprint numbers it like the others.', cs: 'Patra a Po slunci tento standard vysází jako jeden řádek pod ostatními (obvykle „Dům“). Modrotisk ho očísluje jako ostatní.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── what is nearby ──
export const Place = defineEntity('place', {
  label: { en: 'Surroundings', cs: 'Okolí' },
  labelSingular: { en: 'Place', cs: 'Místo' },
  description: { en: 'What is near the building and how many minutes it takes to get there.', cs: 'Co je poblíž domu a za kolik minut se tam dostanete.' },
  icon: 'i-lucide-map-pin',
  titleField: 'name',
  admin: { list: { columns: ['name', 'minutes', 'mode'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Place', cs: 'Místo' }).help({ en: 'For example “Tram 2 and 7”.', cs: 'Například „Tramvaj 2 a 7“.' }),
    minutes: f.number({ min: 0, max: 600 }).label({ en: 'Minutes', cs: 'Minuty' })
      .help({ en: 'Blueprint draws a line as long as the minutes; the others write the number.', cs: 'Modrotisk nakreslí čáru tak dlouhou, jako jsou minuty; ostatní napíšou číslo.' }),
    mode: f.select({
      options: ['walk', 'car'] as const, default: 'walk',
      labels: { walk: { en: 'On foot', cs: 'Pěšky' }, car: { en: 'By car', cs: 'Autem' } },
    }).label({ en: 'How', cs: 'Jak' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the stages of construction ──
export const Milestone = defineEntity('milestone', {
  label: { en: 'Construction stages', cs: 'Etapy stavby' },
  labelSingular: { en: 'Stage', cs: 'Etapa' },
  description: { en: 'The stages of construction. The first one that is not done is “now”.', cs: 'Etapy stavby. První, která není hotová, je „teď“.' },
  icon: 'i-lucide-hard-hat',
  titleField: 'title',
  admin: { list: { columns: ['date', 'title', 'done'], orderField: 'position' } },
  fields: {
    date: f.datetime({ allDay: true }).label({ en: 'Month', cs: 'Měsíc' }).help({ en: 'Only the month and the year are shown. For the current stage it is when it should end.', cs: 'Zobrazí se jen měsíc a rok. U probíhající etapy je to termín jejího dokončení.' }),
    title: f.text({ required: true }).label({ en: 'Stage', cs: 'Etapa' }),
    done: f.boolean().label({ en: 'Done', cs: 'Hotovo' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── buildings the developer has finished ──
export const Reference = defineEntity('reference', {
  label: { en: 'Finished buildings', cs: 'Dokončené stavby' },
  labelSingular: { en: 'Finished building', cs: 'Dokončená stavba' },
  description: { en: 'What the developer has built before.', cs: 'Co developer postavil dříve.' },
  icon: 'i-lucide-building',
  titleField: 'name',
  admin: { list: { columns: ['year', 'name', 'size'], orderField: 'position' } },
  fields: {
    year: f.number({ min: 1900, max: 2100 }).label({ en: 'Year', cs: 'Rok' }),
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    size: f.text().optional().label({ en: 'Size', cs: 'Rozsah' }).help({ en: 'For example “31 flats”.', cs: 'Například „31 bytů“.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' })
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).optional().label({ en, cs })

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The name of the project, a photo of the building and four key facts read from the flats and Site settings.', cs: 'Název projektu, fotografie domu a čtyři klíčové údaje z bytů a z Nastavení webu.' },
  icon: 'i-lucide-building-2',
  fields: {
    eyebrow: eyebrow().help({ en: 'For example “Apartment building · Olomouc-Neředín”.', cs: 'Například „Bytový dům · Olomouc-Neředín“.' }),
    headline: f.text().label({ en: 'Sentence instead of the name', cs: 'Věta místo názvu' })
      .help({ en: 'By the Sun opens with this sentence; Blueprint and Floors open with the name of the project and do not use it. Leave it empty and By the Sun opens with the name too.', cs: 'Po slunci jí otevírá web; Modrotisk a Patra otevírají názvem projektu a nepoužijí ji. Když ji necháte prázdnou, otevře i Po slunci názvem.' }),
    text: text(),
    image: photo('Photo of the building', 'Fotografie domu').help({ en: 'A visualisation or a photo of the whole building, wide.', cs: 'Vizualizace nebo fotografie celého domu, na šířku.' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' })
      .help({ en: 'Blueprint splits it at “ · ” into the two labels at the ends of its dimension line; Floors writes it under the photo; By the Sun has none.', cs: 'Modrotisk ho u znaku „ · “ rozdělí na dva popisky na koncích kóty; Patra ho napíšou pod fotografii; Po slunci žádný nemá.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Second button text', cs: 'Text druhého tlačítka' }),
    secondaryUrl: link('Second button destination', 'Cíl druhého tlačítka'),
    facts: f.list({
      fields: {
        kind: f.select({
          options: ['flats', 'layouts', 'completion', 'price', 'custom'] as const, default: 'flats',
          labels: { flats: { en: 'Number of flats', cs: 'Počet bytů' }, layouts: { en: 'Layouts and areas', cs: 'Dispozice a plochy' }, completion: { en: 'Completion', cs: 'Dokončení' }, price: { en: 'Prices from', cs: 'Ceny od' }, custom: { en: 'Your own', cs: 'Vlastní údaj' } },
        }).label({ en: 'What it shows', cs: 'Co ukazuje' })
          .help({ en: 'The value is worked out from the flats and Site settings; “Your own” takes the text below.', cs: 'Hodnota se spočítá z bytů a z Nastavení webu; „Vlastní údaj“ vezme text níže.' }),
        label: f.text({ required: true }).label({ en: 'Label', cs: 'Popisek' }),
        value: f.text().label({ en: 'Your own value', cs: 'Vlastní hodnota' }),
        note: f.text().label({ en: 'Line under the value', cs: 'Řádek pod hodnotou' }).help({ en: 'Leave it empty to use the one worked out (for example “seven are free”).', cs: 'Když pole necháte prázdné, použije se dopočítaný (například „sedm je volných“).' }),
      },
      max: 4, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Key facts', cs: 'Klíčové údaje' }),
  },
})

const overview = defineBlock({
  label: { en: 'The building at a glance', cs: 'Dům na první pohled' },
  description: { en: 'Blueprint draws the building as an elevation, Floors as one square per flat, By the Sun as a floor plan with the path of the sun. All of them from the flats.', cs: 'Modrotisk nakreslí dům jako pohled, Patra jako čtverec za každý byt, Po slunci jako půdorys patra s dráhou slunce. Vše z bytů.' },
  icon: 'i-lucide-layout-grid',
  fields: {
    eyebrow: eyebrow().help({ en: 'For example “House and sun”. Blueprint numbers its sections instead.', cs: 'Například „Dům a slunce“. Modrotisk místo něj sekce čísluje.' }),
    heading: heading(),
    text: text(),
    northLabel: f.text().label({ en: 'What lies to the north', cs: 'Co je na severu' }).help({ en: 'For example “Starý sad street”. By the Sun writes it above its floor plan.', cs: 'Například „ulice U Starého sadu“. Po slunci ji napíše nad půdorys.' }),
    southLabel: f.text().label({ en: 'What lies to the south', cs: 'Co je na jihu' }).help({ en: 'For example “the garden with the old orchard”. By the Sun writes it under its floor plan.', cs: 'Například „zahrada se starým sadem“. Po slunci ji napíše pod půdorys.' }),
  },
})

const pricelist = defineBlock({
  label: { en: 'Price list', cs: 'Ceník bytů' },
  description: { en: 'The flats with a filter by layout and state. A flat can be asked about with one click.', cs: 'Byty s filtrem podle dispozice a stavu. Na byt se dá jedním kliknutím zeptat.' },
  icon: 'i-lucide-table',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    note: f.text({ multiline: true }).label({ en: 'Small print', cs: 'Drobný text' })
      .help({ en: 'Under the list: what the areas are, how long a reservation lasts. Blueprint and By the Sun add “Price list valid as of …” from Site settings.', cs: 'Pod seznamem: co jsou plochy, jak dlouho platí rezervace. Modrotisk a Po slunci doplní „Ceník platí k …“ z Nastavení webu.' }),
  },
})

const standards = defineBlock({
  label: { en: 'Standards', cs: 'Standardy' },
  description: { en: 'The standards from the Standards section, with one or two photos.', cs: 'Standardy ze sekce Standardy, s jednou nebo dvěma fotografiemi.' },
  icon: 'i-lucide-ruler',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 2, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Blueprint and Floors show the first, By the Sun both. Blueprint splits a caption at “ · ” into two labels.', cs: 'Modrotisk a Patra ukážou první, Po slunci obě. Modrotisk popisek u znaku „ · “ rozdělí na dva štítky.' }),
  },
})

const surroundings = defineBlock({
  label: { en: 'Surroundings', cs: 'Okolí' },
  description: { en: 'What is near the building, from the Surroundings section, with two photos.', cs: 'Co je poblíž domu, ze sekce Okolí, se dvěma fotografiemi.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    note: f.text({ multiline: true }).label({ en: 'Line under the lists', cs: 'Řádek pod seznamy' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 2, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'By the Sun lays the two in one frame, a circle over a rounded rectangle, and writes no captions.', cs: 'Po slunci je složí do jednoho pole, kruh přes zaoblený obdélník, a popisky nepíše.' }),
  },
})

const progress = defineBlock({
  label: { en: 'Construction progress', cs: 'Stav stavby' },
  description: { en: 'Where the construction stands: a photo, the share built and the stages from the Construction stages section.', cs: 'Jak stavba pokročila: fotografie, prostavěnost a etapy ze sekce Etapy stavby.' },
  icon: 'i-lucide-hard-hat',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    percent: f.number({ min: 0, max: 100 }).optional().label({ en: 'Share built in %', cs: 'Prostavěno v %' }),
    percentLabel: f.text().label({ en: 'What the share is of', cs: 'Čeho se podíl týká' })
      .help({ en: 'For example “of the construction budget”. Blueprint writes it as a row of the list, Floors beside the large number; By the Sun writes the share only when this is filled in, so put the number in the text above.', cs: 'Například „z rozpočtu stavby“. Modrotisk ho napíše jako řádek seznamu, Patra vedle velkého čísla; Po slunci podíl napíše, jen když je pole vyplněné, proto číslo uveďte i v textu výše.' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
      },
      max: 2, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Blueprint and By the Sun show the first, Floors both (the site today and the house as it will be).', cs: 'Modrotisk a Po slunci ukážou první, Patra obě (stavbu dnes a dům, jak bude vypadat).' }),
    status: f.text({ multiline: true }).label({ en: 'What is going on now', cs: 'Co se děje teď' })
      .help({ en: 'A short paragraph about the current work and visits to the site.', cs: 'Krátký odstavec o právě probíhajících pracích a o prohlídkách stavby.' }),
    facts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Label', cs: 'Popisek' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }),
      },
      max: 5, itemLabel: { en: 'Row', cs: 'Řádek' },
    }).label({ en: 'Rows of facts', cs: 'Řádky s údaji' })
      .help({ en: 'For example “Show flat 2.03 – from May 2027”.', cs: 'Například „Vzorový byt 2.03 – od května 2027“.' }),
  },
})

const gallery = defineBlock({
  label: { en: 'Photographs', cs: 'Galerie' },
  description: { en: 'Visualisations and photos from the building site.', cs: 'Vizualizace a fotografie ze stavby.' },
  icon: 'i-lucide-images',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'Floors and By the Sun write it beside the heading, Blueprint as a large sentence beside the last photo.', cs: 'Patra a Po slunci ho napíšou vedle nadpisu, Modrotisk jako velkou větu vedle poslední fotografie.' }),
    note: f.text({ multiline: true }).label({ en: 'Small print', cs: 'Drobný text' }).help({ en: 'Only Blueprint writes it, under the large sentence.', cs: 'Píše ho jen Modrotisk, pod velkou větou.' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
        kind: f.select({
          options: ['render', 'photo'] as const, default: 'render',
          labels: { render: { en: 'Visualisation', cs: 'Vizualizace' }, photo: { en: 'Photo from the site', cs: 'Fotografie ze stavby' } },
        }).label({ en: 'What it is', cs: 'Co to je' })
          .help({ en: 'Blueprint numbers the pictures by it (V 1, F 1…) and writes it beside the large ones.', cs: 'Modrotisk podle ní obrázky číslu je (V 1, F 1…) a u velkých ji připíše.' }),
      },
      max: 24, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Drag to change the order. The looks lay the photos out in a repeating pattern of wide and narrow pictures.', cs: 'Pořadí změníte přetažením. Vzhledy fotografie skládají do opakujícího se vzoru širokých a úzkých obrázků.' }),
  },
})

const financing = defineBlock({
  label: { en: 'Financing', cs: 'Financování' },
  description: { en: 'The payments by share, worked out for an example flat, and the mortgage adviser.', cs: 'Platby podle podílů, spočítané na příkladu bytu, a hypoteční poradce.' },
  icon: 'i-lucide-banknote',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    exampleFlat: f.text().label({ en: 'Number of the example flat', cs: 'Číslo příkladového bytu' })
      .help({ en: 'For example “2.04”. The amounts are its price times the shares. Leave it empty and the amounts are not shown.', cs: 'Například „2.04“. Částky jsou jeho cena krát podíly. Když pole necháte prázdné, částky se nezobrazí.' }),
    payments: f.list({
      fields: {
        share: f.number({ min: 1, max: 100 }).label({ en: 'Share in %', cs: 'Podíl v %' }),
        when: f.text({ required: true }).label({ en: 'When', cs: 'Kdy' }).help({ en: 'For example “On signing the contract”.', cs: 'Například „Při podpisu smlouvy“.' }),
        note: f.text({ multiline: true }).label({ en: 'Note', cs: 'Poznámka' }),
      },
      max: 5, itemLabel: { en: 'Payment', cs: 'Platba' },
    }).label({ en: 'Payments', cs: 'Platby' })
      .help({ en: 'By the Sun sets the areas of three discs by the shares, Floors the widths of three blocks.', cs: 'Po slunci podle podílů nastaví plochy tří kotoučů, Patra šířky tří bloků.' }),
    advisorLabel: f.text().label({ en: 'Line above the adviser', cs: 'Řádek nad poradcem' }).help({ en: 'For example “Mortgage adviser”. Only Blueprint writes it.', cs: 'Například „Hypoteční poradce“. Píše ho jen Modrotisk.' }),
    advisorLead: f.text().label({ en: 'Adviser: who', cs: 'Poradce: kdo' }).help({ en: 'For example “Ing. Jan Novák will take you through the mortgage.”', cs: 'Například „Hypotéku s vámi projde Ing. Jan Novák.“' }),
    advisorText: f.text({ multiline: true }).label({ en: 'Adviser: what they do', cs: 'Poradce: co udělá' }),
    advisorNote: f.text().label({ en: 'Adviser: note', cs: 'Poradce: poznámka' }).help({ en: 'For example “The consultation is free and without obligation.”', cs: 'Například „Konzultace je zdarma a nezávazná.“' }),
    advisorPhone: f.text().label({ en: 'Adviser: phone', cs: 'Poradce: telefon' }),
    advisorEmail: f.text({ format: 'email' }).label({ en: 'Adviser: e-mail', cs: 'Poradce: e-mail' }),
  },
})

const developer = defineBlock({
  label: { en: 'Developer', cs: 'Kdo staví' },
  description: { en: 'Who builds the house: a text, a photo and the finished buildings from the Finished buildings section.', cs: 'Kdo dům staví: text, fotografie a dokončené stavby ze sekce Dokončené stavby.' },
  icon: 'i-lucide-hammer',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    image: photo('Photo of a finished building', 'Fotografie dokončené stavby'),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
    listLabel: f.text().label({ en: 'Title of the list', cs: 'Nadpis seznamu' }).help({ en: 'For example “Finished”. Floors writes it above the list; the other looks keep it for screen readers.', cs: 'Například „Co už stojí“. Patra ho napíšou nad seznam; ostatní vzhledy ho nechají čtečkám.' }),
    note: f.text({ multiline: true }).label({ en: 'Line under the list', cs: 'Řádek pod seznamem' }),
  },
})

const enquiry = defineBlock({
  label: { en: 'Enquiry', cs: 'Dotaz a prohlídka' },
  description: { en: 'The salesperson from Site settings and a form to ask about a flat or book a visit. Enquiries arrive in the admin.', cs: 'Prodejce z Nastavení webu a formulář s dotazem na byt nebo s objednáním prohlídky. Dotazy najdete v administraci.' },
  icon: 'i-lucide-mail-question',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    office: f.list({
      fields: {
        label: f.text().label({ en: 'Label', cs: 'Popisek' }),
        value: f.text({ required: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 4, itemLabel: { en: 'Row', cs: 'Řádek' },
    }).label({ en: 'Sales office', cs: 'Prodejní kancelář' })
      .help({ en: 'Where and when to meet. Blueprint writes the rows as a list with their labels; the other looks write the texts as one paragraph.', cs: 'Kde a kdy se potkáte. Modrotisk řádky napíše jako seznam s popisky; ostatní vzhledy napíšou texty jako jeden odstavec.' }),
    wants: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Choice', cs: 'Volba' }) },
      max: 8, itemLabel: { en: 'Choice', cs: 'Volba' },
    }).label({ en: 'What can we do for you', cs: 'Co pro vás máme udělat' })
      .help({ en: 'Choices the visitor ticks, for example “Arrange a visit”. Leave the list empty and the form does not ask.', cs: 'Volby, které návštěvník zaškrtne, například „Domluvit prohlídku“. Když seznam necháte prázdný, formulář se neptá.' }),
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
  blocks: { opening, overview, pricelist, standards, surroundings, progress, gallery, financing, developer, enquiry, text: richText, ...customTypeBlocks() },
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
  formsPlugin(), // the enquiries of the form below
]

// ── the enquiry form ──
// The website draws it per look (the kit's useSiteForm). Two of its questions are worded by the
// developer: which flat (from the flats that are not sold) and what to do (the "Enquiry" block).
export const Enquiry = defineForm('enquiry', {
  label: { en: 'Enquiries', cs: 'Dotazy' },
  labelSingular: { en: 'Enquiry', cs: 'Dotaz' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    phone: f.text({ required: true, max: 50 }).label({ en: 'Phone', cs: 'Telefon' }),
    email: f.text({ required: true, format: 'email', max: 200 }).label({ en: 'E-mail', cs: 'E-mail' }),
    unit: f.text({ max: 200 }).optional().label({ en: 'Flat', cs: 'Který byt vás zajímá' }).help({ en: 'The flat the person asks about, for example “2.04”.', cs: 'Byt, na který se osoba ptá, například „2.04“.' }),
    wants: f.text({ max: 500 }).optional().label({ en: 'What to do', cs: 'Co máme udělat' }).help({ en: 'The choices the person ticked.', cs: 'Volby, které osoba zaškrtla.' }),
    message: f.text({ multiline: true, max: 5000 }).optional().label({ en: 'Message (optional)', cs: 'Zpráva (nepovinné)' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send enquiry', cs: 'Odeslat dotaz' },
  successMessage: { en: 'Thank you, we have your enquiry. We will answer by the end of the next working day.', cs: 'Děkujeme, dotaz máme. Odpovíme do konce následujícího pracovního dne.' },
})
export const FormSettings = defineFormSettings()
