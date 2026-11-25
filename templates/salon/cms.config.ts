import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Salon template: what the salon can write and change. One model for
// all three looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

// ── the whole site: who, where, when ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The salon’s name, contact, opening hours, the look and the colours.', cs: 'Název salonu, kontakt, otevírací doba, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors', 'tagline'] },
      { label: { en: 'Contact', cs: 'Kontakt' }, fields: ['phone', 'email', 'address', 'town', 'mapUrl', 'instagram', 'facebook'] },
      { label: { en: 'Opening hours', cs: 'Otevírací doba' }, fields: ['hours', 'hoursNote', 'hoursShort'] },
      { label: { en: 'Footer', cs: 'Zápatí' }, fields: ['about', 'founded', 'legal'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Salon name', cs: 'Název salonu' })
      .help({ en: 'Written in the header and the footer, for example “Pěšinka”. Shop Window sets it in capitals, Chessboard in lowercase.', cs: 'Píše se v záhlaví a v zápatí, například „Pěšinka“. Výloha ho vysází velkými písmeny, Šachovnice malými.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Logo', cs: 'Logo' })
      .help({ en: 'Upload your own logo to show it in the header in place of the name.', cs: 'Nahrajte vlastní logo a v záhlaví se zobrazí místo názvu.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes.', cs: 'Každý vzhled má tři barevné palety.' }),
    tagline: f.text().optional().label({ en: 'Line under the name', cs: 'Řádek pod názvem' })
      .help({ en: 'What the salon is, in a few words, for example “Hairdresser and barber · Jičín”. Mirror writes it beside the name, Shop Window under it and again in the footer; Chessboard does not use it.', cs: 'Čím salon je, pár slovy, například „Kadeřnictví a holičství · Jičín“. Zrcadlo ho píše vedle názvu, Výloha pod něj a znovu v zápatí, Šachovnice ho nepoužívá.' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' })
      .help({ en: 'Shown in the header, beside the booking form and in the footer. Write it as you want it read.', cs: 'Zobrazí se v záhlaví, u objednávky a v zápatí. Napište ho tak, jak se má číst.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail', cs: 'E-mail' }),
    address: f.text().optional().label({ en: 'Street and number', cs: 'Ulice a číslo' })
      .help({ en: 'For example “Šípková 59”. Shop Window sets the number large on a house plate.', cs: 'Například „Šípková 59“. Výloha číslo vysází velké na domovní cedulce.' }),
    town: f.text().optional().label({ en: 'Postcode and town', cs: 'PSČ a město' }).help({ en: 'For example “506 01 Jičín”.', cs: 'Například „506 01 Jičín“.' }),
    mapUrl: f.text({ format: 'url' }).optional().label({ en: 'Link to a map', cs: 'Odkaz do mapy' }),
    instagram: f.text({ format: 'url' }).optional().label({ en: 'Instagram', cs: 'Instagram' }).help({ en: 'The address of your profile.', cs: 'Adresa vašeho profilu.' }),
    facebook: f.text({ format: 'url' }).optional().label({ en: 'Facebook', cs: 'Facebook' }).help({ en: 'The address of your page.', cs: 'Adresa vaší stránky.' }),
    hours: f.list({
      fields: {
        day: f.select({
          options: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const, default: 'mon',
          labels: {
            mon: { en: 'Monday', cs: 'Pondělí' }, tue: { en: 'Tuesday', cs: 'Úterý' }, wed: { en: 'Wednesday', cs: 'Středa' }, thu: { en: 'Thursday', cs: 'Čtvrtek' },
            fri: { en: 'Friday', cs: 'Pátek' }, sat: { en: 'Saturday', cs: 'Sobota' }, sun: { en: 'Sunday', cs: 'Neděle' },
          },
        }).label({ en: 'Day', cs: 'Den' }),
        from: f.text({ max: 5 }).label({ en: 'Opens', cs: 'Otevírá' }).help({ en: 'For example “9” or “8.30”. Leave opens and closes empty for a day you are closed.', cs: 'Například „9“ nebo „8.30“. U dne, kdy máte zavřeno, nechte otevírá i zavírá prázdné.' }),
        to: f.text({ max: 5 }).label({ en: 'Closes', cs: 'Zavírá' }).help({ en: 'For example “18”.', cs: 'Například „18“.' }),
      },
      max: 7, itemLabel: { en: 'Day', cs: 'Den' },
    }).label({ en: 'Opening hours', cs: 'Otevírací doba' })
      .help({ en: 'One line for each day, Monday first. The website marks today, says whether you are open, and the booking form offers only days you are open (and the chosen person works). Mirror draws the hours as bars between 7 and 20, Chessboard as a tile a day.', cs: 'Jeden řádek pro každý den, pondělí první. Web označí dnešek, napíše, zda máte otevřeno, a objednávka nabídne jen dny, kdy otevřeno máte (a vybraná osoba pracuje). Zrcadlo hodiny nakreslí jako pruhy mezi 7. a 20. hodinou, Šachovnice jako dlaždici na den.' }),
    hoursNote: f.text({ multiline: true }).optional().label({ en: 'Note under the hours', cs: 'Poznámka pod otevírací dobou' })
      .help({ en: 'For example when the last customers are taken.', cs: 'Například kdy berete poslední zákazníky.' }),
    hoursShort: f.text().optional().label({ en: 'Hours in one line', cs: 'Otevírací doba na jeden řádek' })
      .help({ en: 'For example “Mon–Fri 8 or 9 h, Sat 8–12 h”. Shop Window writes it in the footer, under the address.', cs: 'Například „po–pá od 8 nebo 9 h, so 8–12 h“. Výloha ji napíše do zápatí pod adresu.' }),
    about: f.text({ multiline: true }).optional().label({ en: 'About the salon', cs: 'O salonu' })
      .help({ en: 'Two sentences for the footer. Mirror and Chessboard write them there.', cs: 'Dvě věty do zápatí. Zrcadlo a Šachovnice je tam napíšou.' }),
    founded: f.number({ int: true, min: 1900, max: 2100 }).optional().label({ en: 'Open since', cs: 'Otevřeno od roku' })
      .help({ en: 'Shop Window writes it in the footer under the name.', cs: 'Výloha ho napíše do zápatí pod název.' }),
    legal: f.text({ multiline: true }).optional().label({ en: 'Operator and company number', cs: 'Provozovatel a IČO' })
      .help({ en: 'The last line of the footer, for example “© 2026 Salon Pěšinka · Radka Vejvodová, IČO 12345678”.', cs: 'Poslední řádek zápatí, například „© 2026 Salon Pěšinka · Radka Vejvodová, IČO 12345678“.' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── groups of the price list: women's cuts, colouring… ──
export const ServiceGroup = defineEntity('serviceGroup', {
  label: { en: 'Service groups', cs: 'Skupiny služeb' },
  labelSingular: { en: 'Service group', cs: 'Skupina služeb' },
  description: { en: 'The headings of the price list. Drag to put them in order.', cs: 'Nadpisy ceníku. Pořadí změníte přetažením.' },
  icon: 'i-lucide-folders',
  titleField: 'name',
  admin: { list: { columns: ['name'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    // The order: editors arrange the list by dragging ("Arrange" in the admin), the website follows.
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── services: a line of the price list ──
export const Service = defineEntity('service', {
  label: { en: 'Services', cs: 'Služby' },
  labelSingular: { en: 'Service', cs: 'Služba' },
  description: { en: 'The price list: what you do, for how long and for how much. Drag to put the services in order; they stay in their groups.', cs: 'Ceník: co děláte, jak dlouho to trvá a kolik to stojí. Pořadí změníte přetažením, služby zůstanou ve svých skupinách.' },
  icon: 'i-lucide-scissors',
  titleField: 'name',
  admin: { list: { columns: ['name', 'group', 'minutes', 'price'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    group: f.relation({ to: () => ServiceGroup, kind: 'many-to-one', required: true, onDelete: 'restrict' }).label({ en: 'Group', cs: 'Skupina' }),
    minutes: f.number({ int: true, min: 5, max: 600 }).label({ en: 'Minutes', cs: 'Délka v minutách' })
      .help({ en: 'Mirror draws it as clock faces (a full circle is an hour), Chessboard as squares (one is a quarter of an hour), Shop Window as plain lettering.', cs: 'Zrcadlo ji nakreslí jako ciferníky (plný kruh je hodina), Šachovnice jako čtverečky (jeden je čtvrt hodiny), Výloha obyčejným písmem.' }),
    price: f.number({ int: true, min: 0 }).label({ en: 'Price in Kč', cs: 'Cena v Kč' }),
    priceFrom: f.boolean().label({ en: 'Price “from”', cs: 'Cena „od“' }).help({ en: 'The price is the lowest one: it grows with the length of the hair, for example.', cs: 'Cena je ta nejnižší: roste třeba s délkou vlasů.' }),
    note: f.text().optional().label({ en: 'Note', cs: 'Poznámka' }).help({ en: 'A few words under the name, for example “by hair length”.', cs: 'Pár slov pod názvem, například „podle délky vlasů“.' }),
    quick: f.boolean().label({ en: 'Among the quick prices', cs: 'Mezi rychlými cenami' })
      .help({ en: 'Mirror shows up to three such services as a strip under the opening. The other looks leave them out.', cs: 'Zrcadlo ukáže až tři takové služby jako pruh pod úvodem. Ostatní vzhledy je vynechají.' }),
    quickLabel: f.text().optional().label({ en: 'Name in the quick prices', cs: 'Název v rychlých cenách' }).help({ en: 'What people call it, for example “Women’s cut with blow-dry”. Empty: the name above.', cs: 'Jak tomu říkají lidé, například „Dámský střih s foukanou“. Prázdné: název výše.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['group'] },
})

// ── the team ──
export const Person = defineEntity('person', {
  label: { en: 'Team', cs: 'Tým' },
  labelSingular: { en: 'Team member', cs: 'Člen týmu' },
  description: { en: 'The people customers can book. Drag to put them in order.', cs: 'Lidé, ke kterým se zákazníci mohou objednat. Pořadí změníte přetažením.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  admin: { list: { columns: ['name', 'role'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photo', cs: 'Fotografie' })
      .help({ en: 'A portrait with some space around the head. Mirror shows it in an oval, Chessboard in a square, Shop Window in a frame.', cs: 'Portrét s trochou místa kolem hlavy. Zrcadlo ji ukáže v oválu, Šachovnice ve čtverci, Výloha v rámečku.' }),
    role: f.text().optional().label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “Owner, hairdresser”.', cs: 'Například „Majitelka, kadeřnice“.' }),
    bio: f.text({ multiline: true }).optional().label({ en: 'What they do best', cs: 'V čem je nejlepší' }).help({ en: 'One or two sentences.', cs: 'Jedna nebo dvě věty.' }),
    bookLabel: f.text().optional().label({ en: 'Booking link text', cs: 'Text odkazu na objednání' })
      .help({ en: 'The link under the person, for example “I want Radka”. Empty: the text of the Team block.', cs: 'Odkaz pod jménem, například „Chci k Radce“. Prázdné: text z bloku Tým.' }),
    mon: f.boolean({ default: true }).label({ en: 'Works on Monday', cs: 'Pracuje v pondělí' })
      .help({ en: 'The six days under the name show when the person works, and the booking form offers only those days once the person is chosen.', cs: 'Šest dnů pod jménem ukazuje, kdy člověk pracuje, a objednávka po výběru osoby nabídne jen tyto dny.' }),
    tue: f.boolean({ default: true }).label({ en: 'Works on Tuesday', cs: 'Pracuje v úterý' }),
    wed: f.boolean({ default: true }).label({ en: 'Works on Wednesday', cs: 'Pracuje ve středu' }),
    thu: f.boolean({ default: true }).label({ en: 'Works on Thursday', cs: 'Pracuje ve čtvrtek' }),
    fri: f.boolean({ default: true }).label({ en: 'Works on Friday', cs: 'Pracuje v pátek' }),
    sat: f.boolean().label({ en: 'Works on Saturday', cs: 'Pracuje v sobotu' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── the work: photographs of results ──
export const Result = defineEntity('result', {
  label: { en: 'Results', cs: 'Proměny' },
  labelSingular: { en: 'Result', cs: 'Proměna' },
  description: { en: 'Photographs of finished work. Drag to put them in order.', cs: 'Fotografie hotové práce. Pořadí změníte přetažením.' },
  icon: 'i-lucide-images',
  titleField: 'title',
  admin: { list: { columns: ['photo', 'title', 'person'], orderField: 'position' } },
  fields: {
    photo: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'Tall (4:5 or 3:4) works best; Chessboard also crops it to a square.', cs: 'Nejlépe na výšku (4:5 nebo 3:4); Šachovnice ji ořízne i do čtverce.' }),
    title: f.text({ required: true }).label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'What it is, for example “Low fade”.', cs: 'Co to je, například „Nízký fade“.' }),
    person: f.relation({ to: () => Person, kind: 'many-to-one', onDelete: 'set null' }).label({ en: 'Who did it', cs: 'Kdo to dělal' })
      .help({ en: 'Their first name is written under the photograph.', cs: 'Křestní jméno se napíše pod fotografii.' }),
    service: f.relation({ to: () => Service, kind: 'many-to-one', onDelete: 'set null' }).label({ en: 'Service', cs: 'Služba' })
      .help({ en: 'Chessboard writes its price and length on the caption tile, and a click on the tile starts booking it.', cs: 'Šachovnice napíše její cenu a délku na dlaždici s popiskem a kliknutí na dlaždici službu rovnou objedná.' }),
    facts: f.text().optional().label({ en: 'Line under the caption', cs: 'Řádek pod popiskem' })
      .help({ en: 'Only Chessboard writes it, on the caption tile. Empty: the price and length of the linked service.', cs: 'Napíše ho jen Šachovnice na dlaždici s popiskem. Prázdné: cena a délka propojené služby.' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo', 'person', 'service'] },
})

// ── what customers said ──
export const Review = defineEntity('review', {
  label: { en: 'Reviews', cs: 'Recenze' },
  labelSingular: { en: 'Review', cs: 'Recenze' },
  icon: 'i-lucide-quote',
  titleField: 'name',
  admin: { list: { columns: ['name', 'about'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }).help({ en: 'Mirror sets the first review large and the next two smaller; the others show three at a time.', cs: 'Zrcadlo první recenzi vysází velkou a další dvě menší, ostatní vzhledy ukážou tři vedle sebe.' }),
    about: f.text().optional().label({ en: 'What it was', cs: 'O co šlo' }).help({ en: 'For example “highlights and toning”.', cs: 'Například „melír a tónování“.' }),
    text: f.text({ required: true, multiline: true, max: 600 }).label({ en: 'Text', cs: 'Text' }),
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

const opening = defineBlock({
  label: { en: 'Opening', cs: 'Úvod' },
  description: { en: 'The first screen: what the salon does, a photograph and two buttons. Mirror adds a strip with the quick prices below it.', cs: 'První obrazovka: co salon dělá, fotografie a dvě tlačítka. Zrcadlo pod ni přidá pruh s rychlými cenami.' },
  icon: 'i-lucide-layout-template',
  fields: {
    eyebrow: eyebrow(),
    heading: heading().help({ en: 'Put the name of the street or town in it; it is what people search for.', cs: 'Napište do něj ulici nebo město, lidé hledají právě to.' }),
    text: text().help({ en: 'Two or three sentences. Mention the cheapest prices.', cs: 'Dvě nebo tři věty. Zmiňte nejnižší ceny.' }),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' })
      .help({ en: 'A wide view of the salon at work. Mirror shows it in an oval mirror, Chessboard beside the heading, Shop Window across the whole window with the heading over it.', cs: 'Široký pohled do salonu při práci. Zrcadlo ji ukáže v oválném zrcadle, Šachovnice vedle nadpisu, Výloha přes celé okno s nadpisem přes ni.' }),
    image2: f.media({ accept: 'image/*' }).label({ en: 'Second, small photograph', cs: 'Druhá, malá fotografie' })
      .help({ en: 'Only Mirror shows it: a round mirror beside the first one. Square works best.', cs: 'Ukáže ji jen Zrcadlo: kulaté zrcadlo vedle první. Nejlépe čtverec.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Second button text', cs: 'Text druhého tlačítka' }),
    secondaryUrl: link('Second button destination', 'Cíl druhého tlačítka'),
    badgeLabel: f.text().label({ en: 'Badge: what', cs: 'Placka: co' }).help({ en: 'Only Mirror: a round badge on the photograph, for example “Cut from”.', cs: 'Jen Zrcadlo: kulatá placka na fotografii, například „Střih od“.' }),
    badgeValue: f.text().label({ en: 'Badge: value', cs: 'Placka: hodnota' }).help({ en: 'For example “350 Kč”.', cs: 'Například „350 Kč“.' }),
    arc: f.text().label({ en: 'Arched line', cs: 'Oblouk nad nadpisem' }).help({ en: 'Only Shop Window: a few words in capitals, painted in an arch over the heading.', cs: 'Jen Výloha: pár slov velkými písmeny, namalovaných v oblouku nad nadpisem.' }),
  },
})

const pricelist = defineBlock({
  label: { en: 'Price list', cs: 'Ceník' },
  description: { en: 'Every service from the Services section, in its group.', cs: 'Všechny služby ze sekce Služby, ve svých skupinách.' },
  icon: 'i-lucide-list',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    footnote: f.text().label({ en: 'Note at the end', cs: 'Poznámka na konci' }).help({ en: 'Only Shop Window writes it, under the two columns.', cs: 'Napíše ji jen Výloha, pod oba sloupce.' }),
  },
})

const team = defineBlock({
  label: { en: 'Team', cs: 'Tým' },
  description: { en: 'The people from the Team section, each with a way to book them.', cs: 'Lidé ze sekce Tým, ke každému s možností objednání.' },
  icon: 'i-lucide-users',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    bookLabel: f.text().label({ en: 'Booking link text', cs: 'Text odkazu na objednání' }).help({ en: 'The link under each person, for example “Book a time”. A person can have a text of their own.', cs: 'Odkaz pod každým člověkem, například „Objednat termín“. Člověk může mít text vlastní.' }),
  },
})

const results = defineBlock({
  label: { en: 'Results', cs: 'Proměny' },
  description: { en: 'The photographs from the Results section: what left your chairs.', cs: 'Fotografie ze sekce Proměny: co odešlo z vašich křesel.' },
  icon: 'i-lucide-images',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'Chessboard and Shop Window do not write it.', cs: 'Šachovnice a Výloha ho nepíšou.' }),
  },
})

const firstVisit = defineBlock({
  label: { en: 'First visit', cs: 'První návštěva' },
  description: { en: 'What a new customer can expect, in a few short steps.', cs: 'Co čeká nového zákazníka, v několika krátkých krocích.' },
  icon: 'i-lucide-door-open',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text().help({ en: 'Only Mirror writes it beside the heading.', cs: 'Vedle nadpisu ho napíše jen Zrcadlo.' }),
    steps: f.list({
      fields: {
        heading: f.text({ required: true }).label({ en: 'Heading', cs: 'Nadpis' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 5, itemLabel: { en: 'Step', cs: 'Krok' },
    }).label({ en: 'Steps', cs: 'Kroky' }).help({ en: 'Three to five. Each look numbers them its own way.', cs: 'Tři až pět. Každý vzhled je očísluje po svém.' }),
  },
})

const reviews = defineBlock({
  label: { en: 'Reviews', cs: 'Recenze' },
  description: { en: 'What customers said, from the Reviews section.', cs: 'Co říkají zákazníci, ze sekce Recenze.' },
  icon: 'i-lucide-quote',
  fields: {
    heading: heading(),
  },
})

const booking = defineBlock({
  label: { en: 'Booking', cs: 'Objednání' },
  description: { en: 'The form to ask for an appointment and your phone number beside it. The requests arrive in the admin.', cs: 'Formulář na žádost o termín a vedle něj telefon. Žádosti najdete v administraci.' },
  icon: 'i-lucide-calendar-check',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    phoneLabel: f.text().label({ en: 'Line above the phone number', cs: 'Řádek nad telefonem' }),
    phoneNote: f.text({ multiline: true }).label({ en: 'Note under the phone number', cs: 'Poznámka pod telefonem' }),
    submitLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }).help({ en: 'Empty: the text of the form (“Send the request”).', cs: 'Prázdné: text formuláře („Odeslat žádost o termín“).' }),
    note: f.text({ multiline: true }).label({ en: 'Note by the button', cs: 'Poznámka u tlačítka' }).help({ en: 'For example when a booking counts and when it can be cancelled.', cs: 'Například kdy termín platí a do kdy ho lze zrušit.' }),
  },
})

const visit = defineBlock({
  label: { en: 'Opening hours and address', cs: 'Otevírací doba a adresa' },
  description: { en: 'The hours and the address from Site settings, a photograph of the house and ways to get there.', cs: 'Otevírací doba a adresa z Nastavení webu, fotografie domu a jak se k vám dostat.' },
  icon: 'i-lucide-map-pin',
  fields: {
    eyebrow: eyebrow().help({ en: 'Mirror and Shop Window write it above the hours.', cs: 'Zrcadlo ho píše nad otevírací dobu.' }),
    heading: heading(),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph of the house', cs: 'Fotografie domu' }).help({ en: 'Landscape, 3:2 works best.', cs: 'Nejlépe na šířku, 3:2.' }),
    ways: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }).help({ en: 'For example “On foot”.', cs: 'Například „Pěšky“.' }),
        text: f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' }),
      },
      max: 4, itemLabel: { en: 'Way', cs: 'Cesta' },
    }).label({ en: 'Getting there', cs: 'Jak se k nám dostat' }).help({ en: 'Three fit best: on foot, by car, with a pram.', cs: 'Nejlépe tři: pěšky, autem, s kočárkem.' }),
  },
})

const brands = defineBlock({
  label: { en: 'Brands and gift voucher', cs: 'Značky a dárkový poukaz' },
  description: { en: 'The products you work with, and a gift voucher beside them. Leave the voucher heading empty to show only the products.', cs: 'S čím pracujete a vedle toho dárkový poukaz. Nechte nadpis poukazu prázdný a ukážou se jen značky.' },
  icon: 'i-lucide-gift',
  fields: {
    heading: f.text({ required: true }).label({ en: 'Products: heading', cs: 'Značky: nadpis' }).help({ en: 'For example “What we work with”.', cs: 'Například „S čím pracujeme“.' }),
    names: f.list({
      fields: { name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }) },
      max: 8, itemLabel: { en: 'Brand', cs: 'Značka' },
    }).label({ en: 'Names', cs: 'Názvy' }).help({ en: 'Written in one line with a mark between them.', cs: 'Napíšou se do jednoho řádku se značkou mezi nimi.' }),
    text: text(),
    image: f.media({ accept: 'image/*' }).label({ en: 'Photograph', cs: 'Fotografie' }).help({ en: 'A square detail of the salon.', cs: 'Čtvercový detail salonu.' }),
    voucherEyebrow: f.text().label({ en: 'Voucher: line above the heading', cs: 'Poukaz: řádek nad nadpisem' }),
    voucherHeading: f.text().label({ en: 'Voucher: heading', cs: 'Poukaz: nadpis' }).help({ en: 'Empty: no voucher is shown.', cs: 'Prázdné: poukaz se nezobrazí.' }),
    voucherText: f.text({ multiline: true }).label({ en: 'Voucher: text', cs: 'Poukaz: text' }),
    amounts: f.list({
      fields: { amount: f.number({ int: true, min: 1 }).label({ en: 'Amount in Kč', cs: 'Částka v Kč' }) },
      max: 4, itemLabel: { en: 'Amount', cs: 'Částka' },
    }).label({ en: 'Voucher amounts', cs: 'Částky poukazu' }).help({ en: 'Up to four; Chessboard shows three tiles, so three fit best.', cs: 'Nejvýše čtyři; Šachovnice ukáže tři dlaždice, nejlépe tedy tři.' }),
    voucherLabel: f.text().label({ en: 'Voucher: link text', cs: 'Poukaz: text odkazu' }),
    voucherUrl: link('Voucher: link destination', 'Poukaz: cíl odkazu').help({ en: 'For example an e-mail address written as mailto:….', cs: 'Například e-mail zapsaný jako mailto:….' }),
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
  blocks: { opening, pricelist, team, results, firstVisit, reviews, booking, visit, brands, text: richText, ...customTypeBlocks() },
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
  formsPlugin(), // the requests of the form below
]

// ── the booking form ──
// The website draws it per look (the kit's useSiteForm). Three of its fields are the salon's
// own lists: the service (from Services), the person (from Team) and the day (the next days the
// salon is open and the person works); the website offers them as choices.
export const Appointment = defineForm('appointment', {
  label: { en: 'Appointment requests', cs: 'Žádosti o termín' },
  labelSingular: { en: 'Appointment request', cs: 'Žádost o termín' },
  fields: {
    service: f.text({ max: 200 }).optional().label({ en: 'Service', cs: 'Služba' }),
    person: f.text({ max: 200 }).optional().label({ en: 'With whom', cs: 'U koho' }),
    day: f.text({ max: 100 }).optional().label({ en: 'Day', cs: 'Den' }),
    part: f.select({
      options: ['morning', 'afternoon', 'evening'] as const, default: 'morning',
      labels: { morning: { en: 'Morning', cs: 'Dopoledne' }, afternoon: { en: 'Afternoon', cs: 'Odpoledne' }, evening: { en: 'After 4 pm', cs: 'Po 16. hodině' } },
    }).label({ en: 'When suits you', cs: 'Kdy se vám to hodí' }),
    name: f.text({ required: true, max: 200 }).label({ en: 'Name', cs: 'Jméno' }).help({ en: 'Jana Dvořáková', cs: 'Jana Dvořáková' }),
    phone: f.text({ required: true, max: 40 }).label({ en: 'Phone', cs: 'Telefon' }).help({ en: '+420', cs: '+420' }),
  },
  titleField: 'name',
  submitLabel: { en: 'Send the request', cs: 'Odeslat žádost o termín' },
  successMessage: { en: 'Thank you, we have your request. We will get back to you today.', cs: 'Děkujeme, žádost máme. Ozveme se vám ještě dnes.' },
})
export const FormSettings = defineFormSettings()
