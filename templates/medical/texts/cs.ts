// Every Czech text of the Medical template, in one place: the website's own words (what is
// not content: "teď", "Celý týden", the anchors of the sections) and the demo content the seed
// puts in. Another language is a file beside this one with the same two exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export interface Words extends KitWords {
  /** The word between two stretches of a day: "7:00–11:00 a 13:00–15:00". */
  and: string
  /** The skip link at the top of every page. */
  skipToHours: string
  /** The logo's label for screen readers. */
  toTop: (name: string) => string
  /** The phone button's label for screen readers. */
  callAria: (phone: string) => string
  /** "Pondělí" */
  days: Record<DayKey, string>
  /** "po", "út": the days in a short list. */
  daysShort: Record<DayKey, string>
  /** ["út", "čt"] → "(út, čt)" */
  inDays: (days: string[]) => string
  /** "v pondělí", "ve středu" */
  daysIn: Record<DayKey, string>
  /** The months as they stand after a day: "listopadu". */
  months: string[]
  /** "Dnes, středa 25. listopadu" */
  todayDate: (weekday: string, date: number, month: string) => string
  /** "Právě máme otevřeno, dnes do 13:00" */
  openNow: (to: string) => string
  /** "Teď máme zavřeno, otevíráme v 12:00" */
  closedUntil: (from: string) => string
  closedNow: string
  closedWord: string
  closedTag: string
  noHoursToday: string
  tomorrowLead: string
  nextLead: string
  wholeWeek: string
  nowTag: string
  todayTag: string
  accepting: string
  important: string
  whenClosed: string
  homeVisits: string
  operator: string
  companyId: string
  forPatients: string
  currency: string
  byPhone: string
  smsLabel: string
  firstVisit: string
  bring: string
  requestTitle: string
  openMap: string
  privacyLink: string
  consentNeeded: string
  choose: string
  minutesShort: string
  /** "8 minut" */
  minutesLabel: (minutes: number) => string
  /** "Středa: 7–13" */
  dialLabel: (day: string, span: string) => string
  /** The sentence about today after the lead (Ciferník). */
  walkinUntil: (to: string) => string
  justNow: (note: string, to: string) => string
  seeDials: string
  /** "Dnes, středa:" */
  todayLegend: (weekday: string) => string
  legendClosed: string
  /** What the colours of the clock face stand for. */
  kinds: Record<'walkin' | 'booked' | 'samples', string>
  callUs: string
  orSendRequest: string
  requestStep: string
  /** The addresses of the sections on a page (`/#hodiny`), by block type. */
  anchors: Record<'notices' | 'hours' | 'services' | 'team' | 'booking' | 'location', string>
}

export const words: Words = {
  ...KIT_WORDS.cs,
  and: 'a',
  skipToHours: 'Přejít na ordinační hodiny',
  toTop: (name) => `${name}, na úvodní stránku`,
  callAria: (phone) => `Zavolat do ordinace: ${phone}`,
  days: { mon: 'Pondělí', tue: 'Úterý', wed: 'Středa', thu: 'Čtvrtek', fri: 'Pátek', sat: 'Sobota', sun: 'Neděle' },
  daysShort: { mon: 'po', tue: 'út', wed: 'st', thu: 'čt', fri: 'pá', sat: 'so', sun: 'ne' },
  inDays: (days) => `(${days.join(', ')})`,
  daysIn: { mon: 'v pondělí', tue: 'v úterý', wed: 've středu', thu: 've čtvrtek', fri: 'v pátek', sat: 'v sobotu', sun: 'v neděli' },
  months: ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'],
  todayDate: (weekday, date, month) => `Dnes, ${weekday} ${date}. ${month}`,
  openNow: (to) => `Právě máme otevřeno, dnes do ${to}`,
  closedUntil: (from) => `Teď máme zavřeno, otevíráme v ${from}`,
  closedNow: 'Teď máme zavřeno',
  closedWord: 'Zavřeno',
  closedTag: 'zavřeno',
  noHoursToday: 'Dnes neordinujeme.',
  tomorrowLead: 'Zítra,',
  nextLead: 'Příště',
  wholeWeek: 'Celý týden',
  nowTag: 'teď',
  todayTag: 'dnes',
  accepting: 'Přijímáme nové pacienty',
  important: 'Důležité',
  whenClosed: 'Když máme zavřeno',
  homeVisits: 'Návštěvy doma',
  operator: 'Provozovatel',
  companyId: 'IČO',
  forPatients: 'Pro pacienty',
  currency: 'Kč',
  byPhone: 'Telefonicky',
  smsLabel: 'SMS a recepty:',
  firstVisit: 'Jste u nás poprvé?',
  bring: 'Na první návštěvu si vezměte',
  requestTitle: 'Žádost o termín',
  openMap: 'Otevřít v mapách',
  privacyLink: 'Jak s údaji zacházíme',
  consentNeeded: 'Bez souhlasu žádost odeslat nemůžeme.',
  choose: 'Vyberte',
  minutesShort: 'min',
  minutesLabel: (minutes) => `${minutes} ${minutes === 1 ? 'minuta' : minutes < 5 ? 'minuty' : 'minut'}`,
  dialLabel: (day, span) => `${day}: ${span || 'zavřeno'}`,
  walkinUntil: (to) => `S akutními potížemi vás dnes vezmeme bez objednání do ${to}.`,
  justNow: (note, to) => `Právě teď: ${note} do ${to}.`,
  seeDials: 'Kdy přijít, najdete na cifernících níže.',
  todayLegend: (weekday) => `Dnes, ${weekday}:`,
  legendClosed: 'neordinujeme',
  kinds: { walkin: 'bez objednání', booked: 'jen objednaní', samples: 'odběry krve' },
  callUs: 'Zavolejte nám',
  orSendRequest: 'Nebo pošlete žádost',
  requestStep: 'Vyplňte formulář a do dvou pracovních dnů vám zavoláme s termínem.',
  anchors: { notices: 'aktuality', hours: 'hodiny', services: 'sluzby', team: 'tym', booking: 'objednani', location: 'kde' },
  defaultName: 'Ordinace',
}

// ── the demo content: the fictional practice Ordinace U Lípy, general practitioners for adults
//    in Jičín. The people, the phone numbers, the street and the insurers are invented (Czech
//    numbers do not start with 1); the photographs are made for the demo. ──
export const demo = {
  settings: {
    siteName: 'Ordinace U Lípy',
    field: 'Praktický lékař pro dospělé',
    street: 'Lipky 214',
    town: '506 01 Jičín',
    floor: '1. patro',
    mapUrl: 'https://mapy.example/ordinace-u-lipy',
    phone: '123 456 701',
    phoneNote: 'Pondělí až pátek 11–13 h, ve čtvrtek 13–15 h. Ráno sestra odebírá krev a telefon nemusí vzít.',
    smsPhone: '123 456 702',
    email: 'ordinace@ulipy.example',
    accepting: true,
    acceptingNote: 'z Jičína a okolí',
    closedText: 'Pohotovost pro dospělé v nemocnici v Jičíně: všední dny 17–22 h, víkendy a svátky 8–20 h. Při ohrožení života volejte *155*.',
    visitsText: 'Za pacienty, kteří se k nám nedostanou, jezdíme v pátek po 12. hodině. Návštěvu domluvte telefonicky do čtvrtka.',
    operatorName: 'Ordinace U Lípy s.r.o.',
    companyId: '12345678',
    register: 'Zapsáno u Krajského soudu v Hradci Králové, oddíl C, vložka 44218',
    licence: 'Oprávnění k poskytování zdravotních služeb vydal Krajský úřad Královéhradeckého kraje.',
    metaDescription: 'Praktický lékař pro dospělé v Jičíně. Ordinační hodiny, objednání, ceník a registrace nových pacientů.',
  },
  menu: { hours: 'Ordinační hodiny', notices: 'Aktuálně z ordinace', services: 'Služby a ceník', team: 'Náš tým', booking: 'Objednání', location: 'Kde nás najdete' },
  legal: { privacy: 'Ochrana osobních údajů', rights: 'Práva pacienta a stížnosti', accessibility: 'Prohlášení o přístupnosti' },
  home: { title: 'Úvod' },
  opening: {
    heading: 'Praktický lékař *pro dospělé v Jičíně*',
    lead: 'MUDr. Hana Dvořáčková a MUDr. Tomáš Beran. Krev odebíráme přímo v ordinaci a smlouvu máme se všemi zdravotními pojišťovnami.',
    primaryLabel: 'Objednat se',
  },
  notices: {
    heading: 'Aktuálně z ordinace',
    items: [
      {
        title: 'Dovolená od 21. do 31. prosince',
        text: 'Mezi svátky neordinujeme. Akutní případy za nás ošetří MUDr. Pavel Kříž, U Starého mlýna 48, Jičín, ve všední dny 7:30–12:00, tel. *123 456 703*.\n\nO recepty na stálé léky si prosím napište do středy 16. prosince.',
        important: true, badge: '21.–31. prosince', icon: 'calendar' as const, validFrom: '2026-11-14T23:00:00Z',
      },
      {
        title: 'Očkujeme proti chřipce a covidu',
        text: 'Vakcíny máme skladem. Očkujeme v úterý a ve čtvrtek odpoledne, stačí zavolat. Lidem nad 65 let hradí chřipku pojišťovna.',
        dateLine: 'od 1. 10. do vyčerpání', icon: 'shield-plus' as const, validFrom: '2026-09-30T22:00:00Z',
      },
      {
        title: 'Ve středu 2. prosince jen do 11:00',
        text: 'Odpoledne jsme na školení. Odběry krve proběhnou jako obvykle, preventivní prohlídky přesouváme na pátek.',
        dateLine: 'středa 2. 12. 2026', badge: '2. 12.', icon: 'calendar' as const, validFrom: '2026-11-14T23:00:00Z',
      },
    ],
  },
  hours: {
    eyebrow: 'Na dveřích',
    heading: 'Ordinační hodiny',
    text: 'Ráno odebíráme krev, dopoledne přijďte s akutními potížemi bez objednání. Zbytek dne máme pro objednané, ať nikdo nečeká zbytečně.',
    // Monday to Friday: a row is a part of a day; a day without a row is closed.
    items: [
      { day: 'mon', from: '7:00', to: '8:00', note: 'Odběry krve', kind: 'samples' },
      { day: 'mon', from: '8:00', to: '11:00', note: 'Akutní potíže, bez objednání', kind: 'walkin' },
      { day: 'mon', from: '11:00', to: '13:00', note: 'Jen pro objednané', kind: 'booked' },
      { day: 'tue', from: '7:00', to: '8:00', note: 'Odběry krve', kind: 'samples' },
      { day: 'tue', from: '8:00', to: '12:00', note: 'Akutní potíže, bez objednání', kind: 'walkin' },
      { day: 'tue', from: '13:00', to: '18:00', note: 'Jen pro objednané, MUDr. Beran', kind: 'booked' },
      { day: 'wed', from: '7:00', to: '8:00', note: 'Odběry krve', kind: 'samples' },
      { day: 'wed', from: '8:00', to: '11:00', note: 'Akutní potíže, bez objednání', kind: 'walkin' },
      { day: 'wed', from: '11:00', to: '13:00', note: 'Preventivní prohlídky', kind: 'booked' },
      { day: 'thu', from: '12:00', to: '15:00', note: 'Akutní potíže, bez objednání', kind: 'walkin' },
      { day: 'thu', from: '15:00', to: '18:00', note: 'Jen pro objednané, MUDr. Beran', kind: 'booked' },
      { day: 'fri', from: '7:00', to: '10:00', note: 'Akutní potíže, bez objednání', kind: 'walkin' },
      { day: 'fri', from: '10:00', to: '12:00', note: 'Jen pro objednané', kind: 'booked' },
    ] as Array<{ day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri'; from: string; to: string; note: string; kind: 'walkin' | 'booked' | 'samples' }>,
  },
  services: {
    eyebrow: 'V ordinaci',
    heading: 'S čím za námi můžete přijít',
    text: 'Většinu běžných potíží vyřešíme u nás. Když je potřeba specialista, objednáme vás k němu a pohlídáme výsledky.',
    coveredNote: 'Vše v tomto seznamu hradí pojišťovna',
    // What insurance pays for
    covered: [
      { name: 'Preventivní prohlídka', text: 'Jednou za dva roky, asi 40 minut. Podle věku i EKG, odběry a test na skryté krvácení.' },
      { name: 'Akutní potíže', text: 'Horečka, kašel, bolest zad, močové cesty. Přijďte dopoledne bez objednání.' },
      { name: 'Tlak, cukrovka, cholesterol', text: 'Dlouhodobé sledování, úprava léků a pravidelné kontroly na jednom místě.' },
      { name: 'Odběry krve', text: 'V pondělí až středu od 7 do 8 hodin, nalačno. Výsledky máme druhý den.' },
      { name: 'Vyšetření na počkání', text: 'EKG, CRP z kapky krve, INR, moč. Výsledek znáte do deseti minut.' },
      { name: 'Očkování', text: 'Tetanus, chřipka a pneumokok od 65 let, klíšťová encefalitida od 50 let.' },
      { name: 'Předoperační vyšetření', text: 'Objednejte se nejpozději dva týdny před termínem operace.' },
      { name: 'eRecept a neschopenka', text: 'Recept na stálé léky pošleme SMS zprávou, pro neschopenku se zastavte nebo zavolejte.' },
    ],
    // What the patient pays for
    paid: [
      { name: 'Prohlídka pro řidičský průkaz', priceNote: 'i pro řidiče nad 65 let', price: 500 },
      { name: 'Zbrojní průkaz', price: 600 },
      { name: 'Vstupní nebo periodická pracovní prohlídka', price: 600 },
      { name: 'Zdravotní průkaz do potravinářství', price: 300 },
      { name: 'Posudek ke studiu, sportu nebo na tábor', price: 300 },
      { name: 'Výpis ze zdravotní dokumentace', price: 400 },
      { name: 'Zpráva pro komerční pojišťovnu', price: 400 },
      { name: 'Očkování proti klíšťové encefalitidě', priceNote: 'do 50 let, včetně vakcíny', price: 950 },
      { name: 'Aplikace vakcíny, kterou si přinesete', price: 200 },
      { name: 'CRP na vlastní žádost', price: 250 },
    ],
  },
  prices: {
    heading: 'Co pojišťovna nehradí',
    text: 'Ceník platí od 1. 9. 2026. Zaplatit můžete hotově i kartou.',
  },
  insurers: {
    heading: 'Smlouvu máme se všemi sedmi pojišťovnami',
    // (invented: no real insurer's name)
    items: [
      { code: '111', short: 'JZP', name: 'Jednotná zdravotní pojišťovna' },
      { code: '201', short: 'AZP', name: 'Armádní zdravotní pojišťovna' },
      { code: '205', short: 'ČPZ', name: 'Česká podniková zdravotní pojišťovna' },
      { code: '207', short: 'PZP', name: 'Profesní zdravotní pojišťovna' },
      { code: '209', short: 'ZPD', name: 'Zaměstnanecká pojišťovna Dubina' },
      { code: '211', short: 'ZPMD', name: 'Zdravotní pojišťovna ministerstva dopravy' },
      { code: '213', short: 'LZP', name: 'LZP, zdravotní pojišťovna' },
    ],
  },
  team: {
    eyebrow: 'Kdo vás ošetří',
    heading: 'Dva lékaři a dvě sestry, které znáte jménem',
    text: 'Jsme malá ordinace. Kdo k nám chodí, potkává pořád stejné tváře, a my si pamatujeme víc než jen číslo pojištěnce.',
    items: [
      { name: 'MUDr. Hana Dvořáčková', role: 'praktická lékařka, vedoucí ordinace', text: 'V Jičíně ordinuje od roku 2009. Věnuje se hlavně cukrovce a vysokému tlaku.' },
      { name: 'MUDr. Tomáš Beran', role: 'praktický lékař', text: 'Přišel z interny nemocnice. Ordinuje v úterý a ve čtvrtek odpoledne.' },
      { name: 'Jitka Marková', role: 'všeobecná sestra', text: 'Odběry, EKG a očkování. V ordinaci je od začátku a většinu pacientů zná od vidění.' },
      { name: 'Lenka Šulcová', role: 'všeobecná sestra', text: 'Bere telefony, objednává a posílá recepty. Ví, kdy je nejdřív volno.' },
    ],
  },
  booking: {
    eyebrow: 'U sestry',
    heading: 'Jak se objednat',
    firstVisit: [
      'Zavolejte nebo pošlete žádost a domluvíme termín vstupní prohlídky.',
      'U nás podepíšete registraci. Trvá to pět minut.',
      'O dokumentaci si u vašeho dosavadního lékaře požádáme sami.',
    ],
    bring: ['kartičku pojišťovny a občanský průkaz', 'seznam léků s dávkováním', 'zprávy od specialistů za poslední dva roky', 'očkovací průkaz, pokud ho máte'],
    formText: 'Ozveme se do dvou pracovních dnů telefonem. *S akutními potížemi nepište a přijďte dopoledne.*',
  },
  location: {
    eyebrow: 'Cesta k nám',
    heading: 'Lipky 214, dům s lípou',
    text: '506 01 Jičín. Tři minuty pěšky od Valdštejnova náměstí směrem k nemocnici.',
    facts: [
      { icon: 'bus' as const, title: 'Zastávka Lipky, 150 m', text: 'Linky 1 a 3. Z autobusového nádraží pěšky 8 minut.' },
      { icon: 'parking' as const, title: 'Šest míst ve dvoře', text: 'Vjezd z boční uličky, pro pacienty zdarma. Dvě místa pro držitele průkazu ZTP.' },
      { icon: 'access' as const, title: 'Rampa a výtah, žádné schody', text: 'Do výtahu se vejde vozík i kočárek. Bezbariérové WC je v přízemí.' },
      { icon: 'door' as const, title: 'První patro, dveře vpravo', text: 'Čekárna je odemčená od 6:45, zvonit nemusíte.' },
    ],
    walks: [
      { minutes: 3, place: 'z Valdštejnova náměstí', how: 'pěšky po rovině' },
      { minutes: 2, place: 'ze zastávky Lipky', how: 'linky 1 a 3' },
      { minutes: 8, place: 'z autobusového nádraží', how: 'pěšky přes park' },
    ],
  },
  // The pages the footer links to. Sample texts: the practice writes its own before it publishes.
  pages: {
    privacy: {
      title: 'Ochrana osobních údajů', slug: 'ochrana-osobnich-udaju',
      intro: 'Ukázkový text. Před zveřejněním popište, jak s údaji pacientů nakládáte vy.',
      sections: [
        { heading: 'Jaké údaje zpracováváme', text: 'Z formuláře máme vaše jméno, rok narození, telefon, pojišťovnu a důvod návštěvy. Zdravotní dokumentaci vedeme podle zákona, odděleně od webu.' },
        { heading: 'Proč údaje potřebujeme', items: ['abychom vám zavolali s termínem', 'abychom vás zaregistrovali jako pacienta', 'abychom splnili povinnosti, které nám ukládá zákon'] },
        { heading: 'Jak dlouho je uchováváme', text: 'Žádost z formuláře smažeme do tří měsíců, pokud se nestanete naším pacientem. Zdravotní dokumentaci uchováváme po dobu, kterou stanoví zákon.' },
      ],
    },
    rights: {
      title: 'Práva pacienta a stížnosti', slug: 'prava-pacienta-a-stiznosti',
      intro: 'Ukázkový text. Před zveřejněním sem vložte vlastní pravidla.',
      sections: [
        { heading: 'Vaše práva', items: ['na srozumitelné informace o svém zdravotním stavu', 'na to, aby s vaším souhlasem nahlédla do dokumentace jen osoba, kterou určíte', 'na bezpečné a důstojné ošetření'] },
        { heading: 'Jak podat stížnost', text: 'Se stížností se obraťte na vedoucí ordinace osobně, telefonem nebo e-mailem. Odpovíme vám do třiceti dnů.' },
      ],
    },
    accessibility: {
      title: 'Prohlášení o přístupnosti', slug: 'prohlaseni-o-pristupnosti',
      intro: 'Ukázkový text. Před zveřejněním ho upravte podle skutečného stavu webu.',
      sections: [
        { heading: 'Stav přístupnosti', text: 'Snažíme se, aby byl web dobře čitelný, ovladatelný klávesnicí a srozumitelný čtečkám obrazovky. Pokud na něm najdete něco, co vám brání, napište nám a opravíme to.' },
        { heading: 'Přístup do ordinace', text: 'Ke vchodu vede rampa a v domě je výtah. Bezbariérové WC je v přízemí.' },
      ],
    },
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    cekarna: 'Čekárna ordinace: řada dřevěných židlí u bílé stěny, vysoká okna a květiny na parapetu',
    ordinace: 'Ordinace: psací stůl ze světlého dřeva, lehátko, vysoké okno a stetoskop na stole',
    rozhovor: 'Lékařka sedí u stolu a mluví se starším pacientem, pohled otevřenými dveřmi',
    tlak: 'Sestra měří tlak starší pacientce v ordinaci u okna',
    dvorakova: 'MUDr. Hana Dvořáčková',
    beran: 'MUDr. Tomáš Beran',
    markova: 'Jitka Marková',
    sulcova: 'Lenka Šulcová',
    dum: 'Dům s ordinací v ulici Lipky, před ním stará lípa',
    dvere: 'Pootevřené bílé dveře na konci chodby, za nimi světlá čekárna',
    recepce: 'Sestra u pultu mluví s pacientkou, v pozadí vysoké okno',
    detail: 'Fonendoskop, tlakoměr a brýle na stole u okna',
  },
}

// ── what Ciferník's design words differently (the rest is Čekárna's, above) ──
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  cifernik: {
    settings: {
      closedText: 'pohotovost pro dospělé v jičínské nemocnici, všední dny 17–22 h, víkendy 8–20 h. Při ohrožení života volejte *155*.',
      visitsText: 'Za pacienty, kteří se k nám nedostanou, jezdíme domů v pátek po 12. hodině.',
    },
    // (the folded menu has a sixth link, the notices)
    menu: { hours: 'Ordinační hodiny', notices: 'Co je nového', services: 'Služby a ceník', team: 'Kdo tu je', booking: 'Objednání', location: 'Kde nás najdete' },
    opening: {
      heading: 'Dobrý den, tady ordinace U Lípy.',
      lead: 'Praktičtí lékaři pro dospělé v Lipkové ulici v Jičíně.',
    },
    notices: {
      heading: 'Co je nového',
      items: [
        {
          title: 'Mezi svátky máme dovolenou',
          text: 'Akutní případy za nás ošetří MUDr. Pavel Kříž, U Starého mlýna 48, Jičín, ve všední dny 7:30–12:00, tel. *123 456 703*.\n\nO recepty na stálé léky si prosím napište do středy 16. prosince.',
          important: true, badge: '21.–31. prosince', icon: 'calendar' as const, validFrom: '2026-11-14T23:00:00Z',
        },
        {
          title: 'Očkujeme proti chřipce a covidu',
          text: 'Vakcíny máme skladem. Očkujeme v úterý a ve čtvrtek odpoledne, stačí zavolat. Lidem nad 65 let hradí chřipku pojišťovna.',
          dateLine: 'od 1. 10. do vyčerpání', icon: 'shield-plus' as const, validFrom: '2026-09-30T22:00:00Z',
        },
        {
          title: 'Ve středu 2. prosince jen do 11:00',
          text: 'Odpoledne jsme na školení. Odběry krve proběhnou jako obvykle, preventivní prohlídky přesouváme na pátek.',
          dateLine: 'středa 2. 12. 2026', badge: '2. 12.', icon: 'calendar' as const, validFrom: '2026-11-14T23:00:00Z',
        },
      ],
    },
    hours: {
      eyebrow: '',
      text: 'Každý den má svůj ciferník. Kde je barva, tam máme otevřeno, a barva říká pro koho.',
    },
    services: {
      eyebrow: '',
      heading: 'S čím vám pomůžeme',
      coveredNote: 'Tohle všechno hradí pojišťovna',
    },
    prices: {
      heading: 'Co si u nás zaplatíte sami',
      text: 'Výkony, které zdravotní pojišťovna nehradí. Ceník platí od 1. 9. 2026, zaplatit můžete hotově i kartou.',
    },
    insurers: { heading: 'Jsme smluvní ordinací všech sedmi zdravotních pojišťoven' },
    team: {
      eyebrow: '',
      heading: 'Kdo vám otevře dveře',
      text: 'Jsme čtyři. Kdo k nám chodí, potkává pořád stejné tváře, a my si pamatujeme víc než jen číslo pojištěnce.',
    },
    booking: {
      eyebrow: '',
      heading: 'Jak se k nám objednat',
      firstVisit: [
        'Na vstupní prohlídce podepíšete registraci, trvá to pět minut.',
        'O dokumentaci si u vašeho dosavadního lékaře požádáme sami.',
      ],
      bring: ['kartičku pojišťovny', 'občanský průkaz', 'seznam léků s dávkováním', 'zprávy od specialistů za dva roky', 'očkovací průkaz'],
      formText: '*S akutními potížemi nepište a přijďte dopoledne.* Formulář čteme jednou denně.',
    },
    location: {
      eyebrow: '',
      text: '506 01 Jičín. Ordinace je v prvním patře, od Valdštejnova náměstí půjdete směrem k nemocnici.',
      facts: [
        { icon: 'access' as const, title: 'Bez jediného schodu', text: 'Ke vchodu vede rampa, výtah je hned za dveřmi a vejde se do něj vozík i kočárek. Bezbariérové WC je v přízemí.' },
        { icon: 'door' as const, title: 'První patro, dveře vpravo', text: 'Čekárna je odemčená od 6:45, zvonit nemusíte.' },
        { icon: 'parking' as const, title: 'Šest míst ve dvoře', text: 'Vjezd z boční uličky, pro pacienty zdarma. Dvě místa jsou pro držitele průkazu ZTP.' },
      ],
    },
  },
}
