// Every Czech text of the Restaurant template, in one place: the website's own words (what is
// not content: "Rezervovat stůl", "alergeny", the anchors of the sections) and the demo content
// the seed puts in. Another language is a file beside this one with the same two exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

/** What a look says about the restaurant being open, as the number of ways the state can read. */
export interface OpenWords {
  /** "Právě otevřeno, dnes do 22:00" */
  until: (time: string) => string
  /** "Teď zavřeno, otevíráme v 11:00" (the doors open later today) */
  today: (time: string) => string
  /** "Teď zavřeno, otevíráme zítra v 11:00" */
  tomorrow: (time: string) => string
  /** "Teď zavřeno, otevíráme v pátek v 11:00" (the next open day is not tomorrow) */
  later: (day: string, time: string) => string
}

export interface Words extends KitWords {
  /** The addresses of the sections on a page (`/#poledni`), by block type. */
  anchors: Record<'opening' | 'lunch' | 'menu' | 'kitchen' | 'gallery' | 'events' | 'hours' | 'reservation', string>
  reserve: string
  /** "Zavolat 123 456 701" */
  call: (phone: string) => string
  /** The days of the week, Monday first. */
  days: string[]
  /** "v pondělí", "ve středu": where a day follows "otevíráme". */
  onDay: string[]
  /** The short days of the footer: "Po", "Út"… */
  shortDays: string[]
  today: string
  /** An opening-hours line of a day the place is shut. */
  closed: string
  allergens: string
  /** The same as a heading: "Alergeny". */
  allergensTitle: string
  askStaff: string
  soup: string
  mainCourses: string
  /** "Platí od 1. listopadu 2026" */
  validFrom: (date: string) => string
  /** The menu's parts, as a screen reader names the navigation. */
  menuParts: string
  noLunch: string
  /** "© 2026 Kmín Jičín s.r.o." */
  copyright: (year: string, operator: string) => string
  companyId: string
  address: string
  openingHours: string
  followUs: string
  /** The way to get to the place, drawn: "Plánek: …" */
  plan: (steps: string) => string
  km: string
  toTop: (name: string) => string
  openMap: string
  /** The look-by-look wording. */
  salon: {
    open: OpenWords
    meatless: string
    reserveLead: string
    openLabel: string
    whereLabel: string
    bookLabel: string
    callLabel: string
    weekPdf: string
    mealLegend: string
  }
  /** "od 149 Kč": the lowest price of today's lunch. */
  fromPrice: (price: string) => string
  talir: {
    open: OpenWords
    meatless: string
    factOpen: string
    factWhere: string
    factBook: string
    sticker: string
    head: { dish: string; weight: string; allergens: string; price: string }
    /** "provozovna Kmínová 58, Jičín" */
    premises: (address: string) => string
  }
  paragon: {
    open: OpenWords
    /** The button's label: this look says "Zamluvit". */
    reserve: string
    stampOpen: string
    stampClosed: string
    /** The stamp on today's lunch, and the label on the slip. */
    today: string
    slip: { where: string; menu: string; table: string }
    /** "obr. 1: lokál v pondělí před polednem" */
    figure: (n: number, caption: string) => string
    /** "Vaříme od 11:00 do 14:30" */
    cooking: (from: string, to: string) => string
    /** "bez masa" after the pencilled V of the legend */
    meatless: string
    ticket: string
    /** "odběratel: Kmín, Kmínová 58, Jičín" */
    recipient: (name: string, address: string) => string
    goods: [string, string, string]
    received: string
    confirmed: string
  }
  defaultName: string
}

export const words: Words = {
  ...KIT_WORDS.cs,
  anchors: { opening: 'uvod', lunch: 'poledni', menu: 'listek', kitchen: 'kuchyne', gallery: 'galerie', events: 'akce', hours: 'kontakt', reservation: 'rezervace' },
  reserve: 'Rezervovat stůl',
  call: (phone) => `Zavolat ${phone}`,
  days: ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'],
  onDay: ['v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu', 'v neděli'],
  shortDays: ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'],
  today: 'dnes',
  closed: 'zavřeno',
  allergens: 'alergeny',
  allergensTitle: 'Alergeny',
  askStaff: 'Na ostatní se zeptejte obsluhy.',
  soup: 'Polévka',
  mainCourses: 'Hlavní jídla',
  validFrom: (date) => `Platí od ${date}`,
  menuParts: 'Části lístku',
  noLunch: 'Menu na dnešek právě chystáme. Zavolejte nám, rádi poradíme.',
  copyright: (year, operator) => `© ${year} ${operator}`,
  companyId: 'IČO',
  address: 'Adresa',
  openingHours: 'Otevřeno',
  followUs: 'Sledujte nás',
  plan: (steps) => `Plánek: ${steps}`,
  km: 'km',
  toTop: (name) => `${name}, na začátek stránky`,
  openMap: 'Otevřít v mapách',
  salon: {
    open: {
      until: (t) => `Právě otevřeno, dnes do ${t}`,
      today: (t) => `Teď zavřeno, otevíráme v ${t}`,
      tomorrow: (t) => `Teď zavřeno, otevíráme zítra v ${t}`,
      later: (day, t) => `Teď zavřeno, otevíráme ${day} v ${t}`,
    },
    meatless: 'bezmasé jídlo',
    reserveLead: 'Telefon použijeme jen k potvrzení stolu.',
    openLabel: 'Otevřeno',
    whereLabel: 'Kde nás najdete',
    bookLabel: 'Rezervace',
    callLabel: 'Kontakt',
    weekPdf: 'Menu na celý týden (PDF)',
    mealLegend: 'bezmasé jídlo',
  },
  fromPrice: (price) => `od ${price} Kč`,
  talir: {
    open: {
      until: (t) => `Teď, do ${t}`,
      today: (t) => `Dnes od ${t}`,
      tomorrow: (t) => `Zítra od ${t}`,
      later: (day, t) => `${day[0]!.toUpperCase()}${day.slice(1)} od ${t}`,
    },
    meatless: 'bez masa',
    factOpen: 'Otevřeno',
    factWhere: 'Kde',
    factBook: 'Stůl',
    sticker: 'Dnes k obědu',
    head: { dish: 'Jídlo', weight: 'Váha', allergens: 'Alergeny', price: 'Cena' },
    premises: (address) => `provozovna ${address}`,
  },
  paragon: {
    open: {
      until: (t) => `dnes do ${t}`,
      today: (t) => `otevíráme dnes v ${t}`,
      tomorrow: (t) => `otevíráme zítra v ${t}`,
      later: (day, t) => `otevíráme ${day} v ${t}`,
    },
    reserve: 'Zamluvit stůl',
    stampOpen: 'Otevřeno',
    stampClosed: 'Zavřeno',
    today: 'Dnes',
    slip: { where: 'Kde', menu: 'Menu', table: 'Stůl' },
    figure: (n, caption) => `obr. ${n}: ${caption}`,
    cooking: (from, to) => `Vaříme od ${from} do ${to}`,
    meatless: 'bez masa',
    ticket: 'Rezervační lístek',
    recipient: (name, address) => `odběratel: ${name}, ${address}`,
    goods: ['Zboží', 'Dodavatel', 'Cesta'],
    received: 'Převzato',
    confirmed: 'Potvrdíme SMS',
  },
  defaultName: 'Naše restaurace',
}

// ── the demo content: the fictional bistro Kmín in Jičín, cooked by Tomáš Hruška and run with
//    his wife Klára. The street, the people, the phone numbers and the addresses are invented;
//    the town and the places around it are real. ──
export const demo = {
  settings: {
    siteName: 'Kmín',
    tagline: 'bistro & kavárna',
    street: 'Kmínová 58',
    postalCode: '506 01',
    city: 'Jičín',
    addressNote: 'tři minuty od Valdické brány',
    // (numbers no phone has: Czech numbers do not start with 1)
    phone: '123 456 701',
    email: 'stul@kmin.example',
    mapUrl: 'https://mapy.example/kmin-jicin',
    hoursNote: 'Kuchyně vaří do 21:00, v neděli do 15:00. Polední menu podáváme od pondělí do pátku.',
    operator: 'Kmín Jičín s.r.o.',
    companyId: '12345678',
    instagram: 'https://instagram.example/kmin.jicin',
    facebook: 'https://facebook.example/kmin.jicin',
    allergenLegend: '1 lepek · 3 vejce · 4 ryby · 7 mléko · 8 ořechy · 9 celer · 10 hořčice · 12 siřičitany',
    metaDescription: 'Česká kuchyně z Českého ráje. Polední menu od 149 Kč, večer lístek, pivo z Nové Paky. Kmínová 58, Jičín.',
    // Monday first: day, opens, closes, closed all day
    hours: [
      ['mon', '11:00', '22:00'], ['tue', '11:00', '22:00'], ['wed', '11:00', '22:00'], ['thu', '11:00', '22:00'],
      ['fri', '11:00', '23:30'], ['sat', '10:00', '23:30'], ['sun', '10:00', '16:00'],
    ] as const,
  },
  menu: { lunch: 'Polední menu', menu: 'Jídelní lístek', kitchen: 'Kuchyně', events: 'Akce', hours: 'Kde a kdy' },
  home: { title: 'Úvod' },
  opening: {
    eyebrow: 'Bistro a kavárna · Jičín, Kmínová 58',
    heading: 'Česká kuchyně *z Českého ráje*',
    text: 'Svíčková, kachna, pstruh z Rovenska a buchtičky, které pečeme každé ráno. V poledne menu od 149 Kč, večer lístek a pivo z Nové Paky.',
    imageCaption: 'lokál v pondělí před polednem',
    primaryLabel: 'Rezervovat stůl',
    secondaryLabel: 'Co vaříme dnes k obědu',
    openNote: 'Kuchyně vaří do 21:00.',
    openLinkLabel: 'Celý týden',
    whereNote: 'Tři minuty od Valdické brány.',
    whereLinkLabel: 'Jak k nám',
    bookNote: 'Denně od 10 hodin, nebo',
    bookLinkLabel: 'formulářem',
  },
  lunch: {
    eyebrow: 'Polední menu',
    heading: 'Dnes k obědu',
    text: 'Podáváme od 11:00 do 14:30, dokud je navařeno. Polévku k hlavnímu jídlu přidáme za 25 Kč. S sebou balíme do vratných krabiček.',
    served: '11:00–14:30',
    imageCaption: 'vývar táhneme dvanáct hodin',
    listNote: 'Menu vyvěšujeme každý den v 9 hodin.',
    sideText: 'Svíčková bývá kolem jedné pryč. Kdo chce mít jistotu, zavolá ráno a my mu porci schováme.',
    weekLabel: 'Menu na celý týden (PDF)',
    // The soup and the mains of each day: two menus that take turns, so the days differ.
    days: [
      {
        soup: { name: 'Hovězí vývar s játrovými knedlíčky a nudlemi', amount: '0,3 l', price: 49, allergens: '1, 3, 9' },
        mains: [
          { name: 'Svíčková na smetaně, houskový knedlík, brusinky', weight: '150 g', price: 189, allergens: '1, 3, 7, 9, 10', vegetarian: false },
          { name: 'Kuřecí řízek smažený na másle, bramborová kaše, okurkový salát', weight: '150 g', price: 179, allergens: '1, 3, 7', vegetarian: false },
          { name: 'Čočka na kyselo se sázeným vejcem, kvašená okurka, chléb', weight: '300 g', price: 149, allergens: '1, 3', vegetarian: true },
          { name: 'Dýňové rizoto s pečeným kozím sýrem a šalvějí', weight: '300 g', price: 169, allergens: '7, 12', vegetarian: true },
        ],
      },
      {
        soup: { name: 'Bramboračka se sušenými houbami', amount: '0,3 l', price: 49, allergens: '1, 9' },
        mains: [
          { name: 'Vepřová krkovice na hořčici, bramborový knedlík, zelí', weight: '150 g', price: 189, allergens: '1, 3, 10', vegetarian: false },
          { name: 'Kuřecí paprikáš, domácí nokle', weight: '150 g', price: 175, allergens: '1, 3, 7', vegetarian: false },
          { name: 'Smažený sýr, vařený brambor, domácí tatarka', weight: '120 g', price: 159, allergens: '1, 3, 7, 10', vegetarian: true },
          { name: 'Špenátové knedlíčky s trhaným vejcem a sýrem', weight: '300 g', price: 155, allergens: '1, 3, 7', vegetarian: true },
        ],
      },
    ],
  },
  menuBlock: {
    heading: 'Jídelní lístek',
    text: 'Co vaříme pořád, vybírejte podle chuti.',
    // "Platí od 1. listopadu 2026"; null where the design words it in the sentence above
    validFrom: '2026-11-01' as string | null,
    featureLabel: 'Z lístku',
    featureTitle: 'Kachní stehno konfitujeme osm hodin ve vlastním sádle.',
    featureText: 'Lokše k němu pečeme na sucho, zelí dusíme s jablky a kmínem. 329 Kč.',
    categories: [
      { name: 'Předkrmy a polévky', slug: 'predkrmy' },
      { name: 'Hlavní jídla', slug: 'hlavni', opensFirst: true },
      { name: 'Dezerty', slug: 'dezerty' },
      { name: 'Nápoje', slug: 'napoje' },
    ],
    // name, what is in it, price, weight, allergens, meatless
    dishes: {
      predkrmy: [
        ['Tatarák z hovězí svíčkové', 'ručně krájený, topinky ze žitného chleba, česnek', 249, '100 g', '1, 3, 10', false],
        ['Paštika z kachních jater', 'brusinkové chutney, kváskový chléb', 149, '80 g', '1, 7, 12', false],
        ['Nakládaný hermelín', 'pečená paprika, cibule, chléb', 129, '120 g', '1, 7', true],
        ['Kulajda', 'smetanová, s hříbky, koprem a zastřeným vejcem', 89, '0,3 l', '1, 3, 7', true],
        ['Česnečka', 's uzeným masem, sýrem a krutony', 79, '0,3 l', '1, 7', false],
      ],
      hlavni: [
        ['Svíčková na smetaně', 'hovězí zadní, houskový knedlík, brusinky', 269, '150 g', '1, 3, 7, 9, 10', false],
        ['Konfitované kachní stehno', 'dušené červené zelí, bramborové lokše', 329, '250 g', '1, 12', false],
        ['Vepřový řízek smažený na sádle', 'z krkovice, lehký bramborový salát', 259, '180 g', '1, 3, 7, 10', false],
        ['Pstruh na másle s kmínem', 'ze sádek v Rovensku, petrželové brambory, citron', 299, '250 g', '4, 7', false],
        ['Hovězí líčka na černém pivu', 'bramborová kaše, pečená kořenová zelenina', 319, '200 g', '1, 7, 9', false],
        ['Kroupové rizoto s hříbky', 'uzený tvaroh, pažitka', 219, '300 g', '1, 7', true],
        ['Smažený květák', 'vařené brambory, domácí tatarka', 199, '250 g', '1, 3, 7, 10', true],
      ],
      dezerty: [
        ['Dukátové buchtičky', 's vanilkovým krémem, pečeme je každé ráno', 119, '150 g', '1, 3, 7', false],
        ['Větrník', 'karamelový fondán, dva krémy', 89, '1 ks', '1, 3, 7', false],
        ['Švestkový koláč s drobenkou', 'zakysaná smetana', 99, '120 g', '1, 3, 7', false],
        ['Čokoládový dort bez mouky', 'višně v rumu, šlehačka', 119, '100 g', '3, 7, 8', false],
      ],
      napoje: [
        ['Světlý ležák 11°', 'z tanku, pivovar v Nové Pace', 54, '0,5 l', '1', false],
        ['Polotmavá třináctka', 'nefiltrovaná, točíme ji jen od čtvrtka do neděle', 59, '0,4 l', '1', false],
        ['Ryzlink rýnský', 'pozdní sběr, Mělnicko', 79, '0,15 l', '12', false],
        ['Bezová limonáda', 'domácí sirup, citron, máta', 69, '0,4 l', '', false],
        ['Jablečný mošt z Českého ráje', 'lisovaný za studena, nefiltrovaný', 55, '0,3 l', '', false],
        ['Flat white', 'káva z pražírny v Hradci Králové', 75, '0,2 l', '7', false],
      ],
    } as Record<string, ReadonlyArray<readonly [string, string, number, string, string, boolean]>>,
  },
  kitchen: {
    eyebrow: 'Kuchyně',
    heading: 'Vaří Tomáš Hruška, *z toho, co vyrostlo za humny*',
    text: 'Tomáš se vyučil kuchařem v Jičíně, osm let vařil v Praze a v Linci a v roce 2019 se vrátil domů. S Klárou otevřeli Kmín v domě, kde bývalo železářství.\n\nVaříme českou kuchyni, jak ji pamatujeme od babiček, jen lehčí. Vývar táhneme dvanáct hodin, knedlíky děláme každý den čerstvé a omáčky nezahušťujeme ničím, co má na obalu návod.',
    signature: 'Tomáš a Klára Hruškovi',
    imageCaption: 'Tomáš Hruška, kuchař',
    suppliersHeading: 'Odkud bereme suroviny',
    deliveryNote: 'Závoz v úterý a v pátek do sedmi ráno.',
    secondCaption: 'páteční závoz z Libuně a ze Železnice',
    suppliers: [
      ['Hovězí a vepřové', 'řeznictví v Sobotce', 14],
      ['Zelenina a brambory', 'rodinná farma v Libuni', 9],
      ['Pstruzi', 'sádky v Rovensku pod Troskami', 18],
      ['Chléb a housky', 'pekárna v Železnici', 6],
      ['Pivo', 'pivovar v Nové Pace', 17],
      ['Káva', 'pražírna v Hradci Králové', 48],
    ] as ReadonlyArray<readonly [string, string, number]>,
  },
  gallery: {
    eyebrow: 'Galerie',
    heading: 'Z lokálu a z talíře',
    linkLabel: 'Další fotky na Instagramu',
  },
  events: {
    eyebrow: 'Akce',
    heading: 'Co se chystá',
    text: 'Na akce bývá plno. Stůl si zamluvte telefonem nebo formulářem níže a do poznámky napište, na co jdete.',
    // How the second line under a date is worded for a weekend, a Sunday and an evening (a look words it its own way).
    when: {
      weekend: (from: string, to: string) => `${from} až ${to}`,
      brunch: (day: string) => `${day} 10–14 h`,
      evening: (day: string) => `${day} od 19 h`,
    },
    // The seed dates them from the day it runs, so the demo always has three coming.
    items: [
      { title: 'Pivní víkend', text: 'Pět piv z Nové Paky z tanku, k nim talíř uzenin a sýrů od sousedů. Točíme, dokud je co, a kdo přijde první, vybírá z nejlepších.' },
      { title: 'Nedělní brunch', text: 'Housky, vajíčka, polévka a buchty, kolik sníte. 390 Kč za osobu, děti do deseti let za polovinu.' },
      { title: 'Večer s kapelou', text: 'Pět chodů, přípitek a kapela do dvou do rána. 1 890 Kč, míst je čtyřicet.' },
    ],
  },
  hours: {
    eyebrow: 'Otevírací doba',
    heading: 'Kdy máme otevřeno',
    placeLabel: 'Kde nás najdete',
    imageCaption: 'zelené dveře, dva stolky venku',
    ways: [
      { kind: 'walk' as const, label: 'Pěšky', text: 'Z Valdštejnova náměstí projděte Valdickou bránou a pořád rovně. Za tři minuty jste u zelených dveří.' },
      { kind: 'car' as const, label: 'Autem', text: 'Parkoviště na Žižkově náměstí, 150 metrů od nás. První hodina zdarma, večer po 18. hodině se neplatí.' },
      { kind: 'bus' as const, label: 'Autobusem a vlakem', text: 'Autobusové nádraží je 6 minut chůze, vlakové 12. Kola si opřete ve dvoře, psy bereme.' },
    ],
    planFrom: 'Valdštejnovo náměstí',
    planGate: 'brána',
    planSquare: 'Žižkovo nám.',
    planStreet: 'Kmínová',
    planBus: 'autobusy 6 min',
    planTrain: 'vlak 12 min',
  },
  reservation: {
    eyebrow: 'Rezervace',
    heading: 'Zamluvte si *stůl*',
    text: 'Rezervaci z formuláře potvrzujeme SMS, obvykle do dvou hodin. Na dnešní večer raději rovnou zavolejte.',
    phoneLabel: 'Telefon, denně od 10 hodin',
    note: 'Stůl držíme patnáct minut. Pro skupiny nad osm lidí a na oslavy máme dlouhý stůl vzadu, domluvíme se po telefonu.',
    formNote: 'Telefon použijeme jen k potvrzení stolu.',
    times: ['11:30', '12:00', '12:30', '13:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'],
    defaultTime: '19:00',
    maxGuests: 8,
  },
  privacy: { title: 'Ochrana osobních údajů' },
  // What is in each photograph, for people who cannot see it.
  photos: {
    hero: 'Lokál bistra Kmín v poledne: klenutý strop, zelené obložení, dubové stoly a pár hostů u oběda',
    bar: 'Výčep s mosaznou pípou a kávovarem',
    lokal: 'Dlouhý stůl u okna v zadní části lokálu',
    svickova: 'Svíčková na smetaně s houskovým knedlíkem',
    polevka: 'Hovězí vývar s játrovými knedlíčky a nudlemi',
    pstruh: 'Pstruh na másle s kmínem a petrželovými bramborami',
    buchticky: 'Dukátové buchtičky s vanilkovým krémem',
    tatarak: 'Tatarák z hovězí svíčkové s topinkami',
    kachna: 'Konfitované kachní stehno s červeným zelím a bramborovými lokšemi',
    kava: 'Flat white a švestkový koláč u okna',
    pivo: 'Čerstvě natočený světlý ležák na baru',
    kuchar: 'Kuchař Tomáš Hruška ve dveřích kuchyně',
    suroviny: 'Páteční závoz: farmář z Libuně nese bedýnku s kořenovou zeleninou, Klára rozbaluje maso, na stole bochník chleba a bylinky',
    dum: 'Dům v Kmínové ulici, ve kterém je bistro Kmín, se dvěma stolky na chodníku',
  },
  gallerySet: [
    // photograph, caption, shot from above: the order the looks pick from (see GALLERY_PICKS in app/utils/site.ts)
    ['bar', 'Výčep a kávovar', false],
    ['kava', 'Dopoledne u okna', false],
    ['pivo', 'Jedenáctka z tanku', false],
    ['svickova', 'Svíčková na smetaně', true],
    ['pstruh', 'Pstruh na másle s kmínem', true],
    ['lokal', 'Dlouhý stůl pro dvanáct', false],
    ['kachna', 'Kachní stehno, zelí, lokše', false],
    ['tatarak', 'Tatarák a topinky', true],
    ['buchticky', 'Buchtičky z ranní trouby', true],
  ] as ReadonlyArray<readonly [string, string, boolean]>,
}

// ── what the designs of Talíř and Paragon word differently from Salon's (the shared texts above):
//    headings, lines above headings, texts, the labels of buttons and of the menu ──
const supplierPlain: ReadonlyArray<readonly [string, string, number]> = [
  ['Hovězí a vepřové', 'řeznictví v Sobotce', 14],
  ['Zelenina', 'rodinná farma v Libuni', 9],
  ['Pstruzi', 'sádky v Rovensku', 18],
  ['Chléb', 'pekárna v Železnici', 6],
  ['Pivo', 'pivovar v Nové Pace', 17],
  ['Káva', 'pražírna v Hradci Králové', 48],
]
const kitchenText = 'Tomáš Hruška se vyučil kuchařem v Jičíně, osm let vařil v Praze a v Linci a v roce 2019 se vrátil domů. S Klárou otevřeli Kmín v domě, kde bývalo železářství.\n\nVaříme česky, jen lehčeji. Vývar táhneme dvanáct hodin, knedlíky děláme každý den čerstvé a omáčky nezahušťujeme ničím, co má na obalu návod.'
const eventsText = 'Na akce bývá plno. Zamluvte si stůl a do poznámky napište, na co jdete.'

export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  talir: {
    settings: { addressNote: 'tři minuty od Valdické brány, zelené dveře' },
    menu: { lunch: 'Dnešní oběd', menu: 'Lístek' },
    opening: {
      eyebrow: '',
      heading: 'Přijďte hladoví.',
      text: 'Bistro v Kmínově ulici. V poledne menu od 149 Kč, večer svíčková, kachna a pstruh, k tomu pivo z Nové Paky. Ráno káva a teplé buchty.',
      secondaryLabel: 'Celý lístek',
    },
    lunch: {
      eyebrow: '',
      heading: 'Dnes na oběd',
      text: 'Vaříme, dokud je navařeno. Polévku k hlavnímu jídlu přidáme za 25 Kč. S sebou balíme do vratných krabiček.',
    },
    menuBlock: { heading: 'Lístek', text: 'Co vaříme pořád. Platí od 1. listopadu, vybírejte podle chuti.', validFrom: null },
    kitchen: { eyebrow: 'Kdo stojí u plotny', heading: 'Vaří Tomáš. *Suroviny vozí sousedi.*', text: kitchenText, suppliers: supplierPlain },
    gallery: { eyebrow: '', heading: 'Lokál a talíře', linkLabel: 'Víc fotek na Instagramu' },
    events: { eyebrow: '', text: eventsText },
    hours: {
      eyebrow: '',
      heading: 'Kdy',
      placeLabel: 'Kde',
      ways: [
        { kind: 'walk' as const, label: 'Pěšky', text: 'Z náměstí Valdickou bránou a pořád rovně, tři minuty.' },
        { kind: 'car' as const, label: 'Autem', text: 'Parkoviště na Žižkově náměstí, 150 m. První hodina zdarma, po 18. hodině se neplatí.' },
        { kind: 'bus' as const, label: 'Autobusem a vlakem', text: 'Autobusové nádraží 6 minut, vlakové 12. Kola opřete ve dvoře, psy bereme.' },
      ],
    },
    reservation: {
      eyebrow: '',
      heading: 'Držíme vám stůl.',
      text: 'Rezervaci z formuláře potvrzujeme SMS, obvykle do dvou hodin. Na dnešní večer rovnou zavolejte.',
      phoneLabel: 'denně od 10 hodin',
      note: 'Stůl držíme patnáct minut. Skupiny nad osm lidí si domluvte po telefonu.',
    },
  },
  paragon: {
    settings: { hoursNote: 'Kuchyně vaří do 21:00, v neděli do 15:00. Denní menu od pondělí do pátku.' },
    menu: { lunch: 'Denní menu', menu: 'Lístek', kitchen: 'Kdo vaří' },
    opening: {
      eyebrow: 'Jičín, Kmínová 58 · tři minuty od Valdické brány',
      heading: 'Tak co to dneska bude?',
      text: 'Svíčková, kachna, pstruh z Rovenska. V poledne menu od 149 Kč, večer lístek a jedenáctka z Nové Paky, ráno káva a buchty rovnou z trouby.',
      primaryLabel: 'Zamluvit stůl',
      secondaryLabel: 'Dnešní menu',
    },
    lunch: {
      eyebrow: '',
      heading: 'Denní menu',
      text: '',
      listNote: 'Polévka k hlavnímu jídlu za 25 Kč.',
      sideText: 'Svíčková bývá kolem jedné pryč. Kdo chce mít jistotu, zavolá ráno a my mu porci schováme. S sebou balíme do vratných krabiček.',
    },
    menuBlock: { heading: 'Stálý lístek', text: 'Co vaříme pořád, ať je pondělí, nebo posvícení. Zaškrtněte, na co máte chuť.', validFrom: null },
    kitchen: {
      eyebrow: 'Kdo vaří a z čeho',
      heading: 'Vaří Tomáš. Maso veze řezník ze Sobotky.',
      text: kitchenText,
      suppliersHeading: 'Dodací list',
      suppliers: [
        ['Hovězí a vepřové', 'řeznictví v Sobotce', 14],
        ['Zelenina, brambory', 'rodinná farma v Libuni', 9],
        ['Pstruzi', 'sádky v Rovensku pod Troskami', 18],
        ['Chléb a housky', 'pekárna v Železnici', 6],
        ['Pivo', 'pivovar v Nové Pace', 17],
        ['Káva', 'pražírna v Hradci Králové', 48],
      ],
    },
    gallery: { eyebrow: '', heading: 'Jak to u nás vypadá', linkLabel: 'další fotky na Instagramu' },
    gallerySet: [
      ['bar', 'výčep a kávovar', false],
      ['kava', 'dopoledne u okna', false],
      ['pivo', 'jedenáctka z tanku', false],
      ['svickova', 'svíčková na smetaně', true],
      ['pstruh', 'pstruh na kmíně', true],
      ['lokal', 'dlouhý stůl vzadu', false],
      ['kachna', 'kachní stehno, zelí, lokše', false],
      ['tatarak', 'tatarák a topinky', true],
      ['buchticky', 'buchtičky z ranní trouby', true],
    ],
    events: {
      eyebrow: '',
      text: eventsText,
      items: [
        { title: 'Pivní víkend', text: 'Pět piv z Nové Paky z tanku, k nim talíř uzenin a sýrů od sousedů. Točíme, dokud je co.' },
        { title: 'Nedělní brunch', text: 'Housky, vajíčka, polévka a buchty, kolik sníte. 390 Kč za osobu, děti do deseti let za polovinu.' },
        { title: 'Večer s kapelou', text: 'Pět chodů, přípitek a kapela do dvou do rána. 1 890 Kč, míst je čtyřicet.' },
      ],
      when: {
        weekend: (from: string, to: string) => `${from} až ${to}`,
        brunch: (day: string) => `${day}, 10 až 14 hodin`,
        evening: (day: string) => `${day}, od 19 hodin`,
      },
    },
    hours: {
      eyebrow: '',
      heading: 'Otevírací doba',
      ways: [
        { kind: 'walk' as const, label: 'Pěšky', text: 'Z Valdštejnova náměstí Valdickou bránou a pořád rovně, tři minuty.' },
        { kind: 'car' as const, label: 'Autem', text: 'Parkoviště na Žižkově náměstí, 150 m. První hodina zdarma, po 18. hodině se neplatí.' },
        { kind: 'bus' as const, label: 'Autobus, vlak', text: 'Autobusové nádraží 6 minut chůze, vlakové 12. Kola opřete ve dvoře, psy bereme.' },
      ],
    },
    reservation: {
      eyebrow: '',
      heading: 'Zamluvte si stůl',
      text: 'Lístek vyplňte a odešlete, potvrdíme ho SMS, obvykle do dvou hodin. Na dnešní večer rovnou zavolejte.',
      note: 'Stůl držíme patnáct minut. Skupiny nad osm lidí a oslavy si domluvte po telefonu, máme vzadu dlouhý stůl pro dvanáct.',
    },
  },
}
