import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Restaurant template: what the owner can write and change. One model
// for all three looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou nebo barvou.',
  en: 'Text between *asterisks* stands out, for example in italics or in colour.',
}

// The days of the week in the order the opening hours list them.
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// ── the whole restaurant: who, where, when ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'Your name, address, opening hours, the look and the colours.', cs: 'Název, adresa, otevírací doba, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'tagline', 'look', 'colors'] },
      { label: { en: 'Address and contact', cs: 'Adresa a kontakt' }, fields: ['street', 'postalCode', 'city', 'addressNote', 'phone', 'email', 'mapUrl'] },
      { label: { en: 'Opening hours', cs: 'Otevírací doba' }, fields: ['openingHours', 'hoursNote'] },
      { label: { en: 'Footer', cs: 'Zápatí' }, fields: ['operator', 'companyId', 'instagram', 'facebook', 'allergenLegend'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Name of the restaurant', cs: 'Název podniku' })
      .help({ en: 'It stands in the header and the footer of every page.', cs: 'Stojí v záhlaví a v zápatí každé stránky.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the name written in type.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo názvu napsaného písmem.' }),
    tagline: f.text().optional().label({ en: 'What it is, in a few words', cs: 'Co to je, pár slovy' })
      .help({ en: 'For example “bistro & café”. It stands under or beside the name. Dining Room writes it in small capitals; Plate and Receipt add the town after it.', cs: 'Například „bistro & kavárna“. Stojí pod názvem nebo vedle něj. Salon ho napíše malými kapitálkami; Talíř a Paragon za něj připojí město.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    street: f.text().optional().label({ en: 'Street and number', cs: 'Ulice a číslo' }),
    postalCode: f.text().optional().label({ en: 'Postcode', cs: 'PSČ' }),
    city: f.text().optional().label({ en: 'Town', cs: 'Město' }),
    addressNote: f.text().optional().label({ en: 'A few words under the address', cs: 'Pár slov pod adresou' })
      .help({ en: 'For example “three minutes from the gate”. Dining Room writes it under the address in the footer.', cs: 'Například „tři minuty od brány“. Salon ji napíše pod adresu v zápatí.' }),
    phone: f.text().optional().label({ en: 'Phone for reservations', cs: 'Telefon na rezervace' })
      .help({ en: 'Written as you type it, for example “731 204 586”. A tap on it calls.', cs: 'Napíše se tak, jak ho zadáte, například „731 204 586“. Klepnutí zavolá.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    mapUrl: f.text({ format: 'url' }).optional().label({ en: 'Link to a map', cs: 'Odkaz do mapy' }),
    openingHours: f.list({
      fields: {
        day: f.select({
          options: DAYS, default: 'mon',
          labels: {
            mon: { en: 'Monday', cs: 'Pondělí' }, tue: { en: 'Tuesday', cs: 'Úterý' }, wed: { en: 'Wednesday', cs: 'Středa' }, thu: { en: 'Thursday', cs: 'Čtvrtek' },
            fri: { en: 'Friday', cs: 'Pátek' }, sat: { en: 'Saturday', cs: 'Sobota' }, sun: { en: 'Sunday', cs: 'Neděle' },
          },
        }).label({ en: 'Day', cs: 'Den' }),
        from: f.text().label({ en: 'Opens', cs: 'Otevíráme' }).help({ en: 'Hours and minutes, for example “11:00”.', cs: 'Hodiny a minuty, například „11:00“.' }),
        to: f.text().label({ en: 'Closes', cs: 'Zavíráme' }).help({ en: 'For example “22:00”. After midnight is written “24:00” or “25:00”.', cs: 'Například „22:00“. Po půlnoci napište „24:00“ nebo „25:00“.' }),
        closed: f.boolean().label({ en: 'Closed all day', cs: 'Zavřeno celý den' }),
      },
      max: 14, itemLabel: { en: 'Day', cs: 'Den' },
    }).label({ en: 'Opening hours', cs: 'Otevírací doba' })
      .help({ en: 'One line per day, Monday first. The website lists them, marks today and says whether you are open now. A day left out counts as closed.', cs: 'Jeden řádek na každý den, pondělí první. Web je vypíše, označí dnešek a řekne, zda je právě otevřeno. Den, který chybí, se bere jako zavřeno.' }),
    hoursNote: f.text({ multiline: true }).optional().label({ en: 'Note to the opening hours', cs: 'Poznámka k otevírací době' })
      .help({ en: 'For example when the kitchen stops cooking.', cs: 'Například do kdy vaří kuchyně.' }),
    operator: f.text().optional().label({ en: 'Company name', cs: 'Provozovatel' })
      .help({ en: 'The company that runs the place, for the line at the bottom of the footer.', cs: 'Firma, která podnik provozuje, do dolního řádku zápatí.' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    instagram: f.text({ format: 'url' }).optional().label({ en: 'Instagram', cs: 'Instagram' })
      .help({ en: 'The address of your profile. It also gives the gallery its “more photos” link.', cs: 'Adresa vašeho profilu. Zároveň z něj vede odkaz „další fotky“ pod galerií.' }),
    facebook: f.text({ format: 'url' }).optional().label({ en: 'Facebook', cs: 'Facebook' }),
    allergenLegend: f.text({ multiline: true }).optional().label({ en: 'Allergens legend', cs: 'Legenda alergenů' })
      .help({ en: 'The numbers you use in the menu and what they mean, for example “1 gluten · 3 egg · 7 milk”. It is printed under the menu.', cs: 'Čísla, která používáte v jídelním lístku, a co znamenají, například „1 lepek · 3 vejce · 7 mléko“. Vytiskne se pod lístkem.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the parts of the menu: starters, mains, desserts, drinks ──
export const MenuCategory = defineEntity('menuCategory', {
  label: { en: 'Menu sections', cs: 'Části lístku' },
  labelSingular: { en: 'Menu section', cs: 'Část lístku' },
  description: { en: 'The headings of the menu: starters, mains, desserts, drinks. Drag to put them in order.', cs: 'Nadpisy jídelního lístku: předkrmy, hlavní jídla, dezerty, nápoje. Pořadí změníte přetažením.' },
  icon: 'i-lucide-list',
  titleField: 'name',
  admin: { list: { columns: ['name', 'opensFirst'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    slug: f.slug({ from: 'name', unique: true }).label({ en: 'Address on the page', cs: 'Adresa na stránce' })
      .help({ en: 'The part of the address after the # that leads to this section of the menu.', cs: 'Část adresy za křížkem, která vede k této části lístku.' }),
    opensFirst: f.boolean().label({ en: 'Open this one first', cs: 'Otevřít jako první' })
      .help({ en: 'Plate and Receipt show one section at a time; this is the one they show first. Dining Room shows all of them.', cs: 'Talíř a Paragon ukazují jednu část po druhé; tuto ukážou jako první. Salon ukazuje všechny najednou.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the menu: every dish ──
export const Dish = defineEntity('dish', {
  label: { en: 'Menu', cs: 'Jídelní lístek' },
  labelSingular: { en: 'Dish', cs: 'Jídlo' },
  description: { en: 'The dishes and drinks that are always on the menu. Drag to put them in order.', cs: 'Jídla a nápoje, které máte v lístku pořád. Pořadí změníte přetažením.' },
  icon: 'i-lucide-utensils-crossed',
  titleField: 'name',
  admin: { list: { columns: ['name', 'category', 'price', 'vegetarian', 'hidden'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    description: f.text().optional().label({ en: 'What is in it', cs: 'Co v něm je' }).help({ en: 'One line, for example “beef, bread dumpling, cranberries”.', cs: 'Jeden řádek, například „hovězí zadní, houskový knedlík, brusinky“.' }),
    category: f.relation({ to: () => MenuCategory, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Section', cs: 'Část lístku' }),
    price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    amount: f.text().optional().label({ en: 'Weight or volume', cs: 'Váha nebo objem' }).help({ en: 'As you want it written: “150 g”, “0,3 l”, “1 pc”.', cs: 'Tak, jak to chcete napsat: „150 g“, „0,3 l“, „1 ks“.' }),
    allergens: f.text().optional().label({ en: 'Allergens', cs: 'Alergeny' }).help({ en: 'The numbers, separated by commas: “1, 3, 7”.', cs: 'Čísla oddělená čárkami: „1, 3, 7“.' }),
    vegetarian: f.boolean().label({ en: 'Meatless', cs: 'Bezmasé' }).help({ en: 'Marks the dish with a “V”.', cs: 'Jídlo se označí písmenem „V“.' }),
    hidden: f.boolean().label({ en: 'Hidden', cs: 'Skryté' }).help({ en: 'Turn it on for a seasonal dish that is not cooked now. It stays here and comes back when you turn it off.', cs: 'Zapněte u sezónního jídla, které se teď nevaří. Zůstane tady a vrátí se, až ho vypnete.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  // (the website lists the dishes that are not hidden)
  content: { public: true, populate: ['category'] },
})

// ── the lunch menu: one entry per day ──
export const DailyMenu = defineEntity('dailyMenu', {
  label: { en: 'Daily menu', cs: 'Denní menu' },
  labelSingular: { en: 'Day’s menu', cs: 'Menu na den' },
  description: { en: 'The lunch of each day: a soup and the main courses. The website shows the menu of today; before the day it has none, the next one that comes.', cs: 'Oběd na každý den: polévka a hlavní jídla. Web ukáže menu na dnešek; když na dnešek žádné není, nejbližší další.' },
  icon: 'i-lucide-soup',
  titleField: 'soupName',
  admin: { list: { columns: ['date', 'soupName'] } },
  fields: {
    date: f.datetime({ allDay: true }).label({ en: 'Day', cs: 'Den' }),
    soupName: f.text().optional().label({ en: 'Soup', cs: 'Polévka' }),
    soupAmount: f.text().optional().label({ en: 'Soup: volume', cs: 'Polévka: objem' }).help({ en: 'For example “0,3 l”.', cs: 'Například „0,3 l“.' }),
    soupPrice: f.number({ int: true, min: 0 }).optional().label({ en: 'Soup: price in Kč', cs: 'Polévka: cena v Kč' }),
    soupAllergens: f.text().optional().label({ en: 'Soup: allergens', cs: 'Polévka: alergeny' }).help({ en: 'The numbers, separated by commas.', cs: 'Čísla oddělená čárkami.' }),
    mains: f.list({
      fields: {
        name: f.text({ required: true }).label({ en: 'Dish', cs: 'Jídlo' }),
        weight: f.text().label({ en: 'Weight', cs: 'Váha' }).help({ en: 'For example “150 g”.', cs: 'Například „150 g“.' }),
        price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
        allergens: f.text().label({ en: 'Allergens', cs: 'Alergeny' }).help({ en: 'The numbers, separated by commas.', cs: 'Čísla oddělená čárkami.' }),
        vegetarian: f.boolean().label({ en: 'Meatless', cs: 'Bezmasé' }),
      },
      max: 8, itemLabel: { en: 'Main course', cs: 'Hlavní jídlo' },
    }).label({ en: 'Main courses', cs: 'Hlavní jídla' })
      .help({ en: 'In the order they are numbered on the website.', cs: 'V pořadí, v jakém se na webu číslují.' }),
  },
  content: { public: true },
})

// ── events ──
export const Event = defineEntity('event', {
  label: { en: 'Events', cs: 'Akce' },
  labelSingular: { en: 'Event', cs: 'Akce' },
  description: { en: 'Game dinners, brunches, New Year’s Eve. The website shows the ones that have not ended yet, the soonest first.', cs: 'Zvěřinové hody, brunch, silvestr. Web ukáže akce, které ještě neskončily, nejbližší první.' },
  icon: 'i-lucide-calendar-days',
  titleField: 'title',
  admin: { list: { columns: ['title', 'dateFrom', 'dateTo', 'timeNote'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    dateFrom: f.datetime({ allDay: true }).label({ en: 'Date', cs: 'Datum' }),
    dateTo: f.datetime({ allDay: true }).optional().label({ en: 'Last day', cs: 'Poslední den' }).help({ en: 'Only for an event that lasts more days.', cs: 'Jen u akce, která trvá více dní.' }),
    timeNote: f.text().optional().label({ en: 'When, in words', cs: 'Kdy, slovy' }).help({ en: 'For example “Sunday 10–14 h” or “Friday to Sunday”. It stands under the date.', cs: 'Například „neděle 10–14 h“ nebo „pátek až neděle“. Stojí pod datem.' }),
    text: f.text({ multiline: true }).optional().label({ en: 'Text', cs: 'Text' }),
  },
  content: { public: true },
})

// ── where the ingredients come from ──
export const Supplier = defineEntity('supplier', {
  label: { en: 'Suppliers', cs: 'Dodavatelé' },
  labelSingular: { en: 'Supplier', cs: 'Dodavatel' },
  description: { en: 'What you cook with and who brings it, with the distance. Drag to put them in order.', cs: 'Z čeho vaříte a kdo to vozí, se vzdáleností. Pořadí změníte přetažením.' },
  icon: 'i-lucide-truck',
  titleField: 'name',
  admin: { list: { columns: ['name', 'supplier', 'distance'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Ingredient', cs: 'Surovina' }).help({ en: 'For example “Beef and pork”.', cs: 'Například „Hovězí a vepřové“.' }),
    supplier: f.text().optional().label({ en: 'Supplier and place', cs: 'Dodavatel a místo' }).help({ en: 'For example “butcher in Sobotka”.', cs: 'Například „řeznictví v Sobotce“.' }),
    distance: f.number({ int: true, min: 0 }).optional().label({ en: 'Distance in km', cs: 'Vzdálenost v km' }),
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
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })
const caption = (help?: { en: string; cs: string }) => {
  const field = f.text().label({ en: 'Caption', cs: 'Popisek' })
  return help ? field.help(help) : field
}
const PAPER_CAPTION = {
  en: 'Receipt prints it under the photograph, numbered like a figure in a report. The other looks do not show it.',
  cs: 'Paragon ho vytiskne pod fotografii a očísluje jako obrázek ve zprávě. Ostatní vzhledy ho nezobrazí.',
}

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The first screen: a headline, a photo of the room and a few words, with the opening hours, the address and the phone from Site settings.', cs: 'První obrazovka: nadpis, fotografie lokálu a pár slov, s otevírací dobou, adresou a telefonem z Nastavení webu.' },
  icon: 'i-lucide-door-open',
  fields: {
    eyebrow: eyebrow().help({ en: 'Dining Room writes it above the heading, Receipt too. Plate leaves it out.', cs: 'Salon ho napíše nad nadpis, Paragon také. Talíř ho vynechá.' }),
    heading: heading().help({ en: 'The headline. Text between *asterisks* stands in italics in Dining Room. Plate sets it as wide as the page, so a short one (“Come hungry.”) suits it best.', cs: 'Hlavní nadpis. Text mezi *hvězdičkami* je v Salonu kurzivou. Talíř ho vysází přes celou šířku stránky, hodí se mu proto krátký („Přijďte hladoví.“).' }),
    text: text(),
    image: photo('Photo of the room', 'Fotografie lokálu').help({ en: 'A wide one. Dining Room frames it, Plate lays it across the page, Receipt sets it as a print.', cs: 'Nejlépe na šířku. Salon ji zarámuje, Talíř ji položí přes celou šířku, Paragon ji vloží jako výtisk.' }),
    imageCaption: caption(PAPER_CAPTION),
    plateImage: photo('Photo of a dish from above', 'Fotografie jídla shora')
      .help({ en: 'Plate cuts it into a round plate next to the headline. The other looks do not show it.', cs: 'Talíř ji ořízne do kulatého talíře u nadpisu. Ostatní vzhledy ji nezobrazí.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Second link text', cs: 'Text druhého odkazu' }),
    secondaryUrl: link('Second link destination', 'Cíl druhého odkazu'),
    openNote: f.text().label({ en: 'Under “Open”', cs: 'Pod „Otevřeno“' }).help({ en: 'The line under today’s hours, for example “The kitchen cooks until 21:00.”', cs: 'Řádek pod dnešní otevírací dobou, například „Kuchyně vaří do 21:00.“' }),
    openLinkLabel: f.text().label({ en: 'Link after it', cs: 'Odkaz za ním' }).help({ en: 'Leads to the opening hours, for example “The whole week”.', cs: 'Vede k otevírací době, například „Celý týden“.' }),
    whereNote: f.text().label({ en: 'Under the address', cs: 'Pod adresou' }).help({ en: 'For example “Three minutes from the gate.”', cs: 'Například „Tři minuty od brány.“' }),
    whereLinkLabel: f.text().label({ en: 'Link after it', cs: 'Odkaz za ním' }).help({ en: 'Leads to the way to you, for example “How to get here”.', cs: 'Vede k popisu cesty, například „Jak k nám“.' }),
    bookNote: f.text().label({ en: 'Under the phone', cs: 'Pod telefonem' }).help({ en: 'For example “Daily from 10, or”.', cs: 'Například „Denně od 10 hodin, nebo“.' }),
    bookLinkLabel: f.text().label({ en: 'Link after it', cs: 'Odkaz za ním' }).help({ en: 'Leads to the reservation form, for example “by the form”.', cs: 'Vede k rezervačnímu formuláři, například „formulářem“.' }),
  },
})

const lunch = defineBlock({
  label: { en: 'Lunch today', cs: 'Dnešní oběd' },
  description: { en: 'The soup and main courses of today from the Daily menu section.', cs: 'Polévka a hlavní jídla na dnešek ze sekce Denní menu.' },
  icon: 'i-lucide-soup',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'When lunch is served and what goes with it. Dining Room and Plate show it beside the menu.', cs: 'Kdy se obědvá a co k němu patří. Salon a Talíř ho ukážou vedle menu.' }),
    served: f.text().label({ en: 'Lunch hours', cs: 'Čas oběda' }).help({ en: 'For example “11:00–14:30”. Plate shows it under the date, Receipt above the heading.', cs: 'Například „11:00–14:30“. Talíř ho ukáže pod datem, Paragon nad nadpisem.' }),
    image: photo('Photo of the soup or a dish', 'Fotografie polévky nebo jídla').help({ en: 'A square one from above. Plate cuts it into a plate.', cs: 'Čtvercová, shora. Talíř ji ořízne do kulatého talíře.' }),
    imageCaption: caption(PAPER_CAPTION),
    sideText: f.text({ multiline: true }).label({ en: 'Note under the photo', cs: 'Poznámka pod fotografií' })
      .help({ en: 'Only Receipt shows it.', cs: 'Zobrazí ji jen Paragon.' }),
    listNote: f.text().label({ en: 'Line under the list', cs: 'Řádek pod seznamem' }).help({ en: 'For example when the menu is posted each day. Only Plate shows it.', cs: 'Například kdy menu každý den vyvěšujete. Zobrazí ho jen Talíř.' }),
    weekLabel: f.text().label({ en: 'Link to the whole week', cs: 'Odkaz na celý týden' }).help({ en: 'For example “Menu for the whole week (PDF)”. Shown only when you also upload the file.', cs: 'Například „Menu na celý týden (PDF)“. Zobrazí se, jen když nahrajete i soubor.' }),
    weekFile: f.media({ accept: 'application/pdf' }).label({ en: 'The whole week as a file', cs: 'Celý týden jako soubor' }),
  },
})

const menu = defineBlock({
  label: { en: 'Menu', cs: 'Jídelní lístek' },
  description: { en: 'The dishes of the Menu section, by sections. Dining Room shows them all on one card, Plate and Receipt in tabs.', cs: 'Jídla ze sekce Jídelní lístek podle částí. Salon je ukáže všechna na jedné kartě, Talíř a Paragon v záložkách.' },
  icon: 'i-lucide-utensils-crossed',
  fields: {
    heading: heading(),
    text: text().help({ en: 'A sentence above the menu. Plate and Receipt show it; Dining Room does not.', cs: 'Věta nad lístkem. Talíř a Paragon ji ukážou, Salon ne.' }),
    validFrom: f.datetime({ allDay: true }).optional().label({ en: 'The menu is valid from', cs: 'Lístek platí od' })
      .help({ en: 'Written as “Valid from 1 November 2026”. Leave it empty to leave the line out.', cs: 'Napíše se „Platí od 1. listopadu 2026“. Když pole necháte prázdné, řádek se vynechá.' }),
    plateImage: photo('Photo of a dish from above', 'Fotografie jídla shora')
      .help({ en: 'Plate cuts it into a plate that stays in view beside the table. The other looks do not show it.', cs: 'Talíř ji ořízne do talíře, který zůstane na očích vedle tabulky. Ostatní vzhledy ji nezobrazí.' }),
    featureImage: photo('Photo of a dish', 'Fotografie jídla').help({ en: 'Dining Room shows it large under the menu card, with the words beside it.', cs: 'Salon ji ukáže velkou pod kartou s lístkem a vedle ní slova níže.' }),
    featureLabel: f.text().label({ en: 'Line above its text', cs: 'Řádek nad jejím textem' }),
    featureTitle: f.text().label({ en: 'A sentence about the dish', cs: 'Věta o jídle' }),
    featureText: f.text({ multiline: true }).label({ en: 'More about the dish', cs: 'Více o jídle' }),
  },
})

const kitchen = defineBlock({
  label: { en: 'Kitchen', cs: 'Kuchyně' },
  description: { en: 'Who cooks and what from: a photo of the cook, a few words and the suppliers from the Suppliers section.', cs: 'Kdo vaří a z čeho: fotografie kuchaře, pár slov a dodavatelé ze sekce Dodavatelé.' },
  icon: 'i-lucide-chef-hat',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'Two paragraphs, divided by an empty line.', cs: 'Dva odstavce oddělené prázdným řádkem.' }),
    signature: f.text().label({ en: 'Signature', cs: 'Podpis' }).help({ en: 'Only Dining Room shows it, in italics under the text.', cs: 'Zobrazí ho jen Salon, kurzívou pod textem.' }),
    image: photo('Photo of the cook', 'Fotografie kuchaře').help({ en: 'A portrait.', cs: 'Nejlépe na výšku.' }),
    imageCaption: caption(PAPER_CAPTION),
    suppliersHeading: f.text().label({ en: 'Heading of the suppliers', cs: 'Nadpis dodavatelů' }).help({ en: 'Dining Room and Receipt (as a delivery note) show it; Plate does not.', cs: 'Salon a Paragon (jako dodací list) ho ukážou, Talíř ne.' }),
    deliveryNote: f.text().label({ en: 'Note under the suppliers', cs: 'Poznámka pod dodavateli' }).help({ en: 'For example “Deliveries on Tuesday and Friday.” Only Receipt shows it.', cs: 'Například „Závoz v úterý a v pátek.“ Zobrazí ji jen Paragon.' }),
    secondImage: photo('Second photo', 'Druhá fotografie').help({ en: 'A delivery or the market, beside the suppliers.', cs: 'Třeba závoz surovin, vedle dodavatelů.' }),
    secondCaption: caption(PAPER_CAPTION),
  },
})

const gallery = defineBlock({
  label: { en: 'Photographs', cs: 'Galerie' },
  description: { en: 'Photos of the room, the bar and the food. Dining Room and Plate show six, Receipt nine.', cs: 'Fotografie lokálu, výčepu a jídla. Salon a Talíř jich ukážou šest, Paragon devět.' },
  icon: 'i-lucide-images',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    linkLabel: f.text().label({ en: 'Link to Instagram', cs: 'Odkaz na Instagram' }).help({ en: 'For example “More photos on Instagram”. It leads to the Instagram address in Site settings.', cs: 'Například „Další fotky na Instagramu“. Vede na adresu Instagramu z Nastavení webu.' }),
    photos: f.list({
      fields: {
        image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }),
        caption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
        overhead: f.boolean().label({ en: 'Photographed from above', cs: 'Fotografováno shora' }).help({ en: 'Plate cuts such a photo into a round plate.', cs: 'Talíř takovou fotografii ořízne do kulatého talíře.' }),
      },
      max: 12, itemLabel: { en: 'Photograph', cs: 'Fotografie' },
    }).label({ en: 'Photographs', cs: 'Fotografie' })
      .help({ en: 'Drag to change the order. Dining Room takes the first six, Plate the first three and the 7th to 9th, Receipt up to nine. Put the best photo first.', cs: 'Pořadí změníte přetažením. Salon vezme prvních šest, Talíř první tři a sedmou až devátou, Paragon až devět. Nejlepší fotografii dejte první.' }),
  },
})

const events = defineBlock({
  label: { en: 'Events', cs: 'Akce' },
  description: { en: 'The next events from the Events section.', cs: 'Nejbližší akce ze sekce Akce.' },
  icon: 'i-lucide-calendar-days',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    limit: f.number({ int: true, min: 1, max: 12 }).optional().label({ en: 'How many to show', cs: 'Kolik akcí ukázat' })
      .help({ en: 'Three fit the layouts best. Empty: three.', cs: 'Nejlépe se do vzhledů hodí tři. Prázdné: tři.' }),
  },
})

const hours = defineBlock({
  label: { en: 'Opening hours and place', cs: 'Otevírací doba a místo' },
  description: { en: 'The opening hours from Site settings, the address, a photo of the house, a little drawn plan and the ways to get there.', cs: 'Otevírací doba z Nastavení webu, adresa, fotografie domu, malý nakreslený plánek a jak se k vám dostat.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow().help({ en: 'Dining Room and Receipt show it above the heading.', cs: 'Salon a Paragon ho ukážou nad nadpisem.' }),
    heading: heading().help({ en: 'Written above the opening hours. Plate writes the place under the next field’s heading.', cs: 'Napíše se nad otevírací dobu. Talíř místo píše pod nadpisem z dalšího pole.' }),
    placeLabel: f.text().label({ en: 'Heading of the place', cs: 'Nadpis místa' }).help({ en: 'For example “Where to find us”.', cs: 'Například „Kde nás najdete“.' }),
    image: photo('Photo of the house', 'Fotografie domu'),
    imageCaption: caption(PAPER_CAPTION),
    ways: f.list({
      fields: {
        kind: f.select({
          options: ['walk', 'car', 'bus', 'bike', 'other'] as const, default: 'walk',
          labels: { walk: { en: 'On foot', cs: 'Pěšky' }, car: { en: 'By car', cs: 'Autem' }, bus: { en: 'By bus or train', cs: 'Autobusem, vlakem' }, bike: { en: 'By bike', cs: 'Na kole' }, other: { en: 'Other', cs: 'Jinak' } },
        }).label({ en: 'Kind', cs: 'Druh' }).help({ en: 'Chooses the icon. Dining Room shows it.', cs: 'Určuje ikonu. Zobrazí ji Salon.' }),
        label: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }).help({ en: 'For example “By car”.', cs: 'Například „Autem“.' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 5, itemLabel: { en: 'Way', cs: 'Cesta' },
    }).label({ en: 'Getting there', cs: 'Jak se k nám dostat' }),
    planFrom: f.text().label({ en: 'Plan: where you come from', cs: 'Plánek: odkud jdete' })
      .help({ en: 'The little plan is drawn by the look: where you set out, a gate, a square, your street and your door. Leave this empty to leave the plan out.', cs: 'Plánek nakreslí vzhled: odkud vyrazíte, brána, náměstí, vaše ulice a vaše dveře. Když pole necháte prázdné, plánek se vynechá.' }),
    planGate: f.text().label({ en: 'Plan: the gate or landmark', cs: 'Plánek: brána nebo orientační bod' }),
    planSquare: f.text().label({ en: 'Plan: the square with parking', cs: 'Plánek: náměstí s parkováním' }),
    planStreet: f.text().label({ en: 'Plan: your street', cs: 'Plánek: vaše ulice' }),
    planBus: f.text().label({ en: 'Plan: the bus', cs: 'Plánek: autobus' }).help({ en: 'For example “buses 6 min”. Dining Room leaves out what follows the first number.', cs: 'Například „autobusy 6 min“. Salon vynechá vše od prvního čísla.' }),
    planTrain: f.text().label({ en: 'Plan: the train', cs: 'Plánek: vlak' }).help({ en: 'For example “train 12 min”. Dining Room leaves it out.', cs: 'Například „vlak 12 min“. Salon ho vynechá.' }),
  },
})

const reservation = defineBlock({
  label: { en: 'Table reservation', cs: 'Rezervace stolu' },
  description: { en: 'The form to book a table, with the phone from Site settings. The reservations arrive in the admin.', cs: 'Formulář pro rezervaci stolu s telefonem z Nastavení webu. Rezervace najdete v administraci.' },
  icon: 'i-lucide-calendar-check',
  fields: {
    eyebrow: eyebrow().help({ en: 'Dining Room shows it above the heading.', cs: 'Salon ho ukáže nad nadpisem.' }),
    heading: heading(),
    text: text(),
    phoneLabel: f.text().label({ en: 'Line above the phone', cs: 'Řádek nad telefonem' }).help({ en: 'For example “Phone, daily from 10”.', cs: 'Například „Telefon, denně od 10 hodin“.' }),
    note: f.text({ multiline: true }).label({ en: 'Note beside the form', cs: 'Poznámka vedle formuláře' }).help({ en: 'For example how long you hold the table and what to do about large groups.', cs: 'Například jak dlouho stůl držíte a co dělat se skupinou.' }),
    formNote: f.text().label({ en: 'Note under the button', cs: 'Poznámka pod tlačítkem' }).help({ en: 'Dining Room shows it.', cs: 'Zobrazí ji Salon.' }),
    times: f.list({
      fields: { time: f.text({ required: true }).label({ en: 'Time', cs: 'Čas' }).help({ en: 'For example “18:30”.', cs: 'Například „18:30“.' }) },
      max: 40, itemLabel: { en: 'Time', cs: 'Čas' },
    }).label({ en: 'Times to choose from', cs: 'Časy na výběr' })
      .help({ en: 'The times a guest can book. Leave the list empty and the form lets the guest type a time.', cs: 'Časy, na které si host může zamluvit stůl. Když seznam necháte prázdný, host čas napíše.' }),
    defaultTime: f.text().label({ en: 'Time chosen at first', cs: 'Čas předvybraný' }).help({ en: 'One of the times above.', cs: 'Jeden z časů výše.' }),
    maxGuests: f.number({ int: true, min: 1, max: 30 }).optional().label({ en: 'Largest group', cs: 'Největší skupina' })
      .help({ en: 'The form offers 1 to this many guests; larger groups phone. Empty: 8.', cs: 'Formulář nabídne 1 až tolik hostů; větší skupiny volají. Prázdné: 8.' }),
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
  blocks: { opening, lunch, menu, kitchen, gallery, events, hours, reservation, text: richText },
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
  formsPlugin(), // the reservations of the form below
]

// ── the reservation form ──
// The website draws it per look (the kit's useSiteForm). The times and the largest group are the
// owner's own, listed in the "Table reservation" block, so they are plain text here.
export const Reservation = defineForm('reservation', {
  label: { en: 'Reservations', cs: 'Rezervace' },
  labelSingular: { en: 'Reservation', cs: 'Rezervace' },
  fields: {
    date: f.text({ required: true, max: 40 }).label({ en: 'Date', cs: 'Datum' }),
    time: f.text({ required: true, max: 20 }).label({ en: 'Time', cs: 'Čas' }),
    guests: f.text({ required: true, max: 20 }).label({ en: 'Number of guests', cs: 'Počet osob' }),
    name: f.text({ required: true, max: 200 }).label({ en: 'Name', cs: 'Jméno' }).help({ en: 'the name to put on the table', cs: 'na koho stůl napíšeme' }),
    phone: f.text({ required: true, max: 40 }).label({ en: 'Phone', cs: 'Telefon' }).help({ en: 'where to send the confirmation', cs: 'kam pošleme potvrzení' }),
    note: f.text({ multiline: true, max: 2000 }).optional().label({ en: 'Note', cs: 'Poznámka' })
      .help({ en: 'a high chair, a celebration, allergies, a table by the window…', cs: 'dětská židlička, oslava, alergie, stůl u okna…' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send reservation', cs: 'Odeslat rezervaci' },
  successMessage: { en: 'Thank you, we have your reservation. We confirm it by text message, usually within two hours.', cs: 'Děkujeme, rezervaci máme. Potvrdíme ji SMS, obvykle do dvou hodin.' },
})
export const FormSettings = defineFormSettings()
