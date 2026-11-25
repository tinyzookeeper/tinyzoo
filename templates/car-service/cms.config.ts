import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Garage template: what the owner can write and change. One model
// for all three looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, ve vzhledu Šuplíky třeba barvou.',
  en: 'Text between *asterisks* stands out, in Drawers for example in colour.',
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// The warning-light symbols and colours of a group of the price list (Warning Lights draws them).
const LAMPS = ['engine', 'brake', 'tyre', 'snow', 'wrench', 'door', 'battery', 'oil'] as const
const LAMP_COLORS = ['amber', 'red', 'green', 'blue'] as const
// The small symbol of a group (Road and Drawers draw it): names of Lucide icons.
const GROUP_ICONS = ['wrench', 'circle-dot', 'snowflake', 'clipboard-check', 'activity', 'car', 'battery-charging', 'gauge', 'settings', 'droplets'] as const

// ── the whole business: who, where, when, how much ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The name, the address, the phone, the opening hours, the rates, the look and the colours.', cs: 'Název, adresa, telefon, otevírací doba, sazby, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'shortName', 'tagline', 'logo', 'look', 'colors'] },
      { label: { en: 'Contact', cs: 'Kontakt' }, fields: ['phone', 'phone2', 'email', 'street', 'zip', 'city'] },
      { label: { en: 'Opening hours and free dates', cs: 'Otevírací doba a volné termíny' }, fields: ['hours', 'nextService', 'nextTyres'] },
      { label: { en: 'Rates', cs: 'Sazby' }, fields: ['hourlyRate', 'diagnosticsRate', 'warranty'] },
      { label: { en: 'Header and footer', cs: 'Záhlaví a zápatí' }, fields: ['ctaLabel', 'ctaUrl', 'about', 'legalName', 'companyId', 'vatId', 'registry'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the garage', cs: 'Název autoservisu' })
      .help({ en: 'The whole name, for example “Autoservis U Vlečky”. It stands in the footer and in the title of the page.', cs: 'Celý název, například „Autoservis U Vlečky“. Stojí v zápatí a v titulku stránky.' }),
    shortName: f.text().optional().label({ en: 'Short name for the header', cs: 'Krátký název do záhlaví' })
      .help({ en: 'For example “U Vlečky”. Leave it empty and the header writes the name without its first word “Autoservis” (or “Pneuservis”, “Servis”).', cs: 'Například „U Vlečky“. Když pole necháte prázdné, záhlaví napíše název bez prvního slova „Autoservis“ (nebo „Pneuservis“, „Servis“).' }),
    tagline: f.text().optional().label({ en: 'Line under the name', cs: 'Řádek pod názvem' })
      .help({ en: 'Small, under the short name in the header: “garage, Jičín”.', cs: 'Malým písmem pod krátkým názvem v záhlaví: „autoservis, Jičín“.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the look’s own sign.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo značky vzhledu.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    phone: f.text().label({ en: 'Phone', cs: 'Telefon' })
      .help({ en: 'The main number, written the way you want it shown. It is in the header, the opening and the footer.', cs: 'Hlavní číslo, tak jak se má zobrazit. Je v záhlaví, v úvodu a v zápatí.' }),
    phone2: f.text().optional().label({ en: 'Second phone', cs: 'Druhý telefon' })
      .help({ en: 'For example a mobile number for text messages outside the opening hours.', cs: 'Například mobil na SMS mimo otevírací dobu.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    street: f.text().label({ en: 'Street and number', cs: 'Ulice a číslo' }),
    zip: f.text().label({ en: 'Postcode', cs: 'PSČ' }),
    city: f.text().label({ en: 'Town', cs: 'Město' }),
    hours: f.list({
      fields: {
        day: f.select({
          options: DAYS, default: 'mon',
          labels: {
            mon: { en: 'Monday', cs: 'Pondělí' }, tue: { en: 'Tuesday', cs: 'Úterý' }, wed: { en: 'Wednesday', cs: 'Středa' }, thu: { en: 'Thursday', cs: 'Čtvrtek' },
            fri: { en: 'Friday', cs: 'Pátek' }, sat: { en: 'Saturday', cs: 'Sobota' }, sun: { en: 'Sunday', cs: 'Neděle' },
          },
        }).label({ en: 'Day', cs: 'Den' }),
        from: f.text({ max: 10 }).label({ en: 'Opens', cs: 'Otevírá' }).help({ en: 'For example “7.00”. Leave both empty on a closed day.', cs: 'Například „7.00“. V den zavřeno nechte obě pole prázdná.' }),
        to: f.text({ max: 10 }).label({ en: 'Closes', cs: 'Zavírá' }),
        note: f.text().label({ en: 'Note', cs: 'Poznámka' }).help({ en: 'For example “tyres only, in the season”.', cs: 'Například „jen pneu, v sezóně“.' }),
      },
      max: 7, itemLabel: { en: 'Day', cs: 'Den' },
    }).label({ en: 'Opening hours', cs: 'Otevírací doba' })
      .help({ en: 'One row for each day. The website says “open today until 17.00” from it, and marks today in the table.', cs: 'Jeden řádek pro každý den. Z něj web napíše „Dnes otevřeno do 17.00“ a v tabulce označí dnešek.' }),
    nextService: f.datetime({ allDay: true }).optional().label({ en: 'Next free day for a service', cs: 'Nejbližší volný termín na servis' })
      .help({ en: 'Shown in the opening and in the form’s choice of days. Change it when the diary fills up.', cs: 'Ukáže se v úvodu a v nabídce dnů ve formuláři. Změňte ho, když se kalendář zaplní.' }),
    nextTyres: f.datetime({ allDay: true }).optional().label({ en: 'Next free day for tyres', cs: 'Nejbližší volný termín na přezutí' })
      .help({ en: 'Written “tomorrow, Tuesday” when it is tomorrow.', cs: 'Když je to zítra, napíše se „zítra, úterý“.' }),
    hourlyRate: f.number({ int: true, min: 0 }).label({ en: 'Hourly rate in Kč', cs: 'Hodina práce v Kč' })
      .help({ en: 'With VAT. Warning Lights and Drawers show it in the opening.', cs: 'S DPH. Vzhledy Kontrolky a Šuplíky ji ukážou v úvodu.' }),
    diagnosticsRate: f.number({ int: true, min: 0 }).optional().label({ en: 'Diagnostics rate in Kč', cs: 'Diagnostika v Kč za hodinu' }),
    warranty: f.text().label({ en: 'Warranty', cs: 'Záruka' }).help({ en: 'For example “24 months”.', cs: 'Například „24 měsíců“.' }),
    ctaLabel: f.text().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    about: f.text({ multiline: true }).label({ en: 'Text in the footer', cs: 'Text v zápatí' })
      .help({ en: 'One or two sentences about the garage.', cs: 'Jedna nebo dvě věty o autoservisu.' }),
    legalName: f.text().optional().label({ en: 'Company name', cs: 'Obchodní jméno' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    vatId: f.text().optional().label({ en: 'VAT number (DIČ)', cs: 'DIČ' }),
    registry: f.text().optional().label({ en: 'Entry in the register', cs: 'Zápis v rejstříku' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the groups of the price list ──
export const ServiceGroup = defineEntity('serviceGroup', {
  label: { en: 'Groups of services', cs: 'Skupiny služeb' },
  labelSingular: { en: 'Group of services', cs: 'Skupina služeb' },
  description: { en: 'The headings of the price list: service and repairs, tyres, air conditioning. Drag to put them in order.', cs: 'Nadpisy ceníku: servis a opravy, pneuservis, klimatizace. Pořadí změníte přetažením.' },
  icon: 'i-lucide-folders',
  titleField: 'name',
  admin: { list: { columns: ['name', 'summary'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' })
      .help({ en: 'The part of the link that leads to the group (/#g-…).', cs: 'Část odkazu, který vede ke skupině (/#g-…).' }),
    summary: f.text().optional().label({ en: 'One line about the group', cs: 'Jedna věta o skupině' })
      .help({ en: 'Road shows it under the name of the group.', cs: 'Vzhled Cesta ji ukáže pod názvem skupiny.' }),
    icon: f.select({
      options: GROUP_ICONS, default: 'wrench',
      labels: {
        'wrench': { en: 'Wrench', cs: 'Klíč' }, 'circle-dot': { en: 'Tyre', cs: 'Pneumatika' }, 'snowflake': { en: 'Snowflake', cs: 'Vločka' },
        'clipboard-check': { en: 'Checklist', cs: 'Kontrolní seznam' }, 'activity': { en: 'Pulse', cs: 'Puls' }, 'car': { en: 'Car', cs: 'Auto' },
        'battery-charging': { en: 'Battery', cs: 'Baterie' }, 'gauge': { en: 'Gauge', cs: 'Budík' }, 'settings': { en: 'Cog', cs: 'Ozubené kolo' }, 'droplets': { en: 'Drops', cs: 'Kapky' },
      },
    }).label({ en: 'Symbol', cs: 'Symbol' }).help({ en: 'Road draws it in a disc beside the name of the group.', cs: 'Vzhled Cesta ho nakreslí v kruhu u názvu skupiny.' }),
    lamp: f.select({
      options: LAMPS, default: 'engine',
      labels: {
        engine: { en: 'Engine', cs: 'Motor' }, brake: { en: 'Brakes', cs: 'Brzdy' }, tyre: { en: 'Tyre pressure', cs: 'Tlak v pneu' }, snow: { en: 'Ice', cs: 'Mráz' },
        wrench: { en: 'Service', cs: 'Servis' }, door: { en: 'Door', cs: 'Dveře' }, battery: { en: 'Battery', cs: 'Baterie' }, oil: { en: 'Oil', cs: 'Olej' },
      },
    }).label({ en: 'Warning light', cs: 'Kontrolka' }).help({ en: 'Warning Lights draws it before the group and in the row of lights.', cs: 'Vzhled Kontrolky ji nakreslí před skupinou a v řadě kontrolek.' }),
    lampColor: f.select({
      options: LAMP_COLORS, default: 'amber',
      labels: { amber: { en: 'Amber', cs: 'Jantarová' }, red: { en: 'Red', cs: 'Červená' }, green: { en: 'Green', cs: 'Zelená' }, blue: { en: 'Blue', cs: 'Modrá' } },
    }).label({ en: 'Colour of the light', cs: 'Barva kontrolky' }),
    lampPosition: f.number().optional().label({ en: 'Place in the row of lights', cs: 'Místo v řadě kontrolek' })
      .help({ en: 'Warning Lights sets the lights in this order; without it, in the order of the groups.', cs: 'Vzhled Kontrolky řadí kontrolky podle tohoto pořadí; bez něj podle pořadí skupin.' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the price list ──
export const Service = defineEntity('service', {
  label: { en: 'Services and prices', cs: 'Služby a ceník' },
  labelSingular: { en: 'Service', cs: 'Služba' },
  description: { en: 'Every line of the price list. Drag to put them in order; the groups keep their lines together.', cs: 'Každý řádek ceníku. Pořadí změníte přetažením; skupiny drží své řádky pohromadě.' },
  icon: 'i-lucide-tags',
  titleField: 'name',
  admin: { list: { columns: ['name', 'group', 'price', 'priceFrom'], orderField: 'position' } },
  fields: {
    group: f.relation({ to: () => ServiceGroup, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Group', cs: 'Skupina' }),
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    text: f.text().optional().label({ en: 'What is in the price', cs: 'Co je v ceně' }).help({ en: 'A few words under the name.', cs: 'Pár slov pod názvem.' }),
    price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    priceFrom: f.boolean().label({ en: 'Price “from”', cs: 'Cena „od“' }).help({ en: 'Turn it on when the price depends on the car or the parts.', cs: 'Zapněte, když cena záleží na autě nebo na dílech.' }),
    unit: f.select({
      options: ['none', 'hour', 'season'] as const, default: 'none',
      labels: { none: { en: 'None', cs: 'Žádná' }, hour: { en: 'per hour', cs: 'za hodinu' }, season: { en: 'per season', cs: 'za sezónu' } },
    }).label({ en: 'Price per', cs: 'Cena za' }).help({ en: 'Where the price is for an hour or a season, it is written beside the price instead of the duration.', cs: 'Když je cena za hodinu nebo za sezónu, napíše se u ceny místo doby trvání.' }),
    duration: f.text().optional().label({ en: 'How long it takes', cs: 'Jak dlouho to trvá' }).help({ en: 'For example “45 min”, “half a day”.', cs: 'Například „45 min“, „půl dne“.' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['group'] },
})

// ── offers of the season ──
export const SeasonalOffer = defineEntity('seasonalOffer', {
  label: { en: 'Seasonal offers', cs: 'Sezónní akce' },
  labelSingular: { en: 'Seasonal offer', cs: 'Sezónní akce' },
  description: { en: 'A notice with up to four prices, shown on the website only between the two dates: changing tyres in autumn, air conditioning in spring.', cs: 'Oznámení až se čtyřmi cenami, které se na webu ukáže jen mezi dvěma daty: přezouvání na podzim, klimatizace na jaře.' },
  icon: 'i-lucide-snowflake',
  titleField: 'title',
  admin: { list: { columns: ['title', 'validFrom', 'validTo'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Heading', cs: 'Nadpis' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    validFrom: f.datetime({ allDay: true }).label({ en: 'Valid from', cs: 'Platí od' }),
    validTo: f.datetime({ allDay: true }).label({ en: 'Valid to', cs: 'Platí do' }).help({ en: 'Written as “Season until 11. 12.”. The last day is included.', cs: 'Napíše se jako „Sezóna do 11. 12.“. Poslední den platí.' }),
    chip: f.text().optional().label({ en: 'Figure beside the date', cs: 'Údaj u data' })
      .help({ en: 'Warning Lights writes it beside a snowflake, for example “+3 °C”.', cs: 'Vzhled Kontrolky ho napíše u vločky, například „+3 °C“.' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Road and Drawers show it beside the prices.', cs: 'Cesta a Šuplíky ji ukážou vedle cen.' }),
    prices: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }).help({ en: 'For example “Wheels on rims”.', cs: 'Například „Kola na discích“.' }),
        price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
        note: f.text().label({ en: 'Note', cs: 'Poznámka' }).help({ en: 'For example “4 wheels, 20 minutes”.', cs: 'Například „4 kola, 20 minut“.' }),
      },
      max: 4, itemLabel: { en: 'Price', cs: 'Cena' },
    }).label({ en: 'Prices', cs: 'Ceny' }).help({ en: 'Drawers draws the wheels bigger one after another, so put the smallest first.', cs: 'Šuplíky kreslí kola postupně větší, nejmenší dejte první.' }),
    buttonLabel: f.text().optional().label({ en: 'Button text', cs: 'Text tlačítka' }),
    buttonUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the people ──
export const TeamMember = defineEntity('teamMember', {
  label: { en: 'Team', cs: 'Tým' },
  labelSingular: { en: 'Team member', cs: 'Člen týmu' },
  description: { en: 'The people a customer meets. Drag to put them in order.', cs: 'Lidé, které zákazník potká. Pořadí změníte přetažením.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role', 'years'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }).help({ en: 'Drawers writes the first name on a patch over the photo.', cs: 'Vzhled Šuplíky napíše křestní jméno na našivku přes fotografii.' }),
    role: f.text().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “Owner, diagnostics and engines”.', cs: 'Například „Majitel, diagnostika a motory“.' }),
    years: f.number({ int: true, min: 0 }).optional().label({ en: 'Years in the trade', cs: 'Let v oboru' })
      .help({ en: 'Warning Lights shows them on an odometer, Drawers after the role.', cs: 'Vzhled Kontrolky je ukáže na počítadle kilometrů, Šuplíky za rolí.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' }).help({ en: 'A portrait, 4:5.', cs: 'Portrét na výšku, 4:5.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'A few sentences', cs: 'Pár vět' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── what customers said ──
export const Review = defineEntity('review', {
  label: { en: 'Reviews', cs: 'Reference' },
  labelSingular: { en: 'Review', cs: 'Reference' },
  description: { en: 'What customers said, with their car.', cs: 'Co říkají zákazníci, s jejich autem.' },
  icon: 'i-lucide-quote',
  titleField: 'name',
  admin: { list: { columns: ['name', 'car', 'year'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    car: f.text().label({ en: 'Car', cs: 'Auto' }).help({ en: 'The make and the kind, for example “Škoda hatchback”. Drawers writes it on a number plate.', cs: 'Značka a druh, například „Škoda hatchback“. Šuplíky ho napíšou na značku.' }),
    year: f.number({ int: true, min: 1950 }).optional().label({ en: 'Year of the car', cs: 'Rok výroby' }),
    text: f.text({ required: true, multiline: true, max: 700 }).label({ en: 'Text', cs: 'Text' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── what comes with a repair ──
export const Extra = defineEntity('extra', {
  label: { en: 'Extras', cs: 'Služby navíc' },
  labelSingular: { en: 'Extra', cs: 'Služba navíc' },
  description: { en: 'A replacement car, collection and delivery, tyre storage. Drag to put them in order.', cs: 'Náhradní vůz, vyzvednutí a přivezení, uskladnění pneumatik. Pořadí změníte přetažením.' },
  icon: 'i-lucide-sparkles',
  titleField: 'name',
  admin: { list: { columns: ['name', 'price', 'unit'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    price: f.text().label({ en: 'Price', cs: 'Cena' }).help({ en: 'As you want it written: “290 Kč”, “free”.', cs: 'Tak, jak se má napsat: „290 Kč“, „zdarma“.' }),
    unit: f.text().optional().label({ en: 'What the price is for', cs: 'Za co cena platí' })
      .help({ en: 'Written small after the price: “a day”, “in Jičín”.', cs: 'Malým písmem za cenou: „za den“, „po Jičíně“.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photograph', cs: 'Fotografie' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['image'] },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })

const hero = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The heading, a few words, two buttons and a photograph. It shows today’s opening hours, the next free day and the rates from Site settings.', cs: 'Nadpis, pár slov, dvě tlačítka a fotografie. Z Nastavení webu ukáže dnešní otevírací dobu, nejbližší volný termín a sazby.' },
  icon: 'i-lucide-panel-top',
  fields: {
    eyebrow: eyebrow().help({ en: 'Warning Lights and Drawers write it above the heading; Road leaves it out.', cs: 'Kontrolky a Šuplíky ho napíšou nad nadpis; Cesta ho vynechá.' }),
    heading: heading().help({ en: 'Text between *asterisks* is set in the brand colour by Drawers.', cs: 'Text mezi *hvězdičkami* vysází Šuplíky v barvě značky.' }),
    text: text(),
    image: photo('Photograph', 'Fotografie').help({ en: 'Road shows it tall beside the heading.', cs: 'Cesta ji ukáže vedle nadpisu na výšku.' }),
    dashImage: photo('Photograph for Warning Lights', 'Fotografie pro vzhled Kontrolky')
      .help({ en: 'Warning Lights frames it beside the heading. Leave it empty to use the photograph above.', cs: 'Kontrolky ji zarámují vedle nadpisu. Když pole necháte prázdné, použije se fotografie výše.' }),
    chestImage: photo('Photograph for Drawers', 'Fotografie pro vzhled Šuplíky')
      .help({ en: 'Drawers sets it on a coloured block. Leave it empty to use the photograph above.', cs: 'Šuplíky ji položí na barevný blok. Když pole necháte prázdné, použije se fotografie výše.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Second button text', cs: 'Text druhého tlačítka' })
      .help({ en: 'Warning Lights and Drawers draw it; Road shows the phone number in its place.', cs: 'Kontrolky a Šuplíky ho nakreslí; Cesta na jeho místě ukáže telefon.' }),
    secondaryUrl: link('Second button destination', 'Cíl druhého tlačítka'),
  },
})

const facts = defineBlock({
  label: { en: 'Four facts', cs: 'Čtyři údaje' },
  description: { en: 'Large figures without boxes: the rate, the warranty, how fast you get a price.', cs: 'Velká čísla bez rámečků: sazba, záruka, jak rychle znáte cenu.' },
  icon: 'i-lucide-gauge',
  fields: {
    items: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }).help({ en: 'For example “Hourly rate”.', cs: 'Například „Hodina práce“.' }),
        value: f.text({ required: true }).label({ en: 'Figure', cs: 'Údaj' }).help({ en: 'For example “790 Kč”.', cs: 'Například „790 Kč“.' }),
        note: f.text().label({ en: 'Note', cs: 'Poznámka' }),
      },
      max: 4, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Facts', cs: 'Údaje' }),
  },
})

const lamps = defineBlock({
  label: { en: 'Warning lights', cs: 'Kontrolky' },
  description: { en: 'One light for every group of the price list; each leads to its group and opens it.', cs: 'Jedna kontrolka pro každou skupinu ceníku; každá vede ke své skupině a otevře ji.' },
  icon: 'i-lucide-triangle-alert',
  fields: {
    heading: heading().help({ en: 'For example “Which one is lit?”.', cs: 'Například „Která svítí vám?“.' }),
    text: text(),
  },
})

const season = defineBlock({
  label: { en: 'Seasonal offer', cs: 'Sezónní akce' },
  description: { en: 'Shows the offers from Seasonal offers that are valid today. Between their dates only; otherwise the block shows nothing.', cs: 'Ukáže sezónní akce, které platí dnes. Jen mezi jejich daty; jinak blok nic nezobrazí.' },
  icon: 'i-lucide-snowflake',
  fields: {},
})

const prices = defineBlock({
  label: { en: 'Price list', cs: 'Ceník' },
  description: { en: 'The groups and lines of Services and prices. Each group can be closed; on a phone the groups after the second start closed.', cs: 'Skupiny a řádky ze sekce Služby a ceník. Každou skupinu jde zavřít; na telefonu začínají zavřené skupiny od třetí.' },
  icon: 'i-lucide-tags',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'Under the heading: that prices include VAT and what “from” means.', cs: 'Pod nadpisem: že ceny jsou s DPH a co znamená „od“.' }),
    footnote: f.text({ multiline: true }).label({ en: 'Note under the list', cs: 'Poznámka pod ceníkem' })
      .help({ en: 'Warning Lights writes it under the list, after the two rates.', cs: 'Vzhled Kontrolky ji napíše pod ceník, za obě sazby.' }),
  },
})

const workshop = defineBlock({
  label: { en: 'Photographs from the workshop', cs: 'Fotografie z dílny' },
  description: { en: 'Two large photographs with a caption each.', cs: 'Dvě velké fotografie s popiskem.' },
  icon: 'i-lucide-images',
  fields: {
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        lead: f.text().label({ en: 'Caption, in bold', cs: 'Popisek tučně' }),
        text: f.text().label({ en: 'Caption, the rest', cs: 'Popisek, pokračování' }),
      },
      max: 4, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' }).help({ en: 'The first is wider than the second.', cs: 'První je širší než druhá.' }),
  },
})

const steps = defineBlock({
  label: { en: 'How a repair goes', cs: 'Jak oprava probíhá' },
  description: { en: 'Three to six steps from the call to the handover.', cs: 'Tři až šest kroků od telefonátu po předání.' },
  icon: 'i-lucide-route',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'Warning Lights and Drawers write it beside the heading.', cs: 'Kontrolky a Šuplíky ho napíšou vedle nadpisu.' }),
    steps: f.list({
      fields: {
        title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
        mark: f.text({ max: 3 }).label({ en: 'Letter instead of the number', cs: 'Písmeno místo čísla' })
          .help({ en: 'For example “R” for the last step, the warranty. Warning Lights draws such a step in red, like reverse gear.', cs: 'Například „R“ u posledního kroku, záruky. Kontrolky takový krok nakreslí červeně, jako zpátečku.' }),
        key: f.boolean().label({ en: 'The key step', cs: 'Hlavní krok' }).help({ en: 'Warning Lights draws it in the brand colour.', cs: 'Kontrolky ho nakreslí barvou značky.' }),
      },
      max: 6, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'Steps', cs: 'Kroky' }),
  },
})

const makes = defineBlock({
  label: { en: 'Makes and what we do not do', cs: 'Značky a co neděláme' },
  description: { en: 'The makes the garage knows best and those it services, and a list of what it does not do.', cs: 'Značky, které autoservis zná nejlépe, a ty, které servisuje, a seznam toho, co neděláme.' },
  icon: 'i-lucide-car',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Warning Lights uses the makes of the first group as the heading, so a heading that is the same as them is written once.', cs: 'Kontrolky mají jako nadpis značky první skupiny, takže nadpis stejný jako ony se napíše jen jednou.' }),
    groups: f.list({
      fields: {
        names: f.text({ required: true }).label({ en: 'Makes', cs: 'Značky' }).help({ en: 'For example “Škoda, Volkswagen, Seat, Audi”.', cs: 'Například „Škoda, Volkswagen, Seat, Audi“.' }),
        text: f.text({ multiline: true }).label({ en: 'What the garage does with them', cs: 'Co s nimi děláme' }),
      },
      max: 3, itemLabel: { en: 'Group of makes', cs: 'Skupina značek' },
    }).label({ en: 'Makes', cs: 'Značky' }),
    notHeading: f.text().label({ en: 'Heading of the list of what we do not do', cs: 'Nadpis seznamu toho, co neděláme' }),
    notText: f.text({ multiline: true }).label({ en: 'Sentence under it', cs: 'Věta pod ním' }).help({ en: 'Warning Lights leaves it out.', cs: 'Kontrolky ji vynechají.' }),
    notDoing: f.list({
      fields: {
        text: f.text({ required: true }).label({ en: 'What we do not do', cs: 'Co neděláme' }),
        note: f.text().label({ en: 'What we do instead', cs: 'Co děláme místo toho' }),
      },
      max: 8, itemLabel: { en: 'Line', cs: 'Řádek' },
    }).label({ en: 'What we do not do', cs: 'Co neděláme' }),
  },
})

const extras = defineBlock({
  label: { en: 'Extras', cs: 'Služby navíc' },
  description: { en: 'The entries of Extras with their photographs. Right after the block of makes it continues on the same background.', cs: 'Položky ze sekce Služby navíc s fotografiemi. Hned za blokem značek pokračuje na stejném pozadí.' },
  icon: 'i-lucide-sparkles',
  fields: {
    heading: heading(),
  },
})

const team = defineBlock({
  label: { en: 'Team', cs: 'Lidé' },
  description: { en: 'The people from the Team section with their photographs.', cs: 'Lidé ze sekce Tým s fotografiemi.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
  },
})

const reviews = defineBlock({
  label: { en: 'Reviews', cs: 'Reference' },
  description: { en: 'What customers said, from the Reviews section.', cs: 'Co říkají zákazníci, ze sekce Reference.' },
  icon: 'i-lucide-quote',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
  },
})

const booking = defineBlock({
  label: { en: 'Booking', cs: 'Objednání' },
  description: { en: 'The phone number, the opening hours and a form for a request. The requests arrive in the admin.', cs: 'Telefon, otevírací doba a formulář pro poptávku. Poptávky najdete v administraci.' },
  icon: 'i-lucide-calendar-check',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'The next free days from Site settings are added after it.', cs: 'Nejbližší volné termíny z Nastavení webu se připíšou za něj.' }),
    callLabel: f.text().label({ en: 'Line above the phone number', cs: 'Řádek nad telefonem' }),
    callNote: f.text({ multiline: true }).label({ en: 'Text under the phone number', cs: 'Text pod telefonem' })
      .help({ en: 'Write {phone} where the second phone number from Site settings belongs.', cs: 'Tam, kam patří druhé číslo z Nastavení webu, napište {phone}.' }),
    submitLabel: f.text().label({ en: 'Text of the send button', cs: 'Text tlačítka odeslat' }),
    sentText: f.text().label({ en: 'Message after sending', cs: 'Zpráva po odeslání' }),
    carLabel: f.text().label({ en: 'Question about the car', cs: 'Otázka na auto' }),
    plateLabel: f.text().label({ en: 'Note beside the number plate', cs: 'Poznámka u SPZ' }).help({ en: 'For example “(optional)”.', cs: 'Například „(nepovinné)“.' }),
    messageHint: f.text().label({ en: 'Example in the big field', cs: 'Příklad ve velkém poli' }),
    loanerLabel: f.text().label({ en: 'Question about a replacement car', cs: 'Otázka na náhradní vůz' }),
    privacyNote: f.text().label({ en: 'Note beside the button', cs: 'Poznámka u tlačítka' }),
  },
})

const where = defineBlock({
  label: { en: 'Where to find us', cs: 'Kde nás najdete' },
  description: { en: 'How to get there, the address from Site settings and the opening hours as a table.', cs: 'Jak se k nám dostat, adresa z Nastavení webu a otevírací doba jako tabulka.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    photo: photo(),
    arrival: f.text({ multiline: true }).label({ en: 'How to get there by car', cs: 'Jak k nám autem' }),
    keys: f.text().label({ en: 'About the key box', cs: 'O schránce na klíče' }),
    transit: f.text().label({ en: 'By public transport', cs: 'Veřejnou dopravou' }),
    hoursNote: f.text().label({ en: 'Note under the opening hours', cs: 'Poznámka pod otevírací dobou' }).help({ en: 'Warning Lights writes it; the other looks use the note of each day.', cs: 'Kontrolky ji napíšou; ostatní vzhledy používají poznámku u jednotlivých dnů.' }),
    towards: f.text().label({ en: 'The main road: where it leads', cs: 'Hlavní silnice: kam vede' }).help({ en: 'Road draws it on the sketch of the way, for example “Hradec Králové”.', cs: 'Cesta ji nakreslí do náčrtku příjezdu, například „Hradec Králové“.' }),
    road: f.text().label({ en: 'The main road: its name', cs: 'Hlavní silnice: název' }).help({ en: 'For example “road I/35”.', cs: 'Například „silnice I/35“.' }),
    comingFrom: f.text().label({ en: 'Where you come from', cs: 'Odkud jedete' }).help({ en: 'Road: for example “from the centre of Jičín”.', cs: 'Cesta: například „z centra Jičína“.' }),
    turnAt: f.text().label({ en: 'Where to turn', cs: 'Kde odbočit' }).help({ en: 'For example “at the petrol station”.', cs: 'Například „u čerpací stanice“.' }),
    distance: f.text().label({ en: 'Distance from the turn', cs: 'Vzdálenost od odbočky' }).help({ en: 'For example “400 m from the turn”.', cs: 'Například „400 m od odbočky“.' }),
    landmark: f.text().label({ en: 'Landmark on the way', cs: 'Orientační bod' }).help({ en: 'For example “siding”.', cs: 'Například „vlečka“.' }),
    places: f.text().label({ en: 'Parking places', cs: 'Parkovací místa' }).help({ en: 'For example “6 places”. Drawers writes it in the plan of the yard.', cs: 'Například „6 míst“. Šuplíky ho napíšou do plánku dvora.' }),
    workshopNote: f.text().label({ en: 'What the workshop has', cs: 'Co je v dílně' }).help({ en: 'Drawers writes it in the plan of the yard.', cs: 'Šuplíky ho napíšou do plánku dvora.' }),
    streetLabel: f.text().label({ en: 'Name of the street, for the plan', cs: 'Název ulice do plánku' }),
    gateLabel: f.text().label({ en: 'The gate, for the plan', cs: 'Brána do plánku' }),
    keyLabel: f.text().label({ en: 'The key box, for the plan', cs: 'Schránka na klíče do plánku' }),
    turns: f.list({
      fields: {
        icon: f.select({
          options: ['arrow-up', 'corner-up-right', 'corner-up-left', 'train-track', 'flag', 'arrow-right', 'arrow-left'] as const, default: 'arrow-up',
          labels: {
            'arrow-up': { en: 'Straight on', cs: 'Rovně' }, 'corner-up-right': { en: 'Turn right', cs: 'Vpravo' }, 'corner-up-left': { en: 'Turn left', cs: 'Vlevo' },
            'train-track': { en: 'Railway', cs: 'Železnice' }, 'flag': { en: 'You are there', cs: 'Cíl' }, 'arrow-right': { en: 'Right', cs: 'Doprava' }, 'arrow-left': { en: 'Left', cs: 'Doleva' },
          },
        }).label({ en: 'Symbol', cs: 'Symbol' }),
        text: f.text({ required: true }).label({ en: 'What to do', cs: 'Co udělat' }),
        distance: f.text().label({ en: 'Distance', cs: 'Vzdálenost' }),
      },
      max: 6, itemLabel: { en: 'Turn', cs: 'Odbočka' },
    }).label({ en: 'Directions turn by turn', cs: 'Pokyny odbočku po odbočce' }).help({ en: 'Warning Lights writes them as a list with distances.', cs: 'Kontrolky je napíšou jako seznam se vzdálenostmi.' }),
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
  blocks: { hero, facts, lamps, season, prices, workshop, steps, makes, extras, team, reviews, booking, where, text: richText, ...customTypeBlocks() },
})

// ── menus ──
export const Navigation = defineNavigation({
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    footer: { en: 'Links in the footer', cs: 'Odkazy v zápatí' },
    legal: { en: 'Small print in the footer', cs: 'Drobný text v zápatí' },
  },
})

// ── redirects: an old address that leads to a new one (a renamed page leaves one behind) ──
export const Redirect = defineRedirects()

// ── plugins ──
export const plugins = [
  formsPlugin(), // the requests of the form below
]

// ── the request for a date ──
// The website draws it per look (the kit's useSiteForm). What differs between the looks (the
// wording of a few labels and examples) is written by the owner in the "Booking" block; the
// day to come is chosen from the next free days of Site settings.
export const BookingRequest = defineForm('booking', {
  label: { en: 'Requests', cs: 'Poptávky' },
  labelSingular: { en: 'Request', cs: 'Poptávka' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Name and surname', cs: 'Jméno a příjmení' }),
    phone: f.text({ required: true, max: 40 }).label({ en: 'Phone', cs: 'Telefon' }).help({ en: '+420', cs: '+420' }),
    car: f.text({ required: true, max: 200 }).label({ en: 'Car: make, model, year', cs: 'Vůz: značka, model, rok' }).help({ en: 'Škoda, estate 1.6 diesel, 2015', cs: 'Škoda, kombi 1.6 diesel, 2015' }),
    plate: f.text({ max: 12 }).optional().label({ en: 'Number plate', cs: 'SPZ' }).help({ en: '5H2 4817', cs: '5H2 4817' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'What is going on or what you need', cs: 'Co se děje nebo co potřebujete' })
      .help({ en: 'The brakes squeal at the front left.', cs: 'Při brzdění píská zleva vepředu.' }),
    when: f.text({ max: 200 }).optional().label({ en: 'When it suits you', cs: 'Kdy se vám to hodí' }),
    loaner: f.boolean().label({ en: 'Wants a replacement car', cs: 'Chce náhradní vůz' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send request', cs: 'Odeslat poptávku' },
  successMessage: { en: 'Thank you, we have your request. We will get back to you within two working hours.', cs: 'Děkujeme, poptávku máme. Ozveme se do dvou pracovních hodin.' },
})
export const FormSettings = defineFormSettings()
