// Every Czech text of the Realty template, in one place: the website's own words (what is not
// content: "Hledat", "Zobrazeno 7 z 23 nemovitostí", the anchors of the sections, the labels
// each look sets in its own way) and the demo content the seed puts in (with what a look's
// design words differently: `demoByLook`). Another language is a file beside this one with the
// same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

type Deal = 'sale' | 'rent'
type Kind = 'flat' | 'house' | 'cottage' | 'plot' | 'commercial'

/** "13 500 Kč", "6 mil. Kč" … the steps of a "price up to" choice, written the look's way. */
type MaxOf = (n: number, deal: Deal) => string

export interface Words extends KitWords {
  /** The addresses of the sections on a page (`/#nabidka`), by block type, and of the valuation form. */
  anchors: Record<'listings' | 'detail' | 'sellers' | 'sold' | 'agents' | 'areas' | 'contact' | 'valuation', string>
  /** The address of the privacy page. */
  privacyUrl: string
  deal: Record<Deal, string>
  kind: Record<Kind, string>
  /** The label on a listing's photograph ('none' has none). */
  state: Record<'none' | 'new' | 'reserved' | 'sold', string>
  /** The filter chips by their ids (see CHIPS in app/utils/site.ts). */
  chips: Record<'all' | 'sale' | 'rent' | 'flat' | 'houses' | 'plot' | 'commercial', string>
  /** "2. ze 3" and "2. patro". */
  floorOf: (floor: number, total: number) => string
  floorN: (floor: number) => string
  /** The rows of a property's table of parameters. */
  params: { layout: string; usable: string; plot: string; land: string; landLower: string; storeys: string; floor: string; ownership: string; energy: string; parking: string }
  katastr: {
    agency: string
    toTop: (name: string) => string
    searchLabel: string; want: string; dealLabel: string; deals: Record<Deal, string>
    kindLabel: string; kinds: Record<Kind, string>
    placeLabel: string; anywhere: (town: string) => string
    priceLabel: string; noLimit: string; maxOf: MaxOf; go: string
    planKey: string; cadastre: (town: string) => string
    chipsLabel: string
    shownAll: (n: number, total: number) => string; shownSome: (n: number) => string; all: (total: number) => string
    nothing: string
    watchdogLabel: string; watchdogPlaceholder: string
    no: (code: string) => string
    facts: { layout: string; area: string; land: string; floor: string }
    sells: Record<Deal, string>; book: string; fullDetail: string; viewings: (when: string) => string; back: string
    sep: string
    valuation: { address: string; area: string }
    messagePlaceholder: string; consent: [string, string, string]
    address: string; open: string
    town: string; around: string; onRequest: string
    offer: string; operator: string; companyId: string; vatId: string; register: string
    map: {
      label: string
      rivers: { otava: string; vltava: string; blanice: string; lomnice: string }
      refs: Array<{ x: number; y: number; anchor: 'start' | 'middle' | 'end'; lines: string[] }>
      keyOffer: string; keyRequest: string; north: string
    }
  }
  cedule: {
    agency: string
    toTop: (name: string) => string
    /** After the opening's line above the heading: "… / 23 nemovitostí v nabídce". */
    inOffer: (total: number) => string
    fresh: string; thisWeek: (n: number) => string; perMonth: string
    /** The opening hours as the phone's menu writes them. */
    hours: (text: string) => string
    searchLabel: string; dealLabel: string; deals: Record<Deal, string>
    kindLabel: string; kinds: Record<Kind, string>
    placeLabel: string; anywhere: (town: string) => string
    priceLabel: string; noLimit: string; maxOf: MaxOf; go: string
    chipsLabel: string
    shownAll: (n: number, total: number) => string; shownSome: (n: number) => string; all: (total: number) => string
    nothing: string
    watchdogLabel: string; watchdogPlaceholder: string
    no: (code: string) => string
    facts: { land: string; floor: (n: number) => string }
    sells: Record<Deal, string>; book: string; fullDetail: string; viewings: (when: string) => string; back: string
    sep: string
    usable: string
    valuation: { address: string; area: string }
    messagePlaceholder: string; consent: [string, string, string]
    address: string; open: string; viewingsRow: string
    offer: string; operator: string; companyId: string; vatId: string
  }
  rozsviceno: {
    toTop: (name: string) => string
    rather: string; hours: (text: string) => string
    iSearch: string; searchLabel: string; kindLabel: string; kinds: Record<Kind, string>
    dealLabel: string; deals: Record<Deal, string>; placeLabel: string; anywhere: (townIn: string) => string
    priceLabel: string; maxOf: (n: number, deal: Deal) => string; noLimit: string; go: string
    inOffer: (total: number, fresh: number) => string
    chipsLabel: string
    shownAll: (n: number, total: number) => string; shownSome: (n: number) => string; all: (total: number) => string
    nothing: string
    watchdogLabel: string; watchdogPlaceholder: string
    perMonth: string; sep: string
    facts: { land: string; floor: (n: number) => string }
    sells: Record<Deal, string>; book: string; fullDetail: string; viewings: (when: string) => string; back: string
    sticker: (kind: string, layout: string) => string
    keytag: (duration: string) => string
    valuation: { address: string; area: string }
    messagePlaceholder: string; consent: [string, string, string]
    address: string; open: string
    offer: string; operator: string; companyId: string; vatId: string; register: string
    /** A count in words for "tři nové tento týden". */
    newCount: (n: number) => string
  }
}

const czMax: MaxOf = (n) => `${new Intl.NumberFormat('cs-CZ').format(n).replace(/\s/g, '\u00A0')}\u00A0Kč`

const milKc: MaxOf = (n, deal) => (deal === 'rent' || n < 1_000_000 ? czMax(n, deal) : `${String(n / 1_000_000).replace('.', ',')}\u00A0mil.\u00A0Kč`)

export const words: Words = {
  ...KIT_WORDS.cs,
  anchors: { listings: 'nabidka', detail: 'detail', sellers: 'prodat', sold: 'prodano', agents: 'makleri', areas: 'kde', contact: 'kontakt', valuation: 'odhad' },
  privacyUrl: '/ochrana-osobnich-udaju',
  deal: { sale: 'Prodej', rent: 'Pronájem' },
  kind: { flat: 'Byt', house: 'Dům', cottage: 'Chalupa', plot: 'Pozemek', commercial: 'Komerční' },
  state: { none: '', new: 'Novinka', reserved: 'Rezervováno', sold: 'Prodáno' },
  chips: { all: 'Vše', sale: 'Prodej', rent: 'Pronájem', flat: 'Byty', houses: 'Domy', plot: 'Pozemky', commercial: 'Komerční' },
  // ("ze" before 2, 3, 4, 6, 7…: "2. ze 3", "7. z 8")
  floorOf: (floor, total) => `${floor}. ${[2, 3, 4, 6, 7, 12, 13, 14, 16, 17].includes(total) ? 'ze' : 'z'} ${total}`,
  floorN: (floor) => `${floor}. patro`,
  params: { layout: 'Dispozice', usable: 'Užitná plocha', plot: 'Plocha pozemku', land: 'Pozemek', landLower: 'pozemek', storeys: 'Podlaží', floor: 'Patro', ownership: 'Vlastnictví', energy: 'Energetická třída', parking: 'Parkování' },
  defaultName: 'Realitní kancelář',

  // ── Katastr ──
  katastr: {
    agency: 'Realitní kancelář',
    toTop: (name) => `${name}, úvodní stránka`,
    searchLabel: 'Hledání v nabídce', want: 'Chci', dealLabel: 'Prodej nebo pronájem', deals: { sale: 'koupit', rent: 'pronajmout' },
    kindLabel: 'Druh', kinds: { flat: 'Byt', house: 'Rodinný dům', cottage: 'Chalupa, chata', plot: 'Pozemek', commercial: 'Komerční' },
    placeLabel: 'Lokalita', anywhere: (town) => `${town} a okolí`,
    priceLabel: 'Cena do', noLimit: 'bez omezení', maxOf: czMax, go: 'Hledat',
    planKey: 'v nabídce', cadastre: (town) => `k. ú. ${town}`,
    chipsLabel: 'Filtr nabídky',
    shownAll: (n, total) => `Zobrazeno ${n} z\u00A0${total} nemovitostí`,
    shownSome: (n) => `Zobrazeno: ${n} ${n === 1 ? 'nemovitost' : n >= 2 && n <= 4 ? 'nemovitosti' : 'nemovitostí'}`,
    all: (total) => `Všech ${total} nemovitostí`,
    nothing: 'Pro tenhle výběr teď nic nenabízíme. Zkuste jiný druh nebo cenu.',
    watchdogLabel: 'Váš e-mail', watchdogPlaceholder: 'vas@e-mail.example',
    no: (code) => `č. ${code}`,
    facts: { layout: 'Dispozice', area: 'Plocha', land: 'Pozemek', floor: 'Patro' },
    sells: { sale: 'Prodává', rent: 'Pronajímá' }, book: 'Domluvit prohlídku', fullDetail: 'Celý detail',
    viewings: (when) => `Prohlídky ${when}.`, back: 'Zpět na nabídku',
    sep: ' · ',
    valuation: { address: 'Ulice a číslo, obec', area: 'např. 74' },
    messagePlaceholder: 'Napište, co hledáte nebo co prodáváte.', consent: ['Odesláním souhlasíte se ', 'zpracováním osobních údajů', '.'],
    address: 'Adresa', open: 'Otevřeno',
    town: 'Město', around: 'Okolí', onRequest: 'po domluvě',
    offer: 'Nabídka', operator: 'Provozovatel', companyId: 'IČO', vatId: 'DIČ', register: 'Spisová značka',
    map: {
      label: 'Mapa okolí: sídlo kanceláře uprostřed, obce do 25 kilometrů, řeky Otava, Vltava, Blanice a Lomnice',
      rivers: { otava: 'Otava', vltava: 'Vltava', blanice: 'Blanice', lomnice: 'Lomnice' },
      refs: [
        { x: 97, y: 329, anchor: 'middle', lines: ['Strakonice'] },
        { x: 85, y: 174, anchor: 'middle', lines: ['Blatná'] },
        { x: 431, y: 345, anchor: 'start', lines: ['Týn', 'nad Vltavou'] },
        { x: 288, y: 131, anchor: 'start', lines: ['Zvíkov'] },
      ],
      keyOffer: 'právě nabízíme', keyRequest: 'po domluvě', north: 'S',
    },
  },

  // ── Cedule ──
  cedule: {
    agency: 'Realitní kancelář',
    toTop: (name) => `${name}, úvodní stránka`,
    inOffer: (total) => `${total} nemovitostí v\u00A0nabídce`,
    fresh: 'Nově v\u00A0nabídce', thisWeek: (n) => `Tento týden ${n}`, perMonth: '/měs.',
    hours: (text) => text.replace(/,\s*/g, ' / '),
    searchLabel: 'Hledání v nabídce', dealLabel: 'Prodej nebo pronájem', deals: { sale: 'Koupit', rent: 'Pronajmout' },
    kindLabel: 'Co', kinds: { flat: 'Byt', house: 'Dům', cottage: 'Chalupa', plot: 'Pozemek', commercial: 'Komerční' },
    placeLabel: 'Kde', anywhere: (town) => `${town} a okolí`,
    priceLabel: 'Cena do', noLimit: 'bez omezení', maxOf: milKc, go: 'Hledat',
    chipsLabel: 'Filtr nabídky',
    shownAll: (n, total) => `Zobrazeno ${n} z ${total}`, shownSome: (n) => `Zobrazeno ${n}`, all: (total) => `Všech ${total} nemovitostí`,
    nothing: 'Pro tenhle výběr teď nic nenabízíme. Zkuste jiný druh nebo cenu.',
    watchdogLabel: 'Váš e-mail', watchdogPlaceholder: 'vas@e-mail.example',
    no: (code) => `č. ${code}`,
    facts: { land: 'pozemek', floor: (n) => `${n}. patro` },
    sells: { sale: 'Prodává', rent: 'Pronajímá' }, book: 'Domluvit prohlídku', fullDetail: 'Celý detail',
    viewings: (when) => `Prohlídky: ${when}`, back: 'Zpět na nabídku',
    sep: ' / ',
    usable: 'Plocha',
    valuation: { address: 'Ulice a číslo, obec', area: 'např. 74' },
    messagePlaceholder: 'Napište, co hledáte nebo co prodáváte.', consent: ['Odesláním souhlasíte se ', 'zpracováním osobních údajů', '.'],
    address: 'Adresa', open: 'Otevřeno', viewingsRow: 'Prohlídky',
    offer: 'Nabídka', operator: 'Provozovatel', companyId: 'IČO', vatId: 'DIČ',
  },

  // ── Rozsvíceno ──
  rozsviceno: {
    toTop: (name) => `${name}, úvodní stránka`,
    rather: 'Radši si zavoláte?', hours: (text) => `${text}.`,
    iSearch: 'Hledám', searchLabel: 'Hledání v nabídce', kindLabel: 'Druh nemovitosti',
    kinds: { flat: 'byt', house: 'dům', cottage: 'chalupu', plot: 'pozemek', commercial: 'komerční prostor' },
    dealLabel: 'Prodej nebo pronájem', deals: { sale: 'ke koupi', rent: 'k pronájmu' }, placeLabel: 'Lokalita', anywhere: (townIn) => `${townIn} a okolí`,
    priceLabel: 'Cena', maxOf: (n, deal) => `do ${milKc(n, deal)}`, noLimit: 'cena nerozhoduje', go: 'Ukázat nabídky',
    inOffer: (total, fresh) => `${total} nemovitostí${fresh ? `, ${fresh === 1 ? 'jedna nová' : fresh === 2 ? 'dvě nové' : fresh === 3 ? 'tři nové' : fresh === 4 ? 'čtyři nové' : `${fresh} nových`} tento týden` : ''}`,
    chipsLabel: 'Filtr nabídky',
    shownAll: (n, total) => `Vidíte ${n} z\u00A0${total} nemovitostí`,
    shownSome: (n) => `Vidíte ${n} ${n === 1 ? 'nemovitost' : n >= 2 && n <= 4 ? 'nemovitosti' : 'nemovitostí'}`,
    all: (total) => `Všech ${total} nemovitostí`,
    nothing: 'Pro tenhle výběr teď nic nenabízíme. Zkuste jiný druh nebo cenu.',
    watchdogLabel: 'Váš e-mail', watchdogPlaceholder: 'vas@e-mail.example',
    perMonth: 'měsíčně', sep: ', ',
    facts: { land: 'zahrada', floor: (n) => `${n}. patro` },
    sells: { sale: 'Prodává', rent: 'Pronajímá' }, book: 'Domluvit prohlídku', fullDetail: 'Celý detail',
    viewings: (when) => `Prohlídky ${when}.`, back: 'Zpět na nabídku',
    sticker: (kind, layout) => [kind, layout].filter(Boolean).join(' '),
    keytag: (duration) => `za ${duration}`,
    valuation: { address: 'Ulice a číslo, obec', area: 'např. 74' },
    messagePlaceholder: 'Napište, co hledáte nebo co prodáváte.', consent: ['Odesláním souhlasíte se ', 'zpracováním osobních údajů', '.'],
    address: 'Adresa', open: 'Otevřeno',
    offer: 'Nabídka', operator: 'Provozovatel', companyId: 'IČO', vatId: 'DIČ', register: 'Spisová značka',
    newCount: (n) => String(n),
  },
}

// ── the demo content: the fictional agency Práh from Písek, three agents and seven properties
//    in the town and its surroundings. The street, the people, the phone numbers and the
//    addresses are invented; the photographs are properties in a South Bohemian town. ──
// Worded as the first look's design (Katastr); `demoByLook` below words the others.

interface ListingDemo {
  title: string; shortLine: string; deal: Deal; kind: Kind; state: 'none' | 'new' | 'reserved' | 'sold'; code: string; published: string; featured: boolean
  price: number; priceUnit: string; priceNote: string
  layout: string; area: number | null; landArea: number | null; floor: number | null; floorsTotal: number | null
  town: string; townIn: string; district: string; street: string
  storeys: string; ownership: string; energyClass: string; parking: string
  extras: Array<{ label: string; value: string }>
  summary: string; viewings: string
  /** The agent's key in `demo.agents.items`, and the photographs' keys in seed/photos.ts (the first is the card's). */
  agent: string; photos: string[]
}

/** The listings, as one set of facts; each look words a few of them its own way (see the patches below). */
const listing: Record<'house' | 'brick' | 'panel' | 'plot' | 'newbuild' | 'cottage' | 'terraced', ListingDemo> = {
  house: {
    title: 'Rodinný dům 5+kk se zahradou', shortLine: 'Rodinný dům 5+kk, Písek – Hradiště', deal: 'sale', kind: 'house', state: 'new', code: '2417', published: '2026-11-19T23:00:00Z', featured: true,
    price: 8_490_000, priceUnit: '', priceNote: 'Včetně provize a právního servisu.',
    layout: '5+kk', area: 164, landArea: 612, floor: null, floorsTotal: null,
    town: 'Písek', townIn: 'v Písku', district: 'Hradiště', street: 'ulice U Hrušky',
    storeys: '2 nadzemní, částečně podsklepeno', ownership: 'osobní', energyClass: 'C – úsporná', parking: 'garáž a stání na pozemku',
    extras: [],
    summary: 'Dům ze 70. let po celkové rekonstrukci v roce 2021: nová střecha, okna, elektřina i rozvody vody, tepelné čerpadlo a krbová kamna. V přízemí kuchyň s jídelnou a východem na krytou terasu, nahoře čtyři pokoje a koupelna. Do centra je to deset minut na kole, škola i školka jsou pěšky.',
    viewings: 've středu 25. 11. odpoledne a v sobotu 28. 11. dopoledne',
    agent: 'martina', photos: ['houseDusk', 'houseLiving', 'houseKitchen', 'houseTerrace'],
  },
  brick: {
    title: 'Byt 2+1 v cihlovém domě', shortLine: 'Byt 2+1 v cihlovém domě, Písek', deal: 'rent', kind: 'flat', state: 'new', code: '2419', published: '2026-11-20T23:00:00Z', featured: false,
    price: 13_500, priceUnit: 'měsíčně + energie', priceNote: 'Kauce ve výši dvou nájmů.',
    layout: '2+1', area: 61, landArea: null, floor: 2, floorsTotal: 3,
    town: 'Písek', townIn: 'v Písku', district: 'Budějovické Předměstí', street: 'ulice Mlýnská stezka',
    storeys: '', ownership: 'osobní', energyClass: 'D – méně úsporná', parking: 'stání před domem',
    extras: [],
    summary: 'Světlý byt ve třetině domu ze 30. let: vysoké stropy, původní parkety a špaletová okna do klidného dvora. Kuchyň je nová, koupelna po rekonstrukci. Hned za rohem je obchod, zastávka i park u řeky.',
    viewings: 've čtvrtek 26. 11. po 16. hodině',
    agent: 'tomas', photos: ['flatBrick'],
  },
  panel: {
    title: 'Byt 3+1 s lodžií po rekonstrukci', shortLine: '', deal: 'sale', kind: 'flat', state: 'reserved', code: '2409', published: '2026-11-12T23:00:00Z', featured: false,
    price: 4_290_000, priceUnit: '', priceNote: 'Včetně provize a právního servisu.',
    layout: '3+1', area: 74, landArea: null, floor: 7, floorsTotal: 8,
    town: 'Písek', townIn: 'v Písku', district: 'sídliště Jih', street: 'ulice Tkalcovská věž',
    storeys: '', ownership: 'osobní', energyClass: 'C – úsporná', parking: 'volné stání před domem',
    extras: [],
    summary: 'Panelový byt v 7. patře po celkové rekonstrukci: nová jádra, rozvody, podlahy i okna. Z lodžie je výhled na zahrady a lesy za sídlištěm. Ve vchodu je výtah, v domě je nové zateplení.',
    viewings: '',
    agent: 'tomas', photos: ['flatPanel'],
  },
  plot: {
    title: 'Stavební pozemek na kraji obce', shortLine: 'Stavební pozemek 1\u00A0024\u00A0m², Čížová', deal: 'sale', kind: 'plot', state: 'new', code: '2415', published: '2026-11-17T23:00:00Z', featured: false,
    price: 2_350_000, priceUnit: '2 295 Kč/m²', priceNote: 'Včetně provize a právního servisu.',
    layout: '', area: null, landArea: 1024, floor: null, floorsTotal: null,
    town: 'Čížová', townIn: 'v Čížové', district: '', street: '',
    storeys: '', ownership: 'osobní', energyClass: '', parking: '',
    extras: [{ label: 'Druh', value: 'stavební' }, { label: 'Sítě', value: 'na hranici' }],
    summary: 'Rovinatý pozemek na okraji obce, z jedné strany lemovaný asfaltovou cestou. Elektřina, voda a plyn jsou na hranici, kanalizace se řeší jímkou. Územní plán dovoluje rodinný dům do dvou podlaží.',
    viewings: 'po domluvě kdykoli',
    agent: 'lenka', photos: ['plot'],
  },
  newbuild: {
    title: 'Byt 2+kk s balkonem v novostavbě', shortLine: '', deal: 'rent', kind: 'flat', state: 'none', code: '2412', published: '2026-11-10T23:00:00Z', featured: false,
    price: 15_900, priceUnit: 'měsíčně + energie', priceNote: 'Kauce ve výši dvou nájmů.',
    layout: '2+kk', area: 52, landArea: null, floor: 3, floorsTotal: 4,
    town: 'Písek', townIn: 'v Písku', district: 'Pražské Předměstí', street: 'ulice Zelná',
    storeys: '', ownership: 'osobní', energyClass: 'B – velmi úsporná', parking: 'garážové stání za příplatek',
    extras: [],
    summary: 'Byt v novostavbě z roku 2023: otevřená kuchyň s obývacím pokojem, francouzské okno na balkon se skleněným zábradlím a sklep v domě. Vytápí se z městské kotelny.',
    viewings: 'v pondělí a ve čtvrtek po 17. hodině',
    agent: 'tomas', photos: ['flatNewbuild'],
  },
  cottage: {
    title: 'Chalupa 3+1 se stodolou', shortLine: '', deal: 'sale', kind: 'cottage', state: 'none', code: '2398', published: '2026-10-30T23:00:00Z', featured: false,
    price: 3_190_000, priceUnit: '', priceNote: 'Včetně provize a právního servisu.',
    layout: '3+1', area: 96, landArea: 840, floor: null, floorsTotal: null,
    town: 'Kestřany', townIn: 'v Kestřanech', district: '', street: '',
    storeys: 'přízemí a půda', ownership: 'osobní', energyClass: 'G – mimořádně nehospodárná', parking: 'na dvoře',
    extras: [],
    summary: 'Hospodářské stavení s novou střechou a původními trámy, stodola se dá přestavět. Vytápí se kamny, voda je z vlastní studny. Na dvoře roste ořešák a za stodolou začíná louka.',
    viewings: 'v sobotu 28. 11. dopoledne',
    agent: 'lenka', photos: ['cottage'],
  },
  terraced: {
    title: 'Řadový dům 4+1 s garáží', shortLine: '', deal: 'sale', kind: 'house', state: 'sold', code: '2385', published: '2026-09-28T22:00:00Z', featured: false,
    price: 5_650_000, priceUnit: '', priceNote: '',
    layout: '4+1', area: 118, landArea: 286, floor: null, floorsTotal: null,
    town: 'Protivín', townIn: 'v Protivíně', district: '', street: '',
    storeys: '2 nadzemní', ownership: 'osobní', energyClass: 'D – méně úsporná', parking: 'garáž',
    extras: [],
    summary: 'Řadový dům z osmdesátých let v klidné ulici, s garáží v přízemí a malou předzahrádkou. Prodáno, podobný dům hledejte u nás v nabídce brzy znovu.',
    viewings: '',
    agent: 'martina', photos: ['terraced'],
  },
}
const asList = (l: Record<string, ListingDemo>): ListingDemo[] => Object.values(l)

export const demo = {
  settings: {
    siteName: 'Práh',
    descriptor: 'reality',
    town: 'Písek',
    townIn: 'v Písku',
    street: 'Kohoutova 14',
    postcode: '397 01',
    // (contacts that are not anybody's: numbers no phone has (Czech numbers do not start with 1),
    // addresses that lead nowhere, a street the town does not have)
    phone: '123 456 701',
    email: 'info@prah.example',
    hours: 'po–čt 9–17, pá 9–14',
    offerTotal: 23,
    ctaLabel: 'Odhad ceny zdarma',
    about: 'Realitní kancelář pro Písek a okolí. Prodej, pronájem a odhady bytů, domů a pozemků od roku 2012.',
    company: 'Reality Práh s.r.o.',
    companyId: '12345678',
    vatId: 'CZ12345678',
    register: 'C 12345, Krajský soud v Českých Budějovicích',
    legalNote: 'Realitní zprostředkovatel podle zákona č.\u00A039/2020\u00A0Sb.',
    planStreet: 'Kohoutova',
    planLane: 'Sviští',
    metaDescription: 'Realitní kancelář v Písku. Prodej a pronájem bytů, rodinných domů a pozemků na Písecku, odhad tržní ceny zdarma do 48 hodin.',
  },
  // The menus: a link is a label and the section of the home page it leads to (a key of `anchors`).
  menu: {
    main: [
      { label: 'Nabídka', to: 'listings' }, { label: 'Chci prodat', to: 'sellers' }, { label: 'Prodáno', to: 'sold' },
      { label: 'Makléři', to: 'agents' }, { label: 'Kontakt', to: 'contact' },
    ],
    // (the footer's column of links into the offer: each is the list of properties with a filter set)
    offer: [
      { label: 'Byty na prodej', url: '/nabidka?deal=sale&kind=flat' }, { label: 'Domy a chalupy', url: '/nabidka?kind=houses' },
      { label: 'Pozemky', url: '/nabidka?kind=plot' }, { label: 'Pronájmy', url: '/nabidka?deal=rent' },
    ],
  },
  home: { title: 'Úvod' },
  offerPage: { title: 'Nabídka' },
  opening: {
    eyebrow: 'Písek · od roku 2012',
    heading: 'Byty, domy a pozemky v Písku a okolí',
    text: 'Jsme tři makléři, kteří na Písecku žijí. Každou nemovitost v nabídce jsme sami prošli, nechali vyfotit a prověřili v katastru.',
    imageCaption: 'Písek, pohled od Hradiště',
    primaryLabel: 'Celá nabídka', secondaryLabel: 'Chci prodat nemovitost',
    quickLabel: 'Často hledáte:',
    quickLinks: [
      { label: 'byty v Písku', url: '/nabidka?kind=flat&town=Písek' }, { label: 'domy do 6 mil. Kč', url: '/nabidka?kind=houses&max=6000000' },
      { label: 'pronájmy', url: '/nabidka?deal=rent' }, { label: 'stavební pozemky', url: '/nabidka?kind=plot' },
    ],
  },
  listings: {
    eyebrow: 'Aktuální nabídka',
    heading: 'Právě prodáváme a pronajímáme',
    watchdogEyebrow: 'Hlídací pes',
    watchdogHeading: 'Nenašli jste? Nové nemovitosti posíláme zájemcům o týden dřív než na portály.',
    watchdogText: 'Napíšeme jen tehdy, když přibude něco, co hledáte.',
    watchdogButton: 'Hlídat nabídku',
    watchdogSent: 'Děkujeme. Napíšeme, jakmile přibude něco, co hledáte.',
    items: asList(listing),
  },
  detail: {
    eyebrow: 'Z nabídky podrobně',
    caption: 'Obývací pokoj, kuchyň s jídelnou, terasa',
    moreLabel: 'všech 24 fotografií a půdorys',
    badge: '',
  },
  sellers: {
    eyebrow: 'Pro prodávající',
    heading: 'Prodáváte? Postaráme se o všechno od odhadu po předání klíčů.',
    text: '',
    steps: [
      { title: 'Odhad ceny', text: 'Přijedeme, projdeme nemovitost a do dvou dnů pošleme odhad. Vycházíme ze skutečných prodejů v okolí, ne z cen v inzerátech.' },
      { title: 'Příprava a fotografie', text: 'Poradíme, co uklidit a co se vyplatí opravit. Fotí profesionální fotograf, přidáme půdorys a krátké video.' },
      { title: 'Právní servis', text: 'Rezervační i kupní smlouvu píše advokátka. Peníze jdou přes advokátní úschovu a návrh na katastr podáme za vás.' },
      { title: 'Prohlídky', text: 'Zájemce si předem prověříme a provádíme je sami, i večer a v sobotu. Vy jen víte, kdy nemáte být doma.' },
    ],
    commission: 'Provize 4 % z prodejní ceny včetně DPH. Jsou v ní fotografie, inzerce, advokátka i úschova a platíte ji až z kupní ceny.',
    formHeading: 'Kolik stojí moje nemovitost?',
    formText: 'Odhad je zdarma a k prodeji vás nezavazuje. Ozveme se do druhého pracovního dne.',
    formButton: 'Chci odhad zdarma',
  },
  sold: {
    eyebrow: 'Prodáno',
    heading: 'Co jsme naposledy prodali a jak dlouho to trvalo',
    text: 'Doba od zveřejnění inzerátu po podpis rezervační smlouvy.',
    items: [
      { what: 'Byt 2+1', place: 'Písek – Portyč', duration: '17 dní', quote: 'Byt po babičce jsme chtěli prodat rychle, ale ne pod cenou. Pan Koubek ho nechal vymalovat a nafotit a hned první víkend přišlo jedenáct zájemců.', client: 'Kateřina a Jan Peškovi' },
      { what: 'Rodinný dům', place: 'Putim', duration: '6 týdnů', quote: 'Bydlíme v Brně a dům po rodičích jsme řešili na dálku. Paní Šímová zařídila vyklizení, odhad pro dědictví i katastr. Do Písku jsme jeli dvakrát.', client: 'Ivana Hrubá' },
      { what: 'Stavební pozemek', place: 'Záhoří', duration: '3 měsíce', quote: 'K pozemku nevedla cesta zapsaná v katastru. Paní Vávrová nejdřív dojednala s obcí věcné břemeno a teprve potom začala prodávat.', client: 'Miroslav Toman' },
    ],
  },
  agents: {
    eyebrow: 'Makléři',
    heading: 'Komu budete volat',
    text: 'Tři lidé, žádná centrála. Kdo vaši nemovitost převezme, ten ji taky prodá a předá.',
    items: [
      { key: 'martina', name: 'Martina Šímová', role: 'Zakladatelka · rodinné domy', text: 'V Písku prodává od roku 2012. Nejčastěji domy a nemovitosti z dědictví.', phone: '123 456 702', email: 'simova@prah.example' },
      { key: 'tomas', name: 'Tomáš Koubek', role: 'Byty a pronájmy', text: 'Dřív stavební technik. Na prohlídce si všimne i toho, co v inzerátu není.', phone: '123 456 703', email: 'koubek@prah.example' },
      { key: 'lenka', name: 'Lenka Vávrová', role: 'Pozemky a chalupy', text: 'Vyrostla v Kestřanech. Má na starosti venkov od Protivína po Milevsko.', phone: '123 456 704', email: 'vavrova@prah.example' },
    ],
  },
  areas: {
    eyebrow: 'Kde působíme',
    heading: 'Písek a pětadvacet kilometrů okolo',
    text: 'Dál nejezdíme. Chceme znát ulici, sousedy i to, za kolik se vedle prodávalo loni. U každého místa je počet nemovitostí, které tam právě nabízíme.',
    // (Katastr lists the parts of the town and the places around, with their own numbers)
    items: [
      { name: 'Centrum a Budějovické Předměstí', group: 'town' as const, count: 5, onRequest: false },
      { name: 'Pražské Předměstí', group: 'town' as const, count: 3, onRequest: false },
      { name: 'Sídliště Jih a Portyč', group: 'town' as const, count: 3, onRequest: false },
      { name: 'Hradiště a Václavské Předměstí', group: 'town' as const, count: 2, onRequest: false },
      { name: 'Smrkovice, Semice, Purkratice', group: 'town' as const, count: 1, onRequest: false },
      { name: 'Protivín', group: 'surroundings' as const, count: 3, onRequest: false },
      { name: 'Čížová, Mirotice, Čimelice', group: 'surroundings' as const, count: 2, onRequest: false },
      { name: 'Kestřany a Putim', group: 'surroundings' as const, count: 2, onRequest: false },
      { name: 'Milevsko a Záhoří', group: 'surroundings' as const, count: 2, onRequest: false },
      { name: 'Albrechtice nad Vltavou, Vodňany', group: 'surroundings' as const, count: 0, onRequest: true },
    ],
    // The towns on Katastr's drawn map (a grid of 520 × 500 points; the labels are placed where the design has them).
    towns: [
      { name: 'Písek', x: 250, y: 262, kind: 'main' as const },
      { name: 'Protivín', x: 296, y: 368, kind: 'offer' as const },
      { name: 'Čížová', x: 217, y: 216, labelX: 207, labelY: 221, anchor: 'end' as const, kind: 'offer' as const },
      { name: 'Kestřany', x: 204, y: 298, labelX: 196, labelY: 291, anchor: 'end' as const, kind: 'offer' as const },
      { name: 'Putim', x: 234, y: 309, labelX: 226, labelY: 327, anchor: 'end' as const, kind: 'offer' as const },
      { name: 'Mirotice', x: 181, y: 149, labelX: 172, labelY: 141, anchor: 'end' as const, kind: 'offer' as const },
      { name: 'Milevsko', x: 382, y: 126, labelX: 392, labelY: 131, anchor: 'start' as const, kind: 'offer' as const },
      { name: 'Záhoří', x: 292, y: 228, labelX: 292, labelY: 216, anchor: 'middle' as const, kind: 'offer' as const },
      { name: 'Čimelice', x: 201, y: 112, labelX: 191, labelY: 117, anchor: 'end' as const, kind: 'request' as const },
      { name: 'Albrechtice nad Vltavou', x: 347, y: 315, labelX: 337, labelY: 313, anchor: 'end' as const, kind: 'request' as const },
      { name: 'Vodňany', x: 268, y: 416, labelX: 278, labelY: 421, anchor: 'start' as const, kind: 'request' as const },
    ],
  },
  contact: {
    eyebrow: 'Kontakt',
    heading: 'Zastavte se v Kohoutově ulici',
    text: 'Kancelář máme dvě minuty od hlavního náměstí. Prohlídky a schůzky domlouváme i večer a o víkendu.',
    viewings: '',
    topics: ['Chci koupit nemovitost', 'Hledám pronájem', 'Chci prodat nebo pronajmout', 'Mám zájem o prohlídku', 'Něco jiného'],
  },
  // The two pages of legal text the footer links to.
  legal: {
    privacy: {
      title: 'Ochrana osobních údajů',
      intro: 'Ukázkový text. Před zveřejněním popište, jak s údaji klientů nakládáte vy.',
      parts: [
        { heading: 'Jaké údaje zpracováváme', text: 'Z formulářů máme vaše jméno, telefon nebo e-mail a zprávu. Když nás pověříte prodejem nebo pronájmem, zpracováváme i údaje o nemovitosti a o jejím vlastníkovi.' },
        { heading: 'Proč údaje potřebujeme', text: 'Abychom vám odpověděli, domluvili prohlídku, připravili smlouvu a mohli vám napsat, když přibude nemovitost, kterou hledáte.' },
        { heading: 'Jak dlouho je uchováváme', text: 'Poptávku bez pokračování mažeme do roku. Smlouvy a doklady o zprostředkování uchováváme po dobu, kterou nám ukládá zákon.' },
        { heading: 'Cookies', text: 'Web si pamatuje jen to, co potřebuje k provozu. Měření návštěvnosti bez osobních údajů se zapíná až po vašem souhlasu v liště dole.' },
      ],
    },
    consumer: {
      title: 'Informace pro spotřebitele',
      intro: 'Ukázkový text. Před zveřejněním sem vložte informace, které musí realitní zprostředkovatel poskytnout.',
      parts: [
        { heading: 'Provizní smlouva', text: 'Provize činí 4 % z prodejní ceny včetně DPH a platí se až z kupní ceny. Jsou v ní fotografie, inzerce, právní servis i advokátní úschova.' },
        { heading: 'Odhad ceny', text: 'Odhad ceny nemovitosti je zdarma a k ničemu vás nezavazuje.' },
        { heading: 'Stížnosti', text: 'Máte-li výhrady k naší práci, napište nám na adresu kanceláře. Odpovíme do třiceti dnů.' },
      ],
    },
    menu: [{ label: 'Ochrana osobních údajů', to: 'privacy' }, { label: 'Cookies', to: 'privacy', hash: 'cookies' }, { label: 'Informace pro spotřebitele', to: 'consumer' }],
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    town: 'Pohled na město s řekou a kamenným mostem',
    houseDusk: 'Rodinný dům se zahradou v Písku-Hradišti za soumraku',
    houseLiving: 'Obývací pokoj s krbovými kamny a oknem do zahrady',
    houseKitchen: 'Kuchyň s dubovou deskou a jídelním stolem pro šest',
    houseTerrace: 'Krytá terasa s pergolou a zahrada s jabloní',
    flatPanel: 'Obývací pokoj zrekonstruovaného bytu 3+1 s lodžií',
    flatBrick: 'Pokoj s parketami a špaletovými okny v cihlovém domě',
    flatNewbuild: 'Kuchyň s obývacím pokojem v novostavbě, výstup na balkon',
    cottage: 'Chalupa s červenou střechou a stodolou v Kestřanech',
    terraced: 'Řadový dům s garáží v Protivíně',
    plot: 'Stavební pozemek na okraji obce Čížová',
    martina: 'Martina Šímová',
    tomas: 'Tomáš Koubek',
    lenka: 'Lenka Vávrová',
  },
}

// What a look's design words differently from the texts above: a site made in that look gets
// these (the seed is told the look). Lists are replaced whole.

/** The listings with a few of them worded another way (by their place in the list above). */
const patched = (patches: Record<number, Partial<ListingDemo>>): ListingDemo[] => asList(listing).map((l, i) => ({ ...l, ...patches[i] }))
/** The agents with what each does worded in the look's way. */
const agentsDo = (roles: [string, string, string]) => demo.agents.items.map((a, i) => ({ ...a, role: roles[i]! }))
const stepsOf = (items: Array<[string, string]>) => items.map(([title, text]) => ({ title, text }))
/** The places as one list of towns with their own numbers (Cedule and Rozsvíceno write one list, not two columns). */
const place = (name: string, count: number, onRequest = false) => ({ name, group: 'town' as const, count, onRequest })

export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  cedule: {
    settings: { ctaLabel: 'Chci prodat', about: '' },
    menu: { main: [
      { label: 'Nabídka', to: 'listings' }, { label: 'Prodáno', to: 'sold' }, { label: 'Pro prodávající', to: 'sellers' },
      { label: 'Makléři', to: 'agents' }, { label: 'Kontakt', to: 'contact' },
    ] },
    opening: {
      eyebrow: 'Realitní kancelář / Písek',
      heading: 'Písecko na\u00A0prodej. I k pronájmu.',
      text: 'Byty, domy a pozemky v Písku a do 25 km okolo. Každý jsme prošli, vyfotili a prověřili v katastru.',
      imageCaption: '', primaryLabel: '', secondaryLabel: '', quickLabel: '', quickLinks: [],
    },
    listings: {
      eyebrow: '', heading: 'Nabídka',
      watchdogEyebrow: 'Hlídací pes', watchdogHeading: 'Nenašli jste? Pošleme vám to dřív než na portály.', watchdogText: '', watchdogButton: 'Hlídat',
      items: patched({
        0: {
          storeys: '2 nadzemní, částečný suterén', parking: 'garáž + stání na pozemku', priceNote: 'Včetně provize a právního servisu',
          summary: 'Dům ze 70. let po celkové rekonstrukci v roce 2021: nová střecha, okna, elektřina i rozvody vody, tepelné čerpadlo a krbová kamna. V přízemí kuchyň s jídelnou a východem na krytou terasu, nahoře čtyři pokoje a koupelna. Do centra deset minut na kole, škola i školka pěšky.',
          viewings: 'st 25. 11. odpoledne, so 28. 11. dopoledne',
        },
      }),
    },
    detail: { eyebrow: '', caption: '', moreLabel: 'Celý detail', badge: '+ 21 fotek' },
    sellers: {
      eyebrow: 'Pro prodávající',
      heading: 'Prodáváte? Cenu vám řekneme do 48 hodin.',
      steps: stepsOf([
        ['Odhad ceny', 'Přijedeme, projdeme nemovitost a do dvou dnů pošleme odhad. Podle skutečných prodejů v okolí, ne podle inzerátů.'],
        ['Příprava a fotky', 'Poradíme, co uklidit a co se vyplatí opravit. Fotí profesionální fotograf, přidáme půdorys a video.'],
        ['Právní servis', 'Smlouvy píše advokátka, peníze jdou přes advokátní úschovu a návrh na katastr podáme za vás.'],
        ['Prohlídky', 'Zájemce si prověříme a provádíme je sami, i večer a v sobotu. Vy jen víte, kdy nemáte být doma.'],
      ]),
      commission: '*Provize 4 % včetně DPH.* Platíte ji až z kupní ceny a je v ní všechno výše.',
      formText: 'Odhad je zdarma a k ničemu vás nezavazuje. Ozveme se do druhého pracovního dne.',
    },
    sold: { eyebrow: '', heading: 'Prodáno.', text: 'Tři poslední prodeje a kolik dní uběhlo od inzerátu po podpis rezervační smlouvy.' },
    agents: {
      eyebrow: '', heading: 'Tři lidi. Žádná centrála.', text: 'Kdo vaši nemovitost převezme, ten ji taky prodá a předá. Volejte rovnou jemu.',
      items: agentsDo(['Zakladatelka / rodinné domy', 'Byty a pronájmy', 'Pozemky a chalupy']),
    },
    areas: {
      eyebrow: 'Kde působíme / do 25 km od Písku', heading: 'Kde působíme',
      text: 'Číslo říká, kolik nemovitostí tam právě nabízíme. Dál nejezdíme: chceme znát ulici, sousedy i to, za kolik se vedle prodávalo loni.',
      items: [place('Písek', 14), place('Protivín', 3), place('Čížová', 1), place('Kestřany', 1), place('Putim', 1), place('Mirotice', 1), place('Milevsko', 2), place('Záhoří', 0, true), place('Čimelice', 0, true), place('Vodňany', 0, true)],
    },
    contact: { eyebrow: 'Kontakt', heading: 'Zavolejte. Nebo se stavte.', text: '', viewings: 'i večer a v sobotu' },
  },

  rozsviceno: {
    settings: {
      ctaLabel: 'Odhad zdarma',
      about: 'Tři makléři z Písku. Prodáváme a pronajímáme byty, domy, chalupy a pozemky na Písecku od roku 2012.',
    },
    menu: { main: [
      { label: 'Nabídka', to: 'listings' }, { label: 'Kdo jsme', to: 'agents' }, { label: 'Chci prodat', to: 'sellers' },
      { label: 'Prodáno', to: 'sold' }, { label: 'Kontakt', to: 'contact' },
    ] },
    opening: {
      eyebrow: 'Dobrý den z Písku.', heading: 'Kde chcete mít doma?', text: '',
      imageCaption: '', primaryLabel: '', secondaryLabel: '', quickLabel: '', quickLinks: [],
    },
    listings: {
      eyebrow: 'Aktuální nabídka', heading: 'Co máme zrovna v nabídce',
      watchdogEyebrow: 'Nenašli jste?', watchdogHeading: 'Řekněte nám, co hledáte. Ozveme se dřív, než vyjde inzerát.', watchdogText: '', watchdogButton: 'Hlídat nabídku',
      items: patched({
        0: {
          storeys: '2 nadzemní + sklep', parking: 'garáž + stání', extras: [{ label: 'Rekonstrukce', value: '2021' }],
          summary: 'Dům ze 70. let po celkové rekonstrukci v roce 2021: nová střecha, okna, elektřina i voda, tepelné čerpadlo a krbová kamna. Dole kuchyň s jídelnou a východem na terasu, nahoře čtyři pokoje a koupelna. Do centra deset minut na kole, škola i školka pěšky.',
        },
      }),
    },
    detail: {
      eyebrow: 'Dům týdne', caption: 'Obývací pokoj s kamny, kuchyň s jídelnou a krytá terasa. V detailu je 24 fotografií a půdorys.', moreLabel: 'Celý detail', badge: '',
    },
    sellers: {
      eyebrow: 'Pro ty, kdo prodávají',
      heading: 'Než dáte dům na internet, stavte se na kávu.',
      text: 'Řekneme vám, kolik dnes stojí, co s ním udělat před focením a jak dlouho bude prodej trvat. Zdarma a bez podpisu.',
      steps: stepsOf([
        ['Odhad ceny', 'Projdeme nemovitost a do dvou dnů pošleme odhad. Podle skutečných prodejů v okolí, ne podle inzerátů.'],
        ['Příprava a fotky', 'Poradíme, co uklidit a co se vyplatí opravit. Fotí profesionální fotograf, přidáme půdorys a video.'],
        ['Právní servis', 'Smlouvy píše advokátka, peníze jdou přes advokátní úschovu a návrh na katastr podáme za vás.'],
        ['Prohlídky', 'Zájemce si prověříme a provádíme je sami, i večer a v sobotu. Vy jen víte, kdy nemáte být doma.'],
      ]),
      commission: 'Provize 4 % z prodejní ceny včetně DPH. Je v ní všechno výše a platíte ji až z kupní ceny.',
    },
    sold: { eyebrow: 'Prodáno', heading: 'Klíče už mají noví majitelé', text: 'Tři poslední prodeje a jak dlouho trvaly od inzerátu po rezervační smlouvu.' },
    agents: {
      eyebrow: 'Kdo jsme', heading: 'Tři lidé, kterým můžete zavolat i v sobotu', text: 'Žádná centrála ani call centrum. Kdo vaši nemovitost převezme, ten ji taky prodá a předá klíče.',
      items: agentsDo(['zakladatelka, rodinné domy', 'byty a pronájmy', 'pozemky a chalupy']),
    },
    areas: {
      eyebrow: 'Kde působíme', heading: 'Písek a kam dojedeme do půl hodiny',
      text: 'Dál nejezdíme. Chceme znát ulici, sousedy i to, za kolik se vedle prodávalo loni. Kde se svítí, tam právě něco nabízíme.',
      items: [
        place('Písek', 14), place('Protivín', 3), place('Milevsko', 2), place('Čížová', 1), place('Kestřany', 1), place('Putim', 1), place('Mirotice', 1),
        place('Záhoří', 0, true), place('Čimelice', 0, true), place('Vodňany', 0, true), place('Albrechtice nad Vltavou', 0, true), place('Ražice', 0, true), place('Heřmaň', 0, true),
      ],
    },
    contact: { eyebrow: 'Kontakt', heading: 'Zastavte se, kávu máme dobrou', text: 'Kancelář je dvě minuty od hlavního náměstí. Schůzky a prohlídky domlouváme i večer a o víkendu.' },
  },
}
