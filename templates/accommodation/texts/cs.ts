// Every Czech text of the Accommodation template, in one place: the website's own words (what
// is not content: "Příjezd", "za noc", the anchors of the sections) and the demo content the
// seed puts in (with what a look's design words differently: `demoByLook`). Another language is
// a file beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

export interface Words extends KitWords {
  /** The site's name until the settings hold one is the kit's `defaultName`. */
  toTop: (name: string) => string
  /** The addresses of the sections on a page (`/#pokoje`), by block type. */
  anchors: Record<'opening' | 'year' | 'rooms' | 'prices' | 'house' | 'trips' | 'reviews' | 'gallery' | 'hosts' | 'directions' | 'enquiry', string>
  /** The months, as a list ("leden"), and the seasons of a trip. */
  months: string[]
  seasonNames: Record<'spring' | 'summer' | 'autumn' | 'winter', string>
  allYear: string
  chooseSeason: string
  /** "2 lůžka" */
  beds: (n: number) => string
  /** "3 noci" */
  nights: (n: number) => string
  /** "5 fotek" */
  photoCount: (n: number) => string
  /** "42 fotografií" */
  photosOf: (n: number) => string
  /** "Pokoj" / "Apartmán" */
  kind: Record<'room' | 'apartment', string>
  /** "podkroví", "1. patro" */
  floor: Record<'attic' | 'upper' | 'ground', string>
  /** "v podkroví", "v 1. patře" */
  floorIn: Record<'attic' | 'upper' | 'ground', string>
  from: string
  perNight: string
  perNightBreakfast: string
  /** "aspoň 3 noci" */
  atLeast: (n: number) => string
  shortestStay: string
  /** "od 1 690 Kč za noc · aspoň 3 noci" is built from these. */
  room: string
  priceTable: string
  pricesPerNight: string
  askRoom: (kind: string, name: string) => string
  askStay: string
  moreAboutRoom: string
  backToRooms: string
  roomEquipment: string
  roomPhotos: string
  roomPrices: string
  roomFacts: { beds: string; area: string; floor: string }
  /** The ribbon of the year. */
  today: string
  todayAt: (day: number, month: number) => string
  yearRibbon: (parts: string) => string
  /** The short form of the opening. */
  arrivalLabel: string
  departureLabel: string
  guestsLabel: string
  arrivalAria: string
  /** Shown in the empty date fields of the short form. */
  dateExample: [arrival: string, departure: string]
  departureAria: string
  /** "1 osoba", "2 osoby", "7 a více" */
  guests: (n: number) => string
  /** The hint after a link of the phone menu. */
  menuHints: { rooms: (count: number, beds: number) => string; prices: (from: string) => string; trips: (count: number, farthest: string) => string; house: string }
  /** The distances from the door. */
  distancesLabel: string
  /** The address panel. */
  altitude: string
  coordinates: string
  youAreHere: string
  /** The footer. */
  address: string
  contact: string
  documents: string
  operator: string
  companyId: string
  copyright: (name: string) => string
  /** The hosts. */
  arrival: string
  departure: string
  phone: string
  /** The enquiry. */
  consentBefore: string
  consentLink: string
  /** The gallery. */
  galleryStrip: string
  previous: string
  next: string
  /** The room on a review card: "apartmán Arnika". */
  reviewRoom: (kind: string, name: string) => string
  gallery: string
}

const plural = (n: number, one: string, few: string, many: string): string => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

export const words: Words = {
  ...KIT_WORDS.cs,
  defaultName: 'Ubytování',
  toTop: (name) => `${name}, na začátek stránky`,
  anchors: {
    opening: 'uvod', year: 'rok', rooms: 'pokoje', prices: 'cenik', house: 'dum', trips: 'okoli',
    reviews: 'hoste', gallery: 'galerie', hosts: 'hostitele', directions: 'cesta', enquiry: 'poptavka',
  },
  months: ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'],
  seasonNames: { spring: 'jaro', summer: 'léto', autumn: 'podzim', winter: 'zima' },
  allYear: 'Celý rok',
  chooseSeason: 'Vybrat roční období',
  beds: (n) => `${n} ${plural(n, 'lůžko', 'lůžka', 'lůžek')}`,
  nights: (n) => `${n} ${plural(n, 'noc', 'noci', 'nocí')}`,
  photoCount: (n) => `${n} ${plural(n, 'fotka', 'fotky', 'fotek')}`,
  photosOf: (n) => `${n} ${plural(n, 'fotografie', 'fotografie', 'fotografií')}`,
  kind: { room: 'Pokoj', apartment: 'Apartmán' },
  floor: { attic: 'podkroví', upper: '1. patro', ground: 'přízemí' },
  floorIn: { attic: 'v podkroví', upper: 'v 1. patře', ground: 'v přízemí' },
  from: 'od',
  perNight: 'za noc',
  perNightBreakfast: 'za noc se snídaní',
  atLeast: (n) => `aspoň ${n} ${plural(n, 'noc', 'noci', 'nocí')}`,
  shortestStay: 'Nejkratší pobyt',
  room: 'Pokoj',
  priceTable: 'Ceny pokojů za noc podle sezóny',
  pricesPerNight: 'Ceny v Kč za noc.',
  askRoom: (kind, name) => `Poptat ${kind.toLowerCase()} ${name}`,
  askStay: 'Poptat termín',
  moreAboutRoom: 'Prohlédnout',
  backToRooms: 'Všechny pokoje a apartmány',
  roomEquipment: 'Vybavení',
  roomPhotos: 'Fotografie',
  roomPrices: 'Cena za noc se snídaní',
  roomFacts: { beds: 'Lůžka', area: 'Plocha', floor: 'Patro' },
  today: 'dnes',
  todayAt: (day, month) => `dnes, ${day}. ${month}.`,
  yearRibbon: (parts) => `Sezóny během roku: ${parts}`,
  arrivalLabel: 'Příjezd',
  departureLabel: 'Odjezd',
  guestsLabel: 'Hosté',
  arrivalAria: 'Datum příjezdu',
  dateExample: ['12. 2. 2027', '15. 2. 2027'],
  departureAria: 'Datum odjezdu',
  guests: (n) => (n >= 7 ? '7 a více' : `${n} ${plural(n, 'osoba', 'osoby', 'osob')}`),
  menuHints: {
    rooms: (count, beds) => `${count} ${plural(count, 'pokoj', 'pokoje', 'pokojů')}, ${beds} lůžek`,
    prices: (from) => `od ${from}`,
    trips: (count, farthest) => `${count} ${plural(count, 'tip', 'tipy', 'tipů')} do ${farthest}`,
    house: 'sauna, kamna, zahrada',
  },
  distancesLabel: 'Vzdálenosti ode dveří',
  altitude: 'Nadmořská výška',
  coordinates: 'Souřadnice',
  youAreHere: 'jste tu',
  address: 'Adresa',
  contact: 'Kontakt',
  documents: 'Dokumenty',
  operator: 'Provozovatel:',
  companyId: 'IČO',
  copyright: (name) => `© ${new Date().getFullYear()} ${name}`,
  arrival: 'Příjezd',
  departure: 'Odjezd',
  phone: 'Telefon',
  consentBefore: 'Odesláním souhlasíte se',
  consentLink: 'zpracováním osobních údajů',
  galleryStrip: 'Galerie, posouvejte do stran',
  previous: 'Předchozí fotografie',
  next: 'Další fotografie',
  reviewRoom: (kind, name) => `${kind.toLowerCase()} ${name}`,
  gallery: 'Galerie',
}

// ── the demo content: the fictional guesthouse Vřesovka, a family house from 1903 in the
//    Orlické hory. The people, the phone numbers and the addresses are invented. This is how
//    the first look's design (Celý rok) words it. ──


export const demo = {
  settings: {
    siteName: 'Vřesovka',
    tagline: 'penzion · Orlické hory',
    phone: '123 456 701',
    email: 'pobyt@penzion-vresovka.example',
    arrival: '15–19 h',
    departure: 'do 10 h',
    address: 'Říčky v Orlických horách 387',
    postalTown: '517 61 Rokytnice v Orlických horách',
    altitude: '720 m',
    coordinates: '50.2096N, 16.4563E',
    maps: [
      { label: 'Na mapě', url: 'https://mapy.example/vresovka' },
      { label: 'Navigace', url: 'https://mapy.example/vresovka/trasa' },
    ],
    ctaLabel: 'Poptat termín',
    about: 'Rodinný penzion v horském domě z roku 1903. Otevřeno celý rok.',
    operator: 'Tomáš Vondra, Říčky v Orlických horách 387',
    companyId: '12345678',
    metaDescription: 'Rodinný penzion v horském domě z roku 1903 v Říčkách v Orlických horách. Dva pokoje a dva apartmány, snídaně, sauna, sjezdovka 600 m od domu.',
  },
  menu: { rooms: 'Pokoje', house: 'V domě', prices: 'Ceník', trips: 'Okolí', hosts: 'O nás', directions: 'Jak k nám' },
  legal: { rules: 'Ubytovací řád', cancellation: 'Storno podmínky', privacy: 'Ochrana osobních údajů' },
  home: { title: 'Úvod' },
  opening: {
    eyebrow: 'Říčky v Orlických horách · 720 m n. m.',
    heading: 'Horský dům pod hřebenem, otevřený celý rok',
    text: 'Dva pokoje a dva apartmány pro patnáct hostů. Snídaně, sauna, kamna v jídelně a sjezdovka 600 metrů od dveří.',
    distances: [] as Array<{ value: string; label: string }>,
    image: 'dum', secondImage: '',
    quickButton: 'Zjistit, zda je volno',
    quickNote: 'Nezávazná poptávka. Odpovídáme tentýž den, termín vám tři dny podržíme.',
  },
  year: {
    heading: 'V zimě na lyže, v létě na borůvky. Mezitím je tu ticho.',
    text: 'Vřesovka stojí sama na louce nad Říčkami, kousek pod hřebenem Orlických hor. Dům z roku 1903 jsme opravili tak, aby zůstal chalupou: prkenné podlahy, kachlová kamna, peřiny.\n\nRok tu má tři ceny. Podívejte se, do které padne váš termín.',
  },
  rooms: {
    heading: 'Pokoje a apartmány',
    text: 'Dva pokoje, dva apartmány, dohromady patnáct lůžek. Ceny jsou za celý pokoj a noc, se snídaní. Každý má vlastní koupelnu.',
  },
  prices: {
    heading: 'Ceník podle sezóny',
    text: 'Cena je za celý pokoj nebo apartmán na jednu noc, ať vás přijede kolik chce do počtu lůžek. Platí od 1. 1. 2027.',
    includedHeading: 'V ceně máte',
    included: [
      { label: 'Snídani', text: 'bufet od 8 do 10 hodin' },
      { label: 'Parkování', text: 'u domu, v zimě prohrnuté' },
      { label: 'Saunu', text: 'jednou za pobyt na dvě hodiny' },
      { label: 'Závěrečný úklid', text: 'povlečení a ručníky' },
      { label: 'Lyžárnu a kolárnu', text: 'zamykací, s vysoušečem bot' },
    ],
    extrasHeading: 'Příplatky',
    extras: [
      { label: 'Pes', note: '', price: '150 Kč / noc' },
      { label: 'Poplatek z pobytu', note: '(18+)', price: '25 Kč / os. a noc' },
      { label: 'Večeře', note: '', price: '290 Kč / os.' },
      { label: 'Sauna navíc', note: '', price: '400 Kč / 2 h' },
      { label: 'Dětská postýlka', note: '', price: 'zdarma' },
    ],
    notesHeading: 'Dobré vědět',
    notes: [
      { text: 'Příjezd mezi 15. a 19. hodinou, odjezd do 10 hodin.' },
      { text: 'Rezervaci potvrzuje záloha 30 % převodem.' },
      { text: 'Storno do 14 dnů před příjezdem je zdarma.' },
    ],
  },
  house: {
    heading: 'Co u nás najdete',
    text: '',
    image: 'sauna',
    imageCaption: 'Sauna ve sklepě. Zatopíme vám na hodinu, kterou si řeknete u snídaně.',
  },
  features: [
    { name: 'Sauna', where: '', text: 'Finská, pro čtyři lidi, s ochlazením ve sprše nebo ve sněhu za dveřmi. Jednou za pobyt ji máte v ceně.' },
    { name: 'Zahrada s ohništěm', where: '', text: 'Stůl, lavice, ohniště a dřevo k tomu. Louka kolem domu je naše, nikdo vás neuvidí.' },
    { name: 'Lyžárna a kolárna', where: '', text: 'Zamykací místnost u zadních dveří, vysoušeč na osm párů bot, stojan na kola a hadice na umytí.' },
    { name: 'Dětské hřiště', where: '', text: 'Houpačka, pískoviště a v zimě kopeček na boby hned za domem. V jídelně police s hrami a knížkami.' },
    { name: 'Jídelna s kamny', where: '', text: 'Kachlová kamna z roku 1903 topí dodnes. Večer tu můžete sedět, jak dlouho chcete, pivo a víno je v lednici.' },
    { name: 'Psi jsou vítáni', where: '', text: 'Do všech pokojů, za 150 Kč na noc. Misku a deku máme, louka a les začínají u prahu.' },
  ],
  trips: {
    heading: 'Co dělat v okolí',
    photos: [{ image: 'hreben', caption: 'Hřebenová cesta, půl hodiny chůze od domu.' }],
  },
  tripItems: {
    slope: {
      name: 'Sjezdovka Pod Hřebenem', distance: '600 m', text: 'Čtyřsedačka, sjezdovky modré i červené, dětský park a půjčovna. Pěšky deset minut s lyžemi na rameni.',
      seasons: ['winter'], fromMonth: '12', toMonth: '3', tag: '',
    },
    ridge: {
      name: 'Hřebenová cesta', distance: '2 km', text: 'Lesem přes Pěticestí a Zakletý. V létě borůvky a výhledy do Kladska, v zimě upravené běžecké stopy.',
      seasons: ['spring', 'summer', 'autumn', 'winter'], fromMonth: '', toMonth: '', tag: '',
    },
    tower: {
      name: 'Rozhledna na Bukovém vrchu', distance: '3,5 km', text: 'Dřevěná věž v 991 metrech. Za jasného dne je vidět Sněžka i Králický Sněžník. Pěšky hodinu lesní cestou.',
      seasons: ['spring', 'summer', 'autumn'], fromMonth: '4', toMonth: '11', tag: '',
    },
    fort: {
      name: 'Dělostřelecká tvrz', distance: '6 km', text: 'Pevnost z let 1936–38 s prohlídkou podzemí. Uvnitř je celý rok osm stupňů, vezměte si svetr.',
      seasons: ['spring', 'summer', 'autumn'], fromMonth: '5', toMonth: '10', tag: 'když prší',
    },
    pool: {
      name: 'Koupaliště v Rokytnici', distance: '7 km', text: 'Přírodní koupaliště s travnatou pláží, skluzavkou a stánkem. Voda z potoka, v červenci kolem 21 stupňů.',
      seasons: ['summer'], fromMonth: '6', toMonth: '8', tag: '',
    },
    bridge: {
      name: 'Kamenný most pod Skalkou', distance: '9 km', text: 'Kamenný most přes Divokou Orlici a skalnaté údolí pod ním. Na kole po cyklostezce, zpátky to jede samo.',
      seasons: ['spring', 'summer', 'autumn'], fromMonth: '4', toMonth: '10', tag: 'na kole',
    },
  },
  reviews: { heading: 'Napsali hosté' },
  reviewItems: [
    { name: 'Markéta a Ondřej', town: 'Brno', stayed: '2026-08-15T22:00:00Z', room: 'arnika', text: '„Přijeli jsme na tři noci a zůstali pět. Děti byly celé dny na zahradě, my v sauně. Snídaně s domácí marmeládou a ticho, jaké ve městě nemáme.“' },
    { name: 'Rodina Havlíkova', town: 'Pardubice', stayed: '2026-02-14T23:00:00Z', room: 'mech', text: '„Na sjezdovku deset minut pěšky, v lyžárně vysoušeč bot a večer kamna v jídelně. Apartmán Mech byl pro naši šestici akorát. Na jarní prázdniny máme zamluveno znovu.“' },
    { name: 'Jitka Nováková', town: 'Praha', stayed: '2025-10-14T22:00:00Z', room: 'jerabina', text: '„Poprvé jsme jeli se psem a báli se, jak to dopadne. Fena dostala misku a deku, my tipy na trasy, kde nepotkáme lanovku ani frontu. V říjnu byl hřeben jen náš.“' },
  ],
  gallery: {
    heading: 'Dům a kraj kolem',
    photos: [
      { image: 'dumDalka', caption: '' }, { image: 'jidelna', caption: '' }, { image: 'snidane', caption: '' },
      { image: 'rozhledna', caption: '' }, { image: 'zahrada', caption: '' }, { image: 'most', caption: '' },
    ],
    moreLabel: 'Celá galerie',
    moreCount: 14,
    // (the page the link leads to holds every photograph)
    pageHeading: 'Dům a kraj kolem',
  },
  hosts: {
    eyebrow: 'Hostitelé',
    heading: 'Hana a Tomáš Vondrovi',
    lead: 'Do Říček jsme dvacet let jezdili lyžovat. V roce 2014 jsme tu koupili dům po bývalé horské hospodě a tři roky ho opravovali.',
    text: 'Hana peče chleba a vaří snídaně, Tomáš topí, seká louku a v zimě odhazuje sníh. Bydlíme v přízemí, takže když něco potřebujete, stačí zaklepat. Poradíme, kam jít, když fouká, kde rostou hřiby a která hospoda má otevřeno v pondělí.',
    ctaLabel: 'Napsat nám',
  },
  directions: {
    heading: 'Jak se k nám dostanete',
    placeLabel: 'Kde stojíme',
    facts: [{ label: 'Na hřeben', value: '2 km' }],
    carHeading: 'Autem',
    carRoutes: [
      { place: 'Hradec Králové', distance: '62 km', time: '1 h 10', note: '' },
      { place: 'Olomouc', distance: '112 km', time: '1 h 55', note: '' },
      { place: 'Brno', distance: '165 km', time: '2 h 30', note: '' },
      { place: 'Praha', distance: '170 km', time: '2 h 20', note: '' },
    ],
    carNote: 'Přes Rychnov nad Kněžnou a Rokytnici. V Říčkách u kostela doleva, pak 400 metrů do kopce. V zimě se silnice prohrnuje, zimní pneumatiky stačí. Parkujete u domu.',
    trainHeading: 'Vlakem a autobusem',
    trainSteps: [
      { title: 'Vlak do Rokytnice v Orlických horách', value: '', note: 'z Hradce Králové s přestupem v Doudlebech, 1 h 50 min' },
      { title: 'Autobus do zastávky Říčky, střed', value: '', note: '12 minut, navazuje na vlak. V zimě jezdí i skibus zdarma.' },
      { title: 'Pěšky 400 metrů', value: '', note: 'Nebo zavolejte, v Rokytnici vás vyzvedneme.' },
    ],
    trainNote: '',
  },
  enquiry: {
    heading: 'Zeptejte se na termín',
    text: 'Poptávka vás k ničemu nezavazuje. Není to rezervace: nejdřív vám napíšeme, jestli máme volno a kolik pobyt vyjde.',
    steps: [{ text: 'Odpovíme tentýž den, nejpozději do večera.' }, { text: 'Termín vám tři dny podržíme.' }, { text: 'Rezervaci potvrdí záloha 30 %.' }],
    callLabel: 'Raději voláte?',
    adviceLabel: 'Poraďte mi, který se hodí',
    moreRooms: [{ name: 'Celý dům · 15 lůžek' }],
  },
  // The rooms, each by a key of its own (a look words some of them differently: `demoByLook`).
  seasons: {
    off: {
      name: 'Mimo sezónu', shortName: '', tone: 'off' as const, minNights: 2,
      ranges: [{ from: '2027-03-14T23:00:00Z', to: '2027-06-29T22:00:00Z', label: 'Jaro' }, { from: '2027-08-31T22:00:00Z', to: '2027-12-18T23:00:00Z', label: 'Podzim' }],
    },
    main: {
      name: 'Hlavní sezóna', shortName: 'Hlavní', tone: 'main' as const, minNights: 3,
      ranges: [{ from: '2027-01-01T23:00:00Z', to: '2027-03-13T23:00:00Z', label: 'Zima' }, { from: '2027-06-30T22:00:00Z', to: '2027-08-30T22:00:00Z', label: 'Léto' }],
    },
    special: {
      name: 'Vánoce a Silvestr', shortName: 'Vánoce', tone: 'special' as const, minNights: 5,
      ranges: [{ from: '2027-12-19T23:00:00Z', to: '2026-12-31T23:00:00Z', label: '' }],
    },
  },
  roomItems: {
    jerabina: {
      name: 'Jeřabina', kind: 'room' as const, floor: 'attic' as const, beds: 2, area: 18,
      summary: 'Malý pokoj pod střechou s oknem na louku a na Zakletý. Manželská postel, vlastní koupelna se sprchou, varná konvice, Wi-Fi.',
      description: 'Malý pokoj pod střechou s oknem na louku a na Zakletý. Pro dva, kteří chtějí být hlavně venku.\n\nDřevěné podlahy, peřiny a ticho. Ráno je z okna vidět, jak se z louky zvedá mlha.',
      equipment: ['manželská postel', 'sprcha', 'varná konvice', 'Wi-Fi'],
      photo: 'pokojJerabina', more: ['dum', 'snidane', 'jidelna', 'zahrada'],
      prices: { off: 1390, main: 1690, special: 2190 },
    },
    boruvka: {
      name: 'Borůvka', kind: 'room' as const, floor: 'upper' as const, beds: 3, area: 24,
      summary: 'Pokoj pro rodiče s dítětem nebo tři kamarády. Manželská postel a samostatné lůžko, koupelna se sprchou, skříň na lyžařské věci. Dětskou postýlku přidáme zdarma.',
      description: 'Pokoj pro rodiče s dítětem nebo tři kamarády. Dětskou postýlku přidáme zdarma, lyžařské věci se vejdou do velké skříně.\n\nOkno vede na zahradu, takže děti mají po snídani hřiště na dohled.',
      equipment: ['manželská postel', 'lůžko navíc', 'sprcha', 'velká skříň'],
      photo: 'pokojBoruvka', more: ['dum', 'snidane', 'jidelna', 'zahrada', 'sauna'],
      prices: { off: 1890, main: 2290, special: 2890 },
    },
    arnika: {
      name: 'Arnika', kind: 'apartment' as const, floor: 'upper' as const, beds: 4, area: 42,
      summary: 'Ložnice s manželskou postelí a obývací pokoj s rozkládací pohovkou. Kuchyňský kout s vařičem a lednicí, jídelní stůl pro čtyři, koupelna se sprchou.',
      description: 'Ložnice a obývací pokoj s kuchyňským koutem. Uvaříte si sami, a když se nechce, je tu večeře od Hany.\n\nKe stolu pro čtyři se vejdou i hry z police v jídelně.',
      equipment: ['ložnice', 'rozkládací pohovka', 'kuchyňský kout', 'sprcha'],
      photo: 'apartmanArnika', more: ['dum', 'dumDalka', 'snidane', 'jidelna', 'zahrada', 'sauna', 'hreben'],
      prices: { off: 2690, main: 3190, special: 3990 },
    },
    mech: {
      name: 'Mech', kind: 'apartment' as const, floor: 'attic' as const, beds: 6, area: 68,
      summary: 'Velký podkrovní apartmán pro dvě rodiny nebo partu. Dvě ložnice, obývací kuchyně s kamny na dřevo a stolem pro šest, balkon s výhledem na hřeben, koupelna s vanou.',
      description: 'Velký apartmán pro dvě rodiny nebo partu. Večer se sejdete u kamen a u stolu pro šest, ráno je z balkonu vidět hřeben.\n\nDvě ložnice jsou od sebe oddělené obývací kuchyní, takže si nikdo nepřekáží.',
      equipment: ['2 ložnice', 'kuchyně', 'kamna na dřevo', 'balkon', 'vana'],
      photo: 'apartmanMech', more: ['dum', 'dumDalka', 'snidane', 'jidelna', 'zahrada', 'sauna', 'hreben', 'rozhledna'],
      prices: { off: 3790, main: 4490, special: 5690 },
    },
  },
  // Pages beside the home page: the whole gallery and the documents of the footer.
  pages: {
    gallery: { title: 'Galerie' },
    rules: {
      title: 'Ubytovací řád',
      lead: 'Ubytovací řád Vřesovky v krátkosti. Vyvěšený je také u vchodu do domu.',
      points: [
        'Příjezd je od 15 do 19 hodin, odjezd do 10 hodin. Když přijedete později, napište nebo zavolejte.',
        'Po 22. hodině prosíme o klid, v domě spí i děti.',
        'V pokojích se nekouří. Na zahradě u ohniště ano, popelníky tam jsou.',
        'Psi jsou vítáni, za 150 Kč na noc. Prosíme, nenechávejte je v pokoji samotné a na postele je nepouštějte.',
        'Sauna se topí na předem domluvenou hodinu, jednou za pobyt je v ceně.',
        'Za škodu, kterou způsobíte, odpovídáte. Rozbité sklenice a šálky nevadí, jen nám řekněte.',
      ],
    },
    cancellation: {
      title: 'Storno podmínky',
      lead: 'Rezervace je závazná po zaplacení zálohy. Do té doby je poptávka jen domluva.',
      points: [
        'Záloha činí 30 % z ceny pobytu a platí se převodem do sedmi dnů od potvrzení.',
        'Storno do 14 dnů před příjezdem je zdarma, zálohu vrátíme celou.',
        'Při zrušení 13 až 4 dny před příjezdem zůstává záloha nám.',
        'Při zrušení méně než 4 dny před příjezdem uhradíte celý pobyt, pokud se nám nepodaří pokoj znovu pronajmout.',
        'Termín můžete jednou posunout, když nám to napíšete aspoň 14 dnů předem.',
      ],
    },
    privacy: {
      title: 'Ochrana osobních údajů',
      lead: 'Tato stránka je ukázková. Na webu skutečného ubytování by tu stálo, jak s údaji hostů nakládáte.',
      points: [
        'Z poptávkového formuláře ukládáme jméno, e-mail, telefon, termín, počet hostů a vaši poznámku.',
        'Údaje použijeme jen k odpovědi na poptávku a k případné rezervaci. Reklamu vám nepošleme.',
        'Poptávky, které nevedly k pobytu, mažeme po šesti měsících.',
        'Správcem údajů je provozovatel uvedený v zápatí. Napište nám a údaje opravíme nebo smažeme.',
      ],
    },
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    dum: 'Penzion Vřesovka: starý horský dům s bílým přízemím a dřevěným patrem na louce pod lesem',
    dumDalka: 'Penzion Vřesovka z dálky, dům na louce pod zalesněným hřebenem',
    zahrada: 'Zahrada za domem s ohništěm, stolem a houpačkou',
    hreben: 'Stezka po hřebeni Orlických hor mezi borůvčím a vřesem',
    jidelna: 'Jídelna se zelenými kachlovými kamny a dřevěnými stoly',
    most: 'Kamenný most přes Divokou Orlici',
    rozhledna: 'Dřevěná rozhledna na Bukovém vrchu',
    sauna: 'Finská sauna ve sklepě penzionu, lavice ze smrkového dřeva',
    snidane: 'Snídaně: chléb, borůvková marmeláda, vejce a káva',
    hostitele: 'Hana a Tomáš Vondrovi u dveří penzionu',
    pokojJerabina: 'Pokoj Jeřabina: podkrovní pokoj s manželskou postelí a oknem na louku',
    pokojBoruvka: 'Pokoj Borůvka: třílůžkový pokoj s manželskou postelí a samostatným lůžkem',
    apartmanArnika: 'Apartmán Arnika: obývací pokoj s kuchyňským koutem a jídelním stolem',
    apartmanMech: 'Apartmán Mech: velký podkrovní apartmán s trámy, kamny na dřevo a dlouhým stolem',
  },
}

// What a look's design words differently from the texts above (the shared ones are the first
// look's, Celý rok): a site made in that look gets these, and the home page of that design.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  'ode-dveri': {
    settings: { tagline: 'penzion v Říčkách', about: 'Rodinný penzion v Říčkách v Orlických horách. Otevřeno celý rok.' },
    menu: { house: 'V domě', prices: 'Ceník', trips: 'V okolí', directions: 'Cesta k nám' },
    // (a room's card names the other seasons: "hlavní sezóna 1 690 Kč, Vánoce 2 190 Kč")
    seasons: { main: { shortName: 'hlavní sezóna' } },
    opening: {
      eyebrow: 'Říčky v Orlických horách, 720 m n. m.',
      heading: '*Dům na louce.* Ode dveří rovnou do hor.',
      text: 'Rodinný penzion v horském domě z roku 1903. Čtyři pokoje, snídaně v ceně a večer sauna.',
      distances: [{ value: '600 m', label: 'na sjezdovku' }, { value: '2 km', label: 'na hřeben' }, { value: '3,5 km', label: 'k rozhledně' }],
      secondImage: 'snidane',
    },
    rooms: { text: 'Dva pokoje a dva apartmány, dohromady patnáct lůžek. Každý má vlastní koupelnu. Ceny jsou za celý pokoj a noc, se snídaní.' },
    prices: {
      text: 'Platíte za pokoj, ne za osobu. Ceník platí od 1. 1. 2027.',
      included: [
        { label: 'Snídani', text: ', bufet od 8 do 10 hodin' },
        { label: 'Parkování', text: 'u domu, v zimě prohrnuté' },
        { label: 'Saunu', text: 'jednou za pobyt na dvě hodiny' },
        { label: 'Závěrečný úklid', text: ', povlečení a ručníky' },
        { label: 'Lyžárnu a kolárnu', text: 's vysoušečem bot' },
      ],
      extras: [
        { label: 'Pes', note: '', price: '150 Kč za noc' },
        { label: 'Poplatek z pobytu', note: '(od 18 let)', price: '25 Kč za osobu a noc' },
        { label: 'Večeře', note: '', price: '290 Kč za osobu' },
        { label: 'Sauna navíc', note: '', price: '400 Kč za 2 hodiny' },
        { label: 'Dětská postýlka', note: '', price: 'zdarma' },
      ],
      notesHeading: '',
      notes: [{ text: 'Příjezd mezi 15. a 19. hodinou, odjezd do 10 hodin. Rezervaci potvrzuje záloha 30 %, storno do 14 dnů před příjezdem je zdarma.' }],
    },
    house: {
      heading: 'V domě máte všechno po ruce',
      text: 'Než vyrazíte na kilometry: tohle je od vašeho pokoje nejdál třicet metrů.',
      image: 'jidelna', imageCaption: '',
    },
    features: [
      { name: 'Jídelna s kachlovými kamny', where: '0 m', text: 'V přízemí. Kamna z roku 1903 topí dodnes, večer tu můžete sedět, jak dlouho chcete.' },
      { name: 'Sauna', where: '14 schodů', text: 'Finská, pro čtyři. Jednou za pobyt ji máte v ceně, ochladíte se ve sněhu za dveřmi.' },
      { name: 'Lyžárna a kolárna', where: '5 m', text: 'Zamykací, u zadních dveří. Vysoušeč na osm párů bot, stojan na kola a hadice na umytí.' },
      { name: 'Zahrada s ohništěm', where: '20 m', text: 'Stůl, lavice, ohniště a dřevo k tomu. Louka kolem domu je naše.' },
      { name: 'Dětské hřiště', where: '30 m', text: 'Houpačka a pískoviště, v zimě kopeček na boby hned za domem.' },
      { name: 'Psi jsou vítáni', where: 'všude', text: 'Do všech pokojů za 150 Kč na noc. Misku a deku máme.' },
    ],
    trips: {
      heading: 'Šest tipů do devíti kilometrů ode dveří',
      photos: [{ image: 'hreben', caption: '' }, { image: 'rozhledna', caption: '' }, { image: 'most', caption: '' }],
    },
    tripItems: {
      slope: { text: 'Čtyřsedačka, modré i červené sjezdovky, dětský park a půjčovna. Deset minut pěšky s lyžemi na rameni.' },
      tower: { text: 'Dřevěná věž v 991 metrech. Za jasného dne je vidět Sněžka i Králický Sněžník. Hodinu pěšky lesní cestou.' },
      pool: { text: 'Přírodní koupaliště s travnatou pláží, skluzavkou a stánkem. V červenci má voda kolem 21 stupňů.' },
    },
    reviews: { heading: 'Co říkají hosté' },
    gallery: {
      photos: [
        { image: 'dumDalka', caption: 'Vřesovka od silnice na Zakletý' }, { image: 'zahrada', caption: 'Ohniště a hřiště za domem' },
        { image: 'snidane', caption: 'Snídaně od 8 do 10' }, { image: 'sauna', caption: 'Sauna pro čtyři' },
      ],
      moreLabel: 'fotografií v celé galerii',
    },
    hosts: { eyebrow: 'Hostitelé' },
    directions: {
      heading: 'Cesta k nám',
      placeLabel: 'Odtud měříme',
      carRoutes: [
        { place: 'Praha', distance: '170 km', time: '', note: 'po D11, asi 2 h 20 min' },
        { place: 'Hradec Králové', distance: '62 km', time: '', note: 'odtud 1 h 10 min, z Brna sem 1 h 40 min' },
        { place: 'Rychnov nad Kněžnou', distance: '24 km', time: '', note: 'poslední supermarket a pumpa' },
        { place: 'Rokytnice v Orl. horách', distance: '7 km', time: '', note: 'na náměstí doleva na Říčky' },
      ],
      carNote: 'U kostela doleva a 400 m do kopce. Parkujete u domu, v zimě stačí zimní pneumatiky.',
      trainSteps: [
        { title: 'Hradec Králové hl. n.', value: '1 h 50 min', note: 'osobní vlak, přestup v Doudlebech nad Orlicí' },
        { title: 'Rokytnice v Orl. horách', value: '12 min', note: 'autobus navazuje na vlak, v zimě i skibus zdarma' },
        { title: 'Říčky, střed', value: '400 m', note: 'od zastávky pěšky do kopce' },
      ],
      trainNote: 'S kufry zavolejte, v Rokytnici vás vyzvedneme.',
    },
    enquiry: { heading: 'Zeptejte se, jestli je volno', adviceLabel: 'Poraďte mi', moreRooms: [] },
    roomItems: {
      jerabina: { summary: 'Malý pokoj pod střechou s oknem na louku a na Zakletý. Pro dva, kteří chtějí být hlavně venku.' },
      boruvka: { summary: 'Pro rodiče s dítětem nebo tři kamarády. Dětskou postýlku přidáme zdarma, lyžařské věci se vejdou do velké skříně.' },
      arnika: { summary: 'Ložnice a obývací pokoj s kuchyňským koutem. Uvaříte si sami, a když se nechce, je tu večeře od Hany.' },
      mech: { summary: 'Velký apartmán pro dvě rodiny nebo partu. Večer se sejdete u kamen a u stolu pro šest, ráno je z balkonu vidět hřeben.' },
    },
  },
}
