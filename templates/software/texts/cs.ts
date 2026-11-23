// Every Czech text of the Software template, in one place: the website's own words (what is
// not content: "Měsíčně", "Obr.", the anchors of the sections, what the drawn screens of the
// product say) and the demo content the seed puts in (with what a look's design words
// differently: `demoByLook`). Another language is a file beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

const nb = ' '

/** A shift of the week grid: the text in its cell and what it is (morning, afternoon, away). */
export type ShiftKind = 'am' | 'pm' | 'off'

// ── what the drawn screens of the product say (the product's own words, the same in every look) ──
const screens = {
  week: {
    title: 'Týden 23.–29. 11.', place: 'Kavárna Na Růžku', seen: `vidělo 6${nb}z${nb}6`, publish: 'Zveřejnit změny',
    days: [['Po', '23.'], ['Út', '24.'], ['St', '25.'], ['Čt', '26.'], ['Pá', '27.'], ['So', '28.'], ['Ne', '29.']] as Array<[string, string]>,
    hours: 'hod.', freeNavod: 'Volné', free: 'Volná', freeShift: '13–20',
    legend: { morning: 'ranní', afternoon: 'odpolední', off: 'nemoc, dovolená', free: 'volná směna', swap: 'výměna' },
    // the shifts by code: the text in the cell, and what kind it is
    shifts: { R: ['7–14', 'am'], O: ['13–20', 'pm'], S1: ['8–14', 'am'], S2: ['14–20', 'pm'], D: ['9–17', 'am'], X: ['nemoc', 'off'], V: ['dovol.', 'off'] } as Record<string, [string, ShiftKind]>,
    // a code with a star is the shift that was swapped
    rows: [
      { name: 'Jitka', initials: 'JM', hours: 28, shifts: ['R', 'R', '', 'R', 'R', '', ''] },
      { name: 'Marek', initials: 'MD', hours: 34, shifts: ['O', 'O', 'R', 'R*', '', 'S2', ''] },
      { name: 'Bára', initials: 'BN', hours: 27, shifts: ['R', '', 'O', 'X', 'O', 'S1', ''] },
      { name: 'Tomáš', initials: 'TK', hours: 29, shifts: ['', 'O', 'O', 'O', '', '', 'D'] },
      { name: 'Eliška', initials: 'EB', hours: 14, shifts: ['O', 'R', 'V', 'V', 'V', '', ''] },
      { name: 'Šimon', initials: 'ŠK', hours: 21, shifts: ['', '', '', '', 'R', 'S1', 'D'] },
    ],
  },
  template: {
    title: 'Nový týden', range: '30. 11. – 6. 12.', fromTemplate: 'Založit ze šablony', templateName: 'Běžný týden',
    changes: 'Změny oproti šabloně', person: 'Eliška B.', personDays: 'po–st', leave: 'dovolená',
    day: 'Sobota 5. 12.', dayNote: 'mikulášská akce', addShift: '+ směna 16–22',
    receivers: `Dostane ho 6${nb}lidí · aplikace, e-mail`, publish: 'Zveřejnit rozpis',
  },
  swap: {
    clock: '6:44', date: 'čt 26. 11.', title: 'Výměna směny', shiftLine: 'čt 26. 11. · ranní', shiftTime: '7:00–14:00', from: 'Bára N.', to: 'Marek D.',
    steps: [['6:40', 'Bára nabídla směnu: „Mám horečku.“'], ['6:44', 'Marek ji vzal.'], ['teď', 'Čeká na vaše potvrzení.']] as Array<[string, string]>,
    confirm: 'Potvrdit výměnu', refuse: 'Zamítnout', noticesTitle: 'Co mezitím přišlo ostatním',
    // the messages the others get: Manual and Magnets show these…
    notices: [
      // (`short` is the line Magnets writes, which leaves out the date)
      { who: 'Marek, Tomáš, Šimon', at: '6:40', title: 'Bára nabízí směnu.', text: 'Čtvrtek 26. 11., 7:00–14:00. Vezmeš ji?', short: 'Čtvrtek 7:00–14:00. Vezmeš ji?' },
      { who: 'Bára, Marek', at: '6:45', title: 'Výměna je potvrzená.', text: 'Čtvrteční ranní má Marek.', short: '' },
      { who: 'Všichni', at: '6:45', title: 'Rozpis se změnil.', text: 'Čtvrtek 26. 11., ranní.', short: '' },
    ],
    // …One Day shows these, as the lock screen of the people it reaches
    day: [
      { who: 'Marek, Tomáš, Šimon', at: '6:40', title: 'Bára nabízí směnu.', text: 'Čtvrtek 26. 11., 7:00–14:00. Vezmeš ji?' },
      { who: 'Jitka', at: '6:44', title: 'Marek chce vzít čtvrteční ranní', text: 'za Báru. Potvrdíte výměnu?' },
      { who: 'Bára, Marek', at: '6:45', title: 'Výměna je potvrzená.', text: 'Čtvrteční ranní má Marek. Báro, brzy se uzdrav.' },
    ],
  },
  attendance: {
    title: 'Docházka', today: 'dnes, po 23. 11.', summary: `5${nb}z${nb}5 v${nb}práci · 1 pozdě`, summaryShort: `5${nb}z${nb}5 v${nb}práci`, present: `v${nb}práci`,
    rows: [
      { name: 'Lukáš Havel', place: 'Šternberk, rodinný dům', at: '6:52', late: '' },
      { name: 'David Urban', place: 'Šternberk, rodinný dům', at: '6:58', late: '' },
      { name: 'Radek Vlček', place: 'Litovel, základní škola', at: '6:49', late: '' },
      { name: 'Jan Pospíšil', place: 'Olomouc, byt Wolkerova', at: '7:04', late: '' },
      { name: 'Milan Šustr', place: 'Olomouc, byt Wolkerova', at: '7:31', late: `+31${nb}min` },
    ],
  },
  payroll: {
    titleNavod: 'Podklady pro mzdy', month: 'listopad 2026', monthTitle: 'Listopad 2026', placeMagnety: 'Kadeřnictví Vaňková', placeDay: 'podklady pro mzdy',
    download: 'Stáhnout pro účetní',
    columns: { name: 'Jméno', hours: 'Hodiny', saturdays: 'Soboty', leave: 'Dovolená', pay: 'Hrubá mzda' },
    rows: [
      { name: 'Petra Hrubá', hours: `152${nb}h`, saturdays: `16${nb}h`, leave: '1 den', pay: `32 256${nb}Kč` },
      { name: 'Monika Šebestová', hours: `96${nb}h`, saturdays: `8${nb}h`, leave: '—', pay: `19 844${nb}Kč` },
      { name: 'Adéla Krejčí', hours: `42${nb}h`, saturdays: `12${nb}h`, leave: '—', pay: `8 208${nb}Kč` },
    ],
    total: { name: 'Celkem', hours: `290${nb}h`, saturdays: `36${nb}h`, leave: '1 den', pay: `60 308${nb}Kč` },
  },
  // Magnets' opening: a few shifts on the board around the heading, and the phone of the one they are for
  board: {
    days: [['Po 23. 11.', 'dnes'], ['Út 24. 11.', 'zítra'], ['St 25. 11.', ''], ['Čt 26. 11.', ''], ['Pá 27. 11.', ''], ['So 28. 11.', ''], ['Ne 29. 11.', '']] as Array<[string, string]>,
    chips: {
      marek: ['Marek', `7–14 · za Báru`], free: ['Volná', '13–20 · kdo ji vezme?'], bara: ['Bára', '7–14'], simon: ['Šimon', '7–14'],
      marekLate: ['Marek', '13–20'], morning: [`Jitka a${nb}Eliška`, 'zítra 7–14'], afternoon: [`Marek a${nb}Tomáš`, 'zítra 13–20'],
    } as Record<string, [string, string]>,
    noticeFrom: 'Odpolka · teď · telefon Elišky', noticeBold: 'Zítra máš ranní, 7:00–14:00.', noticeRest: 'Kavárna Na Růžku, s Jitkou.',
  },
}

// ── what a look words in its own way (the same product, a different line) ──
export interface LookWords {
  /** "Kč měsíčně" beside a price. */
  priceUnit: string
  /** The note under a price: what is paid in this billing, with the yearly price per month and for the year. */
  priceNote: (billing: 'monthly' | 'yearly', perMonthYearly: string, perYear: string) => string
  /** "Stav služby vidíte na" before the status page's address. */
  statusSee: string
}

export interface Words extends KitWords {
  toTop: (name: string) => string
  openMenu: string
  closeMenu: string
  /** The address of each block's section on a page (`/#cenik`), by block type. */
  anchors: Record<'audience' | 'features' | 'pricing' | 'testimonials' | 'changelog' | 'questions' | 'team' | 'contact' | 'cta', string>
  monthly: string
  yearly: string
  paymentLabel: string
  paymentGroup: string
  limits: string
  limitsCaption: string
  /** "Situace" before a feature's number (Manual). */
  situation: string
  /** "Obr." before a figure's number (Manual). */
  figure: string
  /** "verze" before a release's version (One Day). */
  version: string
  /** "nejnovější" on the first release (Magnets). */
  newest: string
  emailLabel: string
  emailPlaceholder: string
  statusRunning: string
  footerProduct: string
  footerSupport: string
  footerLegal: string
  /** "IČO", "DIČ" */
  companyId: string
  vatId: string
  phoneLabel: string
  /** Where the privacy page is. */
  privacyUrl: string
  /** The part of the product a look draws itself. */
  screens: typeof screens
  /** The product name of a site that has none yet. */
  look: Record<'navod' | 'magnety' | 'jeden-den', LookWords>
}

export const words: Words = {
  ...KIT_WORDS.cs,
  toTop: (name) => `${name}, úvodní stránka`,
  openMenu: 'Otevřít nabídku', closeMenu: 'Zavřít nabídku',
  anchors: { audience: 'pro-koho', features: 'co-umi', pricing: 'cenik', testimonials: 'reference', changelog: 'novinky', questions: 'otazky', team: 'kdo', contact: 'kontakt', cta: 'vyzkouset' },
  monthly: 'Měsíčně', yearly: 'Ročně', paymentLabel: 'Platba', paymentGroup: 'Způsob platby',
  limits: 'Limity', limitsCaption: 'Srovnání limitů tarifů',
  situation: 'Situace', figure: 'Obr.', version: 'verze', newest: 'nejnovější',
  emailLabel: 'Váš e-mail', emailPlaceholder: 'vas@email.example',
  statusRunning: 'Všechny služby běží',
  footerProduct: 'Produkt', footerSupport: 'Podpora', footerLegal: 'Právní',
  companyId: 'IČO', vatId: 'DIČ', phoneLabel: 'Telefon',
  privacyUrl: '/ochrana-osobnich-udaju',
  screens,
  look: {
    navod: {
      priceUnit: `Kč${nb}měsíčně`,
      priceNote: (billing, perMonthYearly, perYear) => (billing === 'monthly' ? `bez DPH · ročně ${perMonthYearly}${nb}Kč měsíčně` : `bez DPH · platí se ${perYear}${nb}Kč ročně`),
      statusSee: 'Stav vidíte na',
    },
    magnety: {
      priceUnit: 'Kč',
      priceNote: (billing, perMonthYearly, perYear) => (billing === 'monthly' ? `měsíčně bez DPH · ročně ${perMonthYearly}${nb}Kč` : `měsíčně bez DPH · ${perYear}${nb}Kč ročně`),
      statusSee: 'Stav služby vidíte na',
    },
    'jeden-den': {
      priceUnit: `Kč${nb}měsíčně`,
      priceNote: (billing, perMonthYearly, perYear) => (billing === 'monthly' ? `bez DPH, při roční platbě ${perMonthYearly}${nb}Kč` : `bez DPH, platí se ${perYear}${nb}Kč ročně`),
      statusSee: 'Stav služby vidíte na',
    },
  },
  defaultName: 'Odpolka',
}

// ── the demo content: the fictional product Odpolka, a schedule and attendance app for small
//    businesses, made by four people in Olomouc. The company, the people, the phone numbers and
//    the addresses are invented. The texts are Manual's (the first look's design); what the other
//    two designs word differently is in `demoByLook` below. ──
export interface FeatureDemo {
  title: string
  question?: string
  when?: string
  text: string
  note?: string
  points?: string[]
  screen: 'none' | 'week' | 'template' | 'swap' | 'attendance' | 'payroll'
  caption?: string
  /** The key of a photograph in seed/photos.ts, when the look shows one beside the screen. */
  photo?: string
}

const features: FeatureDemo[] = [
  {
    title: 'Rozpis na týden za deset minut', when: 'neděle 20:14 · kavárna, Olomouc',
    text: 'Jitka si v neděli večer otevře příští týden, založí ho ze šablony „Běžný týden“ a upraví dvě věci: Eliška má dovolenou a v sobotu je mikulášská akce. Ve 20:14 klepne na Zveřejnit a šest lidí má rozpis v telefonu.',
    points: ['Týden založíte ze šablony nebo zkopírujete ten minulý.', 'Odpolka upozorní, když dáte směnu někomu, kdo má dovolenou.', 'Jedním tlačítkem ho dostanou všichni: do aplikace, e-mailem, a kdo chce, vytiskne si ho na A4.'],
    screen: 'template', caption: 'Založení týdne ze šablony',
  },
  {
    title: 'Výměna směny bez telefonování', when: 'čtvrtek 6:40 · kavárna, Olomouc',
    text: 'Bára se probudí s horečkou a v 6:40 nabídne svou ranní směnu ostatním. Za čtyři minuty ji bere Marek. Jitce stačí jedno klepnutí: Potvrdit. Rozpis se přepíše a oba dostanou zprávu.',
    points: ['Nabídku směny vidí jen ti, kdo ten den mohou.', 'U směny zůstane zápis, kdo ji komu předal a kdy.', 'Poslední slovo má vedoucí. Kdo nechce potvrzovat, vypne si to.'],
    screen: 'swap', caption: 'Telefon vedoucí ve čtvrtek ráno a zprávy ostatním',
  },
  {
    title: 'Docházka z místa, kde se pracuje', when: 'pondělí 7:35 · malíři, Šternberk',
    text: 'Petr Koubek má pět lidí na třech stavbách. Každý si ráno na místě v telefonu zapíše příchod. Petr v 7:35 vidí, že v Olomouci začali o půl hodiny později, a nemusí kvůli tomu nikam jezdit ani volat.',
    points: ['Všechny stavby na jedné obrazovce, bez obvolávání.', 'Příchod a odchod jedním klepnutím, s místem. Funguje i bez signálu.', 'Zpoždění vidíte hned, ne až na konci měsíce.'],
    screen: 'attendance', caption: 'Kdo je kde, pondělí ráno',
  },
  {
    title: 'Podklady pro mzdy jedním souborem', when: '30. listopadu · kadeřnictví, Prostějov',
    text: 'Simona Vaňková dřív poslední dva večery v měsíci opisovala hodiny z papírového diáře. Teď otevře Podklady, zkontroluje součty a pošle účetní jeden soubor: hodiny, soboty, dovolené.',
    points: ['Export do XLSX, CSV a PDF, jak to chce vaše účetní.', 'Příplatky za soboty, neděle a svátky podle vašeho nastavení.', 'Součty za měsíc. Každý vidí své hodiny, nikdo cizí mzdu.'],
    screen: 'payroll', caption: 'Měsíční součty pro účetní',
  },
]

export const demo = {
  settings: {
    siteName: 'Odpolka',
    ctaLabel: 'Vyzkoušet zdarma', ctaLongLabel: 'Vyzkoušet 30 dní zdarma',
    loginLabel: 'Přihlásit se', loginUrl: 'https://app.odpolka.example',
    footerText: 'Rozpis směn a docházka pro malé provozy. Děláme ji v Olomouci od roku 2021.',
    // (numbers no phone has: Czech numbers do not start with 1)
    supportPhone: '123 456 702', supportEmail: 'podpora@odpolka.example',
    supportHours: 'Pondělí až pátek 8–17 hodin', statusUrl: 'https://stav.odpolka.example',
    legalName: 'Odpolka software s.r.o.', address: 'Odpolková 12, 779 00 Olomouc', companyId: '12345678', vatId: 'CZ12345678',
    registry: 'zapsaná u Krajského soudu v Ostravě, oddíl C, vložka 12345',
    metaDescription: 'Rozpis směn a docházka pro kavárny, obchody, salony a řemeslnické party do 50 lidí. 30 dní zdarma, bez platební karty.',
  },
  menu: {
    main: { features: 'Co umí', pricing: 'Ceník', changelog: 'Novinky', questions: 'Otázky', team: 'Kdo to dělá' },
    product: { features: 'Co umí', pricing: 'Ceník', changelog: 'Novinky', app: 'Aplikace do telefonu' },
    support: { docs: 'Dokumentace', status: 'Stav služby', contact: 'Kontakt' },
    legal: { terms: 'Obchodní podmínky', privacy: 'Ochrana osobních údajů', processing: 'Zpracovatelská smlouva', cookies: 'Cookies' },
  },
  home: { title: 'Úvod' },
  opening: {
    eyebrow: 'Webová a mobilní aplikace',
    heading: 'Rozpis směn a docházka pro malé provozy',
    text: 'Pro kavárny, obchody, salony a řemeslnické party do padesáti lidí. Týden naplánujete za deset minut, každý má své směny v telefonu, výměny si lidé domluví sami a na konci měsíce pošlete účetní hotové hodiny.',
    primaryLabel: 'Vyzkoušet 30 dní zdarma',
    secondaryLabel: 'Ceník od 290 Kč měsíčně',
    note: 'Bez platební karty. První rozpis máte za deset minut.',
    facts: [
      { label: 'Běží na', value: 'webu a v telefonu' },
      { label: 'Data', value: 'na serverech v Praze' },
      { label: 'Podpora', value: 'po–pá 8–17, telefonem' },
    ],
    screen: 'week' as 'none' | 'week' | 'template' | 'swap' | 'attendance' | 'payroll',
    caption: 'Týdenní rozpis kavárny se šesti lidmi',
    notes: [
      { title: 'Zveřejníte jedním tlačítkem.', text: 'Všem přijde rozpis do telefonu a vidíte, kdo ho četl.' },
      { title: 'Výměnu si domluví sami.', text: 'Marek vzal čtvrtek za Báru, vy jste jen potvrdili.' },
      { title: 'Volná směna je vidět.', text: 'Svítí všem, dokud si ji někdo nevezme.' },
      { title: 'Hodiny se sčítají samy.', text: 'Za týden i za měsíc, pro každého zvlášť.' },
    ],
    time: '', timeNote: '',
  },
  audience: {
    eyebrow: 'Kdo ji používá', heading: 'Kdo Odpolku používá',
    text: 'Provozy, kde se lidé střídají a majitel u toho sám pracuje. Nejmenší má tři lidi, největší čtyřicet šest.',
    tags: [] as string[],
    photos: [
      { photo: 'kavarna', title: 'Kavárna Na Růžku, Olomouc', caption: '6 lidí, dvě směny denně' },
      { photo: 'obchod', title: 'Farmářský krámek, Přerov', caption: '4 lidé, otevřeno šest dní' },
      { photo: 'salon', title: 'Kadeřnictví Vaňková, Prostějov', caption: '3 kadeřnice a brigádnice' },
      { photo: 'malir', title: 'Malíři Koubek, Šternberk', caption: '5 lidí na třech stavbách' },
    ],
    time: '', timeNote: '',
  },
  features: {
    eyebrow: 'Co umí', heading: 'Čtyři situace, které z provozu znáte',
    text: 'Odpolka neumí všechno. Umí rozpis, výměny, docházku a podklady pro mzdy a ke každé z těch věcí je tu jeden skutečný den u někoho, kdo ji používá.',
    items: features,
    time: '', timeNote: '',
  },
  pricing: {
    eyebrow: 'Ceník', heading: 'Ceník',
    text: 'Platíte za provoz, ne za každého člověka. Ceny jsou v korunách za měsíc bez DPH. Tarif změníte nebo zrušíte kdykoli v nastavení.',
    yearlyNote: 'Při roční platbě vyjde rok na cenu deseti měsíců.',
    afterLabel: 'Po zkušební době',
    afterText: 'Třicátý den si vyberete tarif. Když ne, účet se zamkne jen pro čtení a rozpisy i docházku si můžete ještě 60 dní stáhnout. Nic se samo nestrhne: kartu po vás nechceme.',
    afterNote: '',
    moreText: 'Máte víc než 50 lidí? *Napište nám*, domluvíme se.',
    plans: [
      { name: 'Krámek', forWhom: 'Jedna provozovna, pár lidí.', monthly: 290, yearly: 240, highlighted: false, badge: '', items: ['do 5 lidí, 1 provozovna', 'rozpis, šablony a výměny směn', 'aplikace pro chytré telefony', 'podpora e-mailem'] },
      { name: 'Provoz', forWhom: 'Kavárna, obchod, salon, parta.', monthly: 690, yearly: 575, highlighted: true, badge: 'Volí ho většina', items: ['do 20 lidí, 3 provozovny', 'všechno z Krámku', 'docházka z telefonu s místem', 'dovolené, absence, podklady pro mzdy', 'podpora e-mailem i telefonem'] },
      { name: 'Pobočky', forWhom: 'Víc provozoven a vedoucích.', monthly: 1490, yearly: 1240, highlighted: false, badge: '', items: ['do 50 lidí, provozoven bez omezení', 'všechno z Provozu', 'vedoucí poboček se svými právy', 'API a napojení na mzdový program', 'zaškolení týmu na dálku'] },
    ],
    limits: [
      { name: 'Lidé v rozpisu', values: ['5', '20', '50'] },
      { name: 'Provozovny', values: ['1', '3', 'bez omezení'] },
      { name: 'Správci', values: ['1', '3', 'bez omezení'] },
      { name: 'Historie docházky', values: ['—', '2 roky', 'bez omezení'] },
      { name: 'Export', values: ['XLSX', 'XLSX, CSV, PDF', '+ API'] },
      { name: 'Odpověď podpory', values: ['do 1 prac. dne', 'do 4 hodin', 'do 4 hodin'] },
    ],
    time: '', timeNote: '',
  },
  testimonials: {
    eyebrow: '', heading: 'Co říkají ti, kdo ji používají',
    items: [
      { name: 'Jitka Marková', role: 'kavárna Na Růžku, Olomouc', text: 'Rozpis jsem dřív dělala v neděli večer v tabulce a pak ho fotila do skupiny. Teď mi to trvá deset minut a nikdo se neptá, kdy má přijít.', photo: 'portretJitka', featured: true },
      { name: 'Petr Koubek', role: 'malíř a natěrač, Šternberk', text: 'Mám pět chlapů na třech stavbách. Ráno se podívám do telefonu a vím, kdo kde je. Na konci měsíce nemusím nic sčítat z papírků.', photo: 'portretKoubek', featured: false },
      { name: 'Simona Vaňková', role: 'kadeřnictví, Prostějov', text: 'Účetní ode mě chtěla hodiny vždycky do třetího. Teď jí pošlu jeden soubor a je klid. A holky si směny prohodí samy, mně to jen pípne.', photo: 'portretVankova', featured: false },
    ],
    time: '', timeNote: '',
  },
  changelog: {
    eyebrow: 'Novinky', heading: 'Co je nového',
    text: 'Novou verzi vydáváme zhruba jednou za tři týdny. Většina změn vzniká z toho, co nám napíšete nebo řeknete do telefonu.',
    linkLabel: 'Všechny novinky od roku 2021',
    imageCaption: '',
    // (the newest first; the home page shows the first five, the page of the changelog all)
    releases: [
      { version: '3.8', date: [2026, 11, 18], title: 'Šablony týdnů', text: 'Uložte si běžný týden a příští rozpis založte jedním klepnutím. Upravíte jen to, co je jinak.' },
      { version: '3.7', date: [2026, 11, 3], title: 'Příplatky za soboty a svátky', text: 'Podklady pro mzdy samy spočítají příplatky za víkendy a svátky podle toho, co si nastavíte.' },
      { version: '3.6', date: [2026, 10, 14], title: 'Docházka bez signálu', text: 'Příchod se zapíše i ve sklepě nebo na stavbě bez signálu a odešle se, až telefon chytí síť.' },
      { version: '3.5', date: [2026, 9, 22], title: 'Připomenutí směny', text: 'Večer před směnou přijde připomenutí. Kdo ho nechce, vypne si ho.' },
      { version: '3.4', date: [2026, 9, 2], title: 'Tisk rozpisu na A4', text: 'Pořád ho někdo chce mít na dveřích skladu. Teď se tiskne čitelně a na jednu stránku.' },
      { version: '3.3', date: [2026, 8, 12], title: 'Poznámky ke směnám', text: 'Ke směně napíšete, co se má ten den stihnout, a ten, kdo ji má, to uvidí v telefonu.' },
      { version: '3.2', date: [2026, 7, 21], title: 'Sdílené provozovny', text: 'Jeden člověk může střídavě pracovat ve dvou provozovnách, hodiny se sečtou dohromady.' },
      { version: '3.1', date: [2026, 6, 30], title: 'Rychlejší výměny', text: 'Nabídka směny se ukáže jen těm, kdo ten den mohou, a odpověď přijde do minuty.' },
      { version: '3.0', date: [2026, 5, 26], title: 'Nová aplikace do telefonu', text: 'Přepsali jsme ji od základu: je rychlejší a pamatuje si, kde jste skončili.' },
    ],
    count: 5,
    time: '', timeNote: '',
  },
  questions: {
    eyebrow: 'Časté otázky', heading: 'Časté otázky',
    text: 'Na co se lidé ptají, než nám svěří rozpis. Chybí tu vaše otázka? *Zeptejte se.*',
    items: [
      { question: 'Kde jsou naše data a kdo se k nim dostane?', answer: 'Na serverech v Praze, každou noc je zálohujeme do druhého datového centra v Brně. K datům se dostanete vy a lidé, které pozvete. My jen tehdy, když nás požádáte o pomoc.' },
      { question: 'Dostanu data ven, když budu chtít odejít?', answer: 'Ano. Rozpisy, docházku i seznam lidí stáhnete kdykoli jako XLSX nebo CSV: ve zkušební době, při placení i 60 dní po zrušení.' },
      { question: 'Jak se Odpolka ruší?', answer: 'V nastavení jedním tlačítkem, bez telefonátu a bez výpovědní lhůty. Měsíční tarif doběhne do konce zaplaceného měsíce, u ročního vrátíme poměrnou část.' },
      { question: 'Co když si s něčím nebudeme vědět rady?', answer: 'Napište nebo zavolejte, v pracovní dny od 8 do 17 hodin. Odpovídáme my čtyři, kteří Odpolku děláme. Na e-mail do jednoho pracovního dne, obvykle do hodiny.' },
      { question: 'Jak dostanu fakturu?', answer: 'Fakturu s DPH pošleme e-mailem první den období. Platí se převodem nebo kartou. Jsme plátci DPH, ceny na webu jsou bez daně.' },
      { question: 'Musí mít všichni chytrý telefon?', answer: 'Nemusí. Rozpis přijde i e-mailem nebo SMS a dá se vytisknout na A4. Docházku za člověka bez telefonu zapíše vedoucí.' },
    ],
    time: '', timeNote: '',
  },
  team: {
    eyebrow: 'Kdo to dělá', heading: 'Děláme ji čtyři, v Olomouci',
    text: 'Začalo to v roce 2021. Tomášova sestra vedla kavárnu a rozpis směn visel na lednici jako tabulka přepisovaná propiskou. Tomáš jí první verzi napsal za víkend, zbytek trvá dodnes.\n\nNemáme investora ani obchodní oddělení. Žijeme z předplatného necelých čtyř set provozů a telefon zvedá ten, kdo aplikaci programuje.',
    imageCaption: 'Celá firma u jednoho stolu. Olomouc, Odpolková 12',
    dataLabel: 'Data', dataHeadline: 'Servery v Praze, noční záloha v Brně.', dataText: 'Nic neopouští Českou republiku.',
    supportLabel: 'Podpora', outsideLabel: 'Mimo hodiny', outsideText: 'Když aplikace neběží, držíme pohotovost i o víkendu.',
    formEyebrow: '', formHeading: 'Napište nám',
    formText: 'Nejste si jistí, jestli se Odpolka hodí na váš provoz? Popište ho dvěma větami, odpovíme do jednoho pracovního dne.',
    formNote: 'Odesláním souhlasíte se *zpracováním údajů* pro odpověď.',
    time: '', timeNote: '',
  },
  contact: {
    eyebrow: '', heading: 'Napište nám',
    text: 'Nejste si jistí, jestli se Odpolka hodí na váš provoz? Popište ho dvěma větami, odpovíme do jednoho pracovního dne.',
    note: 'Odesláním souhlasíte se *zpracováním údajů* pro odpověď.',
    time: '', timeNote: '',
  },
  cta: {
    eyebrow: '30 dní zdarma · bez platební karty', heading: 'Příští rozpis už udělejte v Odpolce',
    text: 'Po třiceti dnech si vyberete tarif od 290 Kč měsíčně, nebo účet necháte zamknout a data si stáhnete.',
    buttonLabel: 'Založit účet',
    time: '', timeNote: '',
  },
  pages: {
    news: { title: 'Novinky', heading: 'Všechny novinky', text: 'Novou verzi vydáváme zhruba jednou za tři týdny. Tady je všechno, co jsme od roku 2021 změnili.' },
    contact: { title: 'Kontakt' },
    terms: { title: 'Obchodní podmínky', paragraphs: ['Toto jsou ukázkové obchodní podmínky vymyšleného produktu Odpolka. Nahraďte je vlastními.', 'Službu poskytujeme na dobu neurčitou. Zrušit ji můžete kdykoli v nastavení účtu, bez výpovědní lhůty.', 'Ceny jsou uvedeny bez DPH. Fakturu posíláme e-mailem první den zaplaceného období.'] },
    privacy: { title: 'Ochrana osobních údajů', paragraphs: ['Toto je ukázkový text o ochraně osobních údajů. Nahraďte ho vlastním.', 'Údaje, které nám pošlete formulářem (jméno, e-mail, zpráva), použijeme jen k tomu, abychom vám odpověděli.', 'Data zákazníků ukládáme na serverech v Praze a každou noc je zálohujeme do druhého datového centra v Brně.'] },
    processing: { title: 'Zpracovatelská smlouva', paragraphs: ['Toto je ukázková zpracovatelská smlouva k vymyšlenému produktu Odpolka. Nahraďte ji vlastní.', 'Zpracováváme jen údaje, které nám svěříte, a jen k poskytování služby. Po zrušení účtu je smažeme do 60 dnů.'] },
    cookies: { title: 'Cookies', paragraphs: ['Toto je ukázkový text o cookies. Nahraďte ho vlastním.', 'Web používá jen cookies nutné k tomu, aby fungoval přihlášený účet. Žádné sledovací cookies nepoužíváme.'] },
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    kavarna: 'Majitelka kavárny rovná ráno hrnky na polici za pultem',
    malir: 'Malíř Petr Koubek s válečkem v právě malovaném pokoji',
    salon: 'Kadeřnice Simona Vaňková skládá ručník vedle křesla ve svém salonu',
    obchod: 'Prodavač nese bedýnku jablek mezi regály malého obchodu',
    portretJitka: 'Jitka Marková',
    portretKoubek: 'Petr Koubek',
    portretVankova: 'Simona Vaňková',
    tym: 'Čtyři lidé z týmu Odpolky u jednoho stolu v kanceláři',
  },
}

// What a look's design words differently from the texts above: a site made in that look gets
// these (the seed is told the look; a list is replaced whole). Manual's wording is the shared
// one; Magnets asks a question in every heading; One Day tells the product as one working day.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  magnety: {
    opening: {
      eyebrow: '', heading: 'Kdo má zítra ranní?',
      text: '*Odpolka je rozpis směn a docházka* pro kavárny, obchody, salony a řemeslnické party do padesáti lidí. Každý má své směny v telefonu, takže se nikdo neptá.',
      secondaryLabel: '', note: 'Bez platební karty. Potom od 290 Kč měsíčně.',
      facts: [], screen: 'none', caption: '', notes: [],
    },
    audience: {
      eyebrow: 'Pro koho to je', heading: 'Pro provozy, kde se lidé střídají a šéf u toho sám pracuje.', text: '',
      tags: ['kavárny a bistra', 'obchody', 'salony', 'party řemeslníků', 'penziony', 'úklidové firmy', 'od 3 do 50 lidí'],
      photos: [{ photo: 'obchod', title: 'Farmářský krámek v Přerově', caption: '4 lidé, otevřeno šest dní' }],
    },
    features: {
      eyebrow: '', heading: 'Co Odpolka umí', text: '',
      items: [
        {
          title: 'Rozpis na týden', question: '„Kdy dělám příští týden?“', when: 'Neděle 20:14, kavárna Na Růžku v Olomouci.',
          text: 'Jitka založí týden ze šablony, přesune dvě směny a klepne na Zveřejnit. Šest lidí má rozpis v telefonu a ona vidí, kdo ho četl.',
          points: ['Šablony týdnů a kopie toho minulého', 'Upozorní, když dáte směnu přes dovolenou', 'Tisk na A4 pro dveře skladu'], screen: 'week',
        },
        {
          title: 'Výměna směny', question: '„Bára nemůže. Kdo to vezme?“', when: 'Čtvrtek 6:40.',
          text: 'Bára se vzbudí s horečkou a nabídne ranní směnu ostatním. Za čtyři minuty ji bere Marek. Jitka jen klepne na Potvrdit. Nikdo nikomu nevolá.', screen: 'swap',
        },
        {
          title: 'Docházka', question: '„Kde je dneska Milan?“', when: 'Pondělí 7:35, malíři Koubek ze Šternberka.',
          text: 'Pět lidí na třech stavbách si na místě zapíše příchod v telefonu. Petr vidí, kdo kde je, a nemusí nikam jezdit.', screen: 'attendance', photo: 'malir',
        },
        {
          title: 'Podklady pro mzdy', question: '„Kolik to dělá hodin?“', when: '30. listopadu, kadeřnictví v Prostějově.',
          text: 'Simona dřív poslední dva večery v měsíci opisovala hodiny z diáře. Teď zkontroluje součty a pošle účetní jeden soubor: hodiny, soboty, dovolené.',
          note: 'Export do XLSX, CSV a PDF · příplatky za soboty a svátky podle vašeho nastavení', screen: 'payroll', photo: 'salon',
        },
      ],
    },
    pricing: {
      eyebrow: 'Ceník · ceny bez DPH', heading: '„A kolik to stojí?“',
      text: 'Platíte za provoz, ne za každého člověka. Při roční platbě vyjde rok na cenu deseti měsíců.',
      yearlyNote: '', afterLabel: 'Třicátý první den',
      afterText: 'Vyberete si tarif. Když ne, účet se zamkne jen pro čtení a data si 60 dní můžete stáhnout.',
      afterNote: 'Nic se samo nestrhne, kartu po vás nechceme.', moreText: 'Víc než 50 lidí? *Napište nám.*',
    },
    testimonials: { eyebrow: 'Co říkají ti, kdo ji používají', heading: '„A funguje to?“' },
    changelog: {
      eyebrow: 'Novinky · nová verze zhruba každé tři týdny', heading: '„Děláte na tom ještě?“',
      text: 'Děláme. Většina změn vzniká z toho, co nám napíšete nebo řeknete do telefonu.', linkLabel: 'Všechny novinky od roku 2021',
    },
    questions: { eyebrow: 'Časté otázky', heading: '„A co když…?“', text: 'Na co se lidé ptají, než nám svěří rozpis. Chybí tu vaše otázka? *Zeptejte se nás.*' },
    team: {
      eyebrow: 'Kdo to dělá', heading: 'Čtyři lidé v Olomouci.',
      dataLabel: 'Kde jsou data', supportLabel: 'Podpora', outsideLabel: '', outsideText: 'Když aplikace neběží, držíme pohotovost i o víkendu.',
      formEyebrow: 'Napište nám', formHeading: '„A hodí se to pro nás?“', formText: 'Popište svůj provoz dvěma větami. Odpovíme do jednoho pracovního dne.', formNote: '',
    },
    cta: {
      eyebrow: '', heading: 'Zítra ráno to vědí všichni.',
      text: '*30 dní zdarma, bez platební karty.* První rozpis máte za deset minut. Potom od 290 Kč měsíčně, nebo účet necháte zamknout a data si stáhnete.',
    },
    // (the support hours as the board writes them)
    settings: { supportHours: 'po–pá 8–17' },
  },
  'jeden-den': {
    opening: {
      eyebrow: 'Rozpis směn a docházka pro malé provozy', heading: 'V 6:40 píše Bára, že nepřijde. V 6:45 je to vyřešené.',
      text: 'Odpolka je aplikace pro kavárny, obchody, salony a řemeslnické party do padesáti lidí. Každý má své směny v telefonu, výměnu si lidé domluví sami a vy ji jen potvrdíte.',
      secondaryLabel: 'Potom od 290 Kč měsíčně',
      facts: [], screen: 'swap', caption: '', notes: [], time: '06:40', timeNote: 'čtvrtek, svítá',
    },
    audience: {
      eyebrow: '', heading: 'Kdo Odpolku používá', time: '', timeNote: '',
      tags: ['kavárny a bistra', 'obchody', 'salony', 'party řemeslníků'],
    },
    features: {
      eyebrow: '', heading: 'Čtyři chvíle, kdy se Odpolka hodí',
      text: 'Neumí všechno. Umí rozpis, výměny, docházku a podklady pro mzdy. Ke každé z těch věcí je tu jedna chvíle u někoho, kdo ji používá.',
      items: [
        {
          title: 'Výměna směny bez telefonování', when: 'čtvrtek 6:40 · kavárna Na Růžku, Olomouc',
          text: 'Bára se probudí s horečkou a nabídne svou ranní směnu ostatním. Za čtyři minuty ji bere Marek. Jitce stačí jedno klepnutí. Rozpis se přepíše sám a oba dostanou zprávu.',
          note: 'Nabídku vidí jen ti, kdo ten den mohou. Stejnou cestou jdou žádosti o dovolenou a volno.', screen: 'swap',
        },
        {
          title: 'Docházka z místa, kde se pracuje', when: 'pondělí 7:35 · malíři Koubek, Šternberk',
          text: 'Petr má pět lidí na třech stavbách. Každý si ráno na místě zapíše příchod v telefonu. V 7:35 Petr vidí, že v Olomouci začali o půl hodiny později, a nemusí kvůli tomu nikam jezdit ani volat.',
          note: 'Funguje i bez signálu. Za člověka bez telefonu zapíše příchod vedoucí.', screen: 'attendance', photo: 'malir',
        },
        {
          title: 'Rozpis na týden za deset minut', when: 'neděle 20:14 · kavárna Na Růžku, Olomouc',
          text: 'Jitka založí týden ze šablony, upraví dvě věci a klepne na Zveřejnit. Šest lidí má rozpis v telefonu a ona vidí, kdo ho četl.',
          note: 'Odpolka upozorní, když někomu dáte směnu přes dovolenou. A rozpis vytiskne na A4 pro ty, kdo ho chtějí na dveřích.', screen: 'week',
        },
        {
          title: 'Podklady pro mzdy jedním souborem', when: '30. listopadu 16:30 · kadeřnictví, Prostějov',
          text: 'Simona dřív poslední dva večery v měsíci opisovala hodiny z papírového diáře. Teď zkontroluje součty a pošle účetní jeden soubor: hodiny, soboty, dovolené.',
          note: 'Příplatky za soboty a svátky podle vašeho nastavení. Export do XLSX, CSV a PDF.', screen: 'payroll', photo: 'salon',
        },
      ],
      time: '07:00', timeNote: 'provoz se rozjíždí',
    },
    pricing: {
      eyebrow: '', heading: 'Kolik to stojí',
      text: 'Platíte za provoz, ne za každého člověka. Ceny jsou za měsíc a bez DPH. Při roční platbě vyjde rok na cenu deseti měsíců.',
      yearlyNote: '', afterLabel: 'Co bude třicátý první den',
      afterText: 'Vyberete si tarif. Když ne, účet se zamkne jen pro čtení a rozpisy i docházku si ještě 60 dní můžete stáhnout. Nic se samo nestrhne: kartu po vás nechceme.',
      time: '12:00', timeNote: 'polední pauza, čas počítat',
    },
    testimonials: { eyebrow: '', heading: 'Co o ní říkají u pultu, v salonu a na stavbě', time: '15:00', timeNote: 'střídá se odpolka' },
    changelog: {
      eyebrow: '', heading: 'Co je nového', linkLabel: 'Všechny novinky od roku 2021',
      imageCaption: 'Tisk na A4 vznikl kvůli krámku v Přerově. Rozpis tam visí na dveřích skladu.', time: '17:00', timeNote: 'co jsme mezitím stihli',
    },
    questions: { eyebrow: '', heading: 'Na co se lidé ptají', text: 'Než nám svěří rozpis. Chybí tu vaše otázka? *Zeptejte se nás.*', time: '19:00', timeNote: 'stmívá se, čas na otázky' },
    team: {
      eyebrow: '', heading: 'Děláme ji čtyři, v Olomouci', imageCaption: '',
      dataLabel: 'Kde jsou data', supportLabel: 'Podpora', outsideLabel: '', formHeading: 'Napište nám, co vás zajímá',
      formText: '', formNote: 'Odpovíme do jednoho pracovního dne.', time: '21:00', timeNote: 'po zavíračce, mezi svými',
    },
    cta: {
      eyebrow: '', heading: 'Zítra v 6:40 to už může vyřídit Odpolka.',
      text: 'Bez platební karty. Po třiceti dnech si vyberete tarif od 290 Kč měsíčně, nebo účet necháte zamknout a data si stáhnete.',
      buttonLabel: 'Vyzkoušet 30 dní zdarma', time: '22:00', timeNote: 'zhasínáme, zítra nanovo',
    },
    settings: { supportHours: 'pondělí až pátek 8–17' },
  },
}
