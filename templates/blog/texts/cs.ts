// Every Czech text of the Blog template, in one place: the website's own words (what is not
// content: "min čtení", "Krátce", the anchors of the sections) and the demo content the seed
// puts in. Another language is a file beside this one with the same two exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

export interface Words extends KitWords {
  openMenu: string
  closeMenu: string
  /** The label of the sections' menu. */
  sections: string
  footerSections: string
  subscribe: string
  newsletter: string
  imprint: string
  /** Čtvrthodinka's name of the footer's last column. */
  publisher: string
  /** "Vydává Souvrať, z. s." */
  publishedBy: (publisher: string) => string
  companyId: string
  // ── search ──
  searchLabel: string
  /** "Hledat v 26 článcích" */
  searchIn: (n: number) => string
  /** The short placeholder of the header's box in Čtvrthodinka. */
  searchShort: string
  searchPlaceholder: string
  search: string
  found: (n: number, term: string) => string
  nothingFound: (term: string) => string
  // ── articles ──
  column: string
  brief: string
  /** "14 min čtení" */
  minRead: (n: number) => string
  /** "14 min" */
  min: (n: number) => string
  /** "15 článků, 2 h 14 min čtení" */
  stats: (count: number, readingTime: string) => string
  allArticles: string
  noArticles: string
  /** "Foto: Tomáš Havlena" */
  photoBy: (credit: string) => string
  writtenBy: string
  /** "Dále v rubrice Lidé" */
  moreFrom: (section: string) => string
  /** "148 článků" */
  articlesOf: (n: number) => string
  /** "20 hodin čtení" */
  hoursOf: (minutes: number) => string
  articlesByAuthor: string
  // ── the issue ──
  /** "Týden 48" */
  week: (n: number) => string
  /** "týden 48 · 23. listopadu 2026" */
  issue: (week: number, date: string) => string
  /** "vyšlo 15 článků, 2 h 14 min čtení" */
  issued: (stats: string) => string
  /** "Pondělí 23. listopadu" */
  today: (weekday: string, day: string, month: string) => string
  // ── series ──
  series: string
  /** "díl 11 z 12" */
  partOfTotal: (n: number, total: number) => string
  /** "díl 11" */
  part: (n: number) => string
  /** "Rok na samotě, díl 10: Tma v pět" */
  partOf: (series: string, n: number, title: string) => string
  /** "Číst jedenáctý díl" */
  readPart: (n: number) => string
  newPart: string
  /** "vyjde 19. prosince" */
  comesOut: (date: string) => string
  allParts: string
  previousPart: string
  nextPart: string
  months: string[]
  // ── the newsletter ──
  emailPlaceholder: string
  /** The line under the field; the *marked* part leads to the privacy policy. */
  consent: string
  account: string
  // ── Čtvrthodinka's own words ──
  askLabel: string
  shelves: Record<'5' | '15' | '60', string>
  /** "6 článků", "1 dlouhé čtení" */
  shelfCount: (key: '5' | '15' | '60', n: number) => string
  shelfIdle: string
  /** "Svítí 6 článků do pěti minut, dohromady 23 min. Dalším klepnutím výběr zrušíte." */
  shelfLit: (key: '5' | '15' | '60', n: number, minutes: number) => string
  stairsNote: string
  /** "4 minuty čtení", for a screen reader */
  minutesRead: (n: number) => string
  evening: string
  /** "Seriál · 12 dílů, jeden každý měsíc" */
  seriesMeta: (total: number, byMonth: boolean) => string
  yearOfParts: string
  /** The addresses of the sections on a page (`/#serial`), by block type. */
  anchors: Record<'picks' | 'list' | 'series' | 'sections' | 'newsletter' | 'authors' | 'about' | 'search', string>
}

const nbsp = ' '
const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)
const ordinals = ['první', 'druhý', 'třetí', 'čtvrtý', 'pátý', 'šestý', 'sedmý', 'osmý', 'devátý', 'desátý', 'jedenáctý', 'dvanáctý']
const SHELF_RANGE = { '5': 'do pěti minut', '15': 'na čtvrt hodiny', '60': 'na celý večer' } as const

export const words: Words = {
  ...KIT_WORDS.cs,
  openMenu: 'Otevřít menu', closeMenu: 'Zavřít menu',
  sections: 'Rubriky', footerSections: 'Rubriky v patičce', subscribe: 'Odebírat', newsletter: 'Newsletter', imprint: 'Tiráž', publisher: 'Vydavatel',
  publishedBy: (publisher) => `Vydává ${publisher}`,
  companyId: 'IČO',
  searchLabel: 'Hledat v článcích',
  searchIn: (n) => `Hledat v${nbsp}${n}${nbsp}${plural(n, 'článku', 'článcích', 'článcích')}`,
  searchShort: 'Hledat',
  searchPlaceholder: 'Co hledáte?',
  search: 'Hledat',
  found: (n, term) => `${n}${nbsp}${plural(n, 'článek', 'články', 'článků')} k hledanému „${term}“`,
  nothingFound: (term) => `K hledanému „${term}“ jsme nic nenašli. Zkuste jiné slovo.`,
  column: 'Sloupek', brief: 'Krátce',
  minRead: (n) => `${n}${nbsp}min čtení`,
  min: (n) => `${n}${nbsp}min`,
  stats: (count, readingTime) => `${count}${nbsp}${plural(count, 'článek', 'články', 'článků')}, ${readingTime.replace(' ', nbsp)} čtení`,
  allArticles: 'Všechny články', noArticles: 'Zatím tu nejsou žádné články.',
  photoBy: (credit) => `Foto: ${credit}`,
  writtenBy: 'Napsal(a)',
  moreFrom: (section) => `Dále v rubrice ${section}`,
  articlesOf: (n) => `${n}${nbsp}${plural(n, 'článek', 'články', 'článků')}`,
  hoursOf: (minutes) => { const h = Math.max(1, Math.round(minutes / 60)); return `${h}${nbsp}${plural(h, 'hodina', 'hodiny', 'hodin')} čtení` },
  articlesByAuthor: 'Články autora',
  week: (n) => `Týden ${n}`,
  issue: (week, date) => `týden ${week} ${nbsp}·${nbsp} ${date.replace(' ', nbsp)}`,
  issued: (stats) => `vyšlo ${stats}`,
  today: (weekday, day, month) => `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day}.${nbsp}${month}`,
  series: 'Seriál',
  partOfTotal: (n, total) => `díl ${n}${nbsp}z${nbsp}${total}`,
  part: (n) => `díl ${n}`,
  partOf: (series, n, title) => `${series}, díl ${n}: ${title}`,
  readPart: (n) => `Číst ${ordinals[n - 1] ?? `${n}.`} díl`,
  newPart: 'nový',
  comesOut: (date) => `vyjde ${date.replace(/ /g, nbsp)}`,
  allParts: 'Všechny díly', previousPart: 'Předchozí díl', nextPart: 'Další díl',
  months: ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'],
  emailPlaceholder: 'jmeno@email.example',
  consent: 'Odesláním souhlasíte se zasíláním newsletteru na uvedenou adresu. Odhlásíte se jedním klikem v každém e-mailu. Podrobnosti najdete v *zásadách ochrany osobních údajů*.',
  account: 'Účet',
  askLabel: 'Vybrat články podle délky čtení',
  shelves: { '5': 'Pět minut', '15': 'Čtvrt hodiny', '60': 'Celý večer' },
  shelfCount: (key, n) => (key === '60' ? `${n}${nbsp}${plural(n, 'dlouhé čtení', 'dlouhá čtení', 'dlouhých čtení')}` : `${n}${nbsp}${plural(n, 'článek', 'články', 'článků')}`),
  shelfIdle: 'Vyberte a ostatní články ustoupí do pozadí.',
  shelfLit: (key, n, minutes) => `Svítí ${n} ${plural(n, 'čtení', 'články', 'článků')} ${SHELF_RANGE[key]}, dohromady ${minutes} min. Dalším klepnutím výběr zrušíte.`,
  stairsNote: 'Seřazeno od nejkratšího. Čím delší pruh, tím delší čtení a větší titulek.',
  minutesRead: (n) => `${n} ${plural(n, 'minuta', 'minuty', 'minut')} čtení`,
  evening: 'Na celý večer',
  seriesMeta: (total, byMonth) => `Seriál ${nbsp}·${nbsp} ${total} ${plural(total, 'díl', 'díly', 'dílů')}${byMonth ? ', jeden každý měsíc' : ''}`,
  yearOfParts: 'Díly seriálu po měsících',
  anchors: { picks: 'tyden', list: 'obsah', series: 'serial', sections: 'rubriky', newsletter: 'newsletter', authors: 'autori', about: 'o-nas', search: 'hledat' },
  defaultName: 'Magazín',
}

// ── the demo content: Souvrať, a small magazine from the highlands near Žďár, with three
//    authors, five sections, one series (Rok na samotě) and a Sunday newsletter. The people,
//    the phone numbers and the addresses are invented. ──

/** An article of the demo. `date` is a day in 2026; `minutes` the reading time the editors set. */
export interface DemoArticle {
  title: string
  section: 'lide' | 'krajina' | 'pamet' | 'kuchyne' | 'remeslo'
  author: 'marketa' | 'tomas' | 'bara'
  date: string
  minutes: number
  photo?: 'pastevec' | 'prehrada' | 'polevka' | 'sindel' | 'zidka' | 'studanka' | 'vcelar' | 'krizaly' | 'samota'
  perex: string
  /** A shorter headline for the list of sections. */
  shortTitle?: string
  /** Paragraphs; a line starting with "## " is a subheading. */
  body: string[]
  kind?: 'column'
  lead?: boolean
  pick?: boolean
  brief?: boolean
  mostRead?: number
}

const articles: DemoArticle[] = [
  {
    title: 'Čtyřicet let pase ovce na stráních, které nikdo jiný nechtěl', section: 'lide', author: 'marketa', date: '2026-11-21', minutes: 14, photo: 'pastevec', lead: true,
    perex: 'Josef Ptáček z Líšné převzal v roce 1986 pastviny, kam se nevešel traktor. Dnes mu tři obce platí za to, že je udržuje, a on řeší, komu jednou předá stádo.',
    body: [
      'Ve čtyři ráno je na stráni nad Líšnou tma a zima. Josef Ptáček už je venku, protože ovce se nedají přesvědčit, aby počkaly. Za čtyřicet let se naučil poznat podle zvonce, které z nich šlo za ostatními a které se zdrželo u kamene.',
      'Pastviny, kam se nevešel traktor, převzal v roce 1986 po sousedovi, který odcházel do města. Tehdy je nikdo nechtěl. Dnes mu tři obce platí za to, že je udržuje, protože bez ovcí by do pěti let zarostly smrčkem a jalovcem a s nimi by zmizel i výhled, kvůli kterému sem lidé jezdí.',
      '## Komu předá stádo',
      'Děti odešly do Brna a do Prahy a nikdo z nich se nevrací. Josef o tom nemluví rád. Řekne jen, že ovce nejsou práce, do které se dá vstoupit na zkoušku, a že mu loni zazvonil mladý pár z Jimramova. Zatím se jen přišli podívat.',
    ],
  },
  {
    title: 'Zatopená náves', section: 'pamet', author: 'marketa', date: '2026-11-19', minutes: 11, photo: 'prehrada', pick: true, mostRead: 1,
    perex: 'Pod hladinou Vírské přehrady leží od roku 1957 Chudobín. Tři pamětníci nám nakreslili, kde stála škola, hospoda a jejich dům.',
    body: [
      'Letos v říjnu klesla hladina tak nízko, že se u břehu ukázal kus staré cesty. Lidé z okolí ji znají z vyprávění, ale vidět ji nikdo nečekal. Vydali jsme se za třemi lidmi, kteří v Chudobíně vyrostli.',
      'Každý z nich dostal prázdný list papíru a tužku. Škola podle nich stála u rybníčku, hospoda naproti ní a návsí vedla cesta, po které se v neděli chodilo k mši. Nakreslené mapy se neshodují v ničem než v tom, kde stál kostel.',
      '## Co se nevešlo na mapu',
      'Paní Marie si pamatuje, že poslední zimu před zatopením se děti klouzaly na ledě, který už byl v dolině nad domy. Pan Karel dodává, že nejhorší nebylo stěhování, ale to, že se dlouho nevědělo kam.',
    ],
  },
  {
    title: 'Bramboračka, do které patří hřiby, a ne smetana', section: 'kuchyne', author: 'bara', date: '2026-11-18', minutes: 6, photo: 'polevka', pick: true, mostRead: 2,
    perex: 'Recept z Fryšavy po prababičce: sušené houby namočit večer, majoránku až nakonec a zahustit jen bramborami.',
    body: [
      'Prababička vařila bramboračku v hrnci, který měl odštípnutý smalt a vždycky stál na kraji plotny. Smetanu do ní nikdy nedala, protože ji prodávali, ne vařili.',
      'Sušené hřiby namočte večer do studené vody. Ráno je vyndejte, nakrájejte a vodu sceďte přes plátýnko. Brambory a kořenovou zeleninu nakrájejte na kostky a vařte v houbové vodě, dokud brambory nezačnou praskat.',
      'Polévku zahustěte tím, že část brambor rozmačkáte přímo v hrnci. Majoránku přidejte až nakonec, aby neztratila vůni, a česnek až na talíři.',
    ],
  },
  {
    title: 'V Křižánkách se zase štípe šindel', section: 'remeslo', author: 'tomas', date: '2026-11-17', minutes: 9, photo: 'sindel', pick: true,
    perex: 'Poslední šindelář tu skončil v roce 1978. Dva truhláři se teď řemeslo naučili znovu, podle nářadí z jeho půdy.',
    body: [
      'Nářadí leželo na půdě pod senem: ocelový šindelák, dřevěná palice a lavice, na které se kdysi štípalo. Dům koupili dva truhláři z Nového Města a o jejich nálezu se brzy dozvěděla celá vesnice.',
      'Smrk na šindel musí být rovný a bez suků. Štípe se podél letokruhů, ne řeže, protože štípaný šindel nechává vodě cestu dolů, zatímco řezaný ji nasává. Rozdíl poznáte po první zimě.',
      'Na kapli, kterou letos opravovali, nechali čtyři sta šindelů. Až se bude střecha příště přebírat, mají prý naučit někoho dalšího.',
    ],
  },
  {
    title: 'Proč se na Vysočině stavěly kamenné zídky nasucho a kdo je dnes ještě umí opravit, když se po zimě sesunou', section: 'krajina', author: 'tomas', date: '2026-11-15', minutes: 12, photo: 'zidka', shortTitle: 'Proč se na Vysočině stavěly kamenné zídky nasucho',
    perex: 'Zídky z žulových balvanů dělily pole tisíc let. Maltu nepotřebovaly, jen ruce, které věděly, který kámen kam patří.',
    body: [
      'Když se na jaře po tání sesune kus zídky, zbývá po něm hromada kamení a tichá otázka, kdo to bude skládat. Zídka stavěná nasucho se totiž dá opravit, ale jen když člověk ví jak.',
      'Kameny se skládají tak, aby každý ležel na dvou dalších a aby žádná spára nešla v celé výšce. Největší patří dolů, nejplošší nahoru. Vnitřek se vyplní drobným kamením, které drží celek pohromadě.',
      '## Kdo to dnes umí',
      'V okolí jsou čtyři lidé, kteří zídky opravují za peníze, a asi dvacet, kteří je opravují ze zvyku. Kurz, který pořádá obec, je na celé léto vyprodaný.',
    ],
  },
  {
    title: 'Sedm studánek, ke kterým dojdete i v listopadu', section: 'krajina', author: 'tomas', date: '2026-11-14', minutes: 5, photo: 'studanka', mostRead: 4,
    perex: 'Cesty jsou prázdné, listí mokré a voda ve studánkách čistší než v létě. Sedm míst, kam se dá dojít za odpoledne.',
    body: [
      'V listopadu se po lese chodí jinak. Nikam se nespěchá, ticho je slyšet a studánky, které se v létě skrývají mezi turisty, jsou najednou jen vaše.',
      'Všech sedm studánek je do čtyř kilometrů od nejbližší zastávky. U každé visí hrnek na řetízku, což je lepší znamení než jakákoli cedule. Vodu z nich nepijte bez převaření, pokud se obec nebo vodárna nezaručí jinak.',
    ],
  },
  {
    title: 'Tichá sezóna', section: 'krajina', author: 'tomas', date: '2026-11-13', minutes: 2, kind: 'column',
    perex: 'V listopadu sem nikdo nejezdí. Parkoviště pod Devíti skalami je prázdné, hospoda má zavřeno a les je konečně slyšet.',
    body: [
      'V listopadu sem nikdo nejezdí. Parkoviště pod Devíti skalami je prázdné, hospoda má zavřeno a les je konečně slyšet.',
      'Zvykl jsem si, že v tuhle dobu chodím nejraději. Jen já, pár srnců a vítr, který si hraje s posledním listím. Nikomu to nedoporučuju, aby mi to nezkazil.',
    ],
  },
  {
    title: 'Co se naučíte za rok u včel, když začínáte v padesáti', section: 'lide', author: 'bara', date: '2026-11-12', minutes: 8, photo: 'vcelar',
    perex: 'Včelařka z Ostrova nad Oslavou začala se čtyřmi úly po tátovi. Za rok se naučila trpělivost, kterou předtím nepoznala.',
    body: [
      'Úly po tátovi stály za domem pět let nepoužité. Když je dcera nakonec otevřela, zjistila, že dva z nich jsou obydlené. Nikdo je tam nedal, včely se usadily samy.',
      'První rok nedělala skoro nic. Chodila se dívat. Naučila se poznat podle zvuku, kdy je včelstvo klidné, a podle vůně, kdy se chystá rojit. Medu bylo málo, ale ten první jí chutnal jako nic předtím.',
    ],
  },
  {
    title: 'Křížaly z jablek, která nikdo nechtěl', section: 'kuchyne', author: 'bara', date: '2026-11-11', minutes: 4, photo: 'krizaly',
    perex: 'Sušená jablka na šňůře nad kamny jsou nejstarší zimní zásoba. Stačí jabka, nůž, jehla a trpělivost.',
    body: [
      'Jablka, která spadla z větve a mají flíček, na zimu nejsou. Na křížaly jsou ale dobrá. Odkrojte, co je poškozené, vykrojte jádřinec a nakrájejte na kolečka.',
      'Kolečka navlékněte na provázek a pověste nad kamna nebo na půdu, kde táhne. Za týden jsou tuhá, za dva křupavá. Skladujte v plátěném pytlíku.',
    ],
  },
  {
    title: 'Zabijačka bez nostalgie', section: 'kuchyne', author: 'bara', date: '2026-11-10', minutes: 4,
    perex: 'Zabijačka nebyla svátek, byla práce. Jak vypadá, když se dělá po staru, ale bez vzpomínek na to, jak to bývalo.',
    body: [
      'Říká se, že dřív bylo všechno lepší. U zabijačky tomu tak nebylo. Vstávalo se ve tři, ruce zábly a nikdo nebyl rád, že to musí udělat.',
      'Dnes se zabijačka dělá, protože někdo chce vědět, co jí. A protože se maso z domácího prasete nedá s ničím srovnat. Zbytek je práce a pomoc sousedů.',
    ],
  },
  {
    title: 'Zvoníkovi v Daňkovicích je čtrnáct', section: 'lide', author: 'marketa', date: '2026-11-20', minutes: 3, brief: true,
    perex: 'Vojta chodí zvonit před školou. Zvon prý poznal po zvuku dřív než písmena.',
    body: [
      'Vojta chodí zvonit každý den před školou. Zvon v Daňkovicích zná od malička a tvrdí, že ho poznal po zvuku dřív než písmena.',
      'Zvonit se musí rovnoměrně a nahlas, ale ne moc. Naučil ho to starý zvoník, který už nevidí. Teď oba čekají, kdo to jednou převezme po Vojtovi.',
    ],
  },
  {
    title: 'Kronikář psal hlavně o počasí. Jaká byla zima roku 1929', section: 'pamet', author: 'marketa', date: '2026-11-16', minutes: 7, brief: true,
    perex: 'Obecní kronika z Daňkovic zná jen jednu opravdovou zimu. V roce 1929 mrzlo do konce března a lidé chodili po zamrzlé řece.',
    body: [
      'Kronikář obce psal každý večer. Většina zápisů je o počasí, o ceně obilí a o tom, kdo se oženil. Zima roku 1929 mu zabrala čtyřicet stran.',
      'Mrzlo od prosince do konce března, řeka zamrzla na půl metru a lidé po ní chodili do vedlejší vsi. Kronikář si zapsal i to, kolik dřeva která rodina spálila.',
    ],
  },
  {
    title: 'Betlémy z Třeště: kde je letos uvidíte doma u lidí', section: 'remeslo', author: 'bara', date: '2026-11-13', minutes: 5, brief: true,
    perex: 'Betlémáři z Třeště otevřou na adventní víkendy svoje domy. Seznam míst a pár slov o tom, jak se betlém staví.',
    body: [
      'Třešťské betlémy stojí v obývacích pokojích celý rok, ale v adventu se otevírají. Kdo přijde, dostane čaj a vyprávění o tom, jak dlouho se stavěl.',
      'Letos je otevřeno dvanáct domů. Seznam najdete na návsi, ale nejlepší je zeptat se prvního člověka, kterého potkáte.',
    ],
  },
  {
    title: 'Kovář, který ková jen v zimě', section: 'remeslo', author: 'tomas', date: '2026-11-09', minutes: 9, mostRead: 5,
    perex: 'V létě kovář sází stromy a stará se o ovce. Na podzim zapálí výheň a nepřestane do jara.',
    body: [
      'Kovárna ve Fryšavě se otevírá s prvním mrazem. Kovář tvrdí, že v létě se žehle kovat nedá, protože železo je moc rozpálené a on taky.',
      'Zimní zakázky jsou podkovy, hřebíky, kování na dveře a občas nůž. Za pracovním stolem visí seznam, kdo čeká na co, a od října je na něm vždycky víc jmen, než kovář stihne.',
    ],
  },
  {
    title: 'Kudy vedla úzkokolejka do skláren', section: 'pamet', author: 'marketa', date: '2026-11-08', minutes: 10,
    perex: 'Přes les mezi Sklenými a Štarkovem vedla do roku 1962 úzká kolejnice. Stopa v terénu je pořád vidět, když víte, kde hledat.',
    body: [
      'Úzkokolejka vozila sklo, dřevo a lidi. Po zrušení ji obce rozebraly na kolejnice a pražce, ale násyp zůstal. Dnes po něm vede stezka, o které většina turistů neví, odkud je.',
      'Nejlépe je násyp vidět v listopadu, když opadá listí. Stačí jít podél starých milníků, které někdo před šedesáti lety zapomněl odvézt.',
    ],
  },
]

/** The parts of the series Rok na samotě: November (11) is the one the front page shows. */
export interface DemoPart { n: number; title: string; date: string; minutes: number; perex: string; body: string[] }

const parts: DemoPart[] = [
  { n: 1, title: 'Leden: cesta, kterou nikdo neprotáhne', date: '2026-01-20', minutes: 19, perex: 'První měsíc na samotě začíná lopatou. Pluh se sem nedostane, a tak se cesta ke sněhu přizpůsobuje.', body: ['Silnice končí kilometr a půl pod chalupou. Zbytek je cesta, kterou si musí každý udělat sám.', 'Za týden se naučím, že lopata je nástroj a že hlava je důležitější. Sníh se odhazuje nahoru, ne dolů.'] },
  { n: 2, title: 'Únor: kolik dřeva je dost', date: '2026-02-20', minutes: 20, perex: 'Zásoba dřeva se počítá na metry a na hodiny u kamen. Naučil jsem se, že dost je vždycky o kus víc.', body: ['Na zimu jsem připravil osm metrů. V únoru jsem měl dvanáct, a skoro nic nezbylo na jaro.', 'Sousedé radí odhadovat podle toho, kolik dřeva spálíte v nejchladnějším týdnu, a vynásobit třemi.'] },
  { n: 3, title: 'Březen: voda ve sklepě', date: '2026-03-20', minutes: 18, perex: 'S táním přišla voda. Nejprve do sklepa, pak do vzpomínek na to, proč se tu nikdo nestavěl níž.', body: ['Voda se objevila v noci. Ráno byl sklep po kotníky a studna mutná.', 'Příkop kolem domu jsem kopal tři dny. Pomohl, ale ne tak, jak jsem čekal.'] },
  { n: 4, title: 'Duben: první návštěva', date: '2026-04-20', minutes: 21, perex: 'Po čtyřech měsících mi někdo zazvonil. Byl to soused, který chtěl vrátit sekeru, kterou jsem mu nepůjčil.', body: ['Soused přišel pěšky, protože cesta byla ještě rozmoklá. Chvíli stál u dveří a pak řekl, že jen kolem šel.', 'Zůstal na čaj. Od té doby chodí každý týden, a vždycky jen kolem.'] },
  { n: 5, title: 'Květen: louka, která se nesmí sekat', date: '2026-05-20', minutes: 19, perex: 'Louka před chalupou kvete a obec mi řekla, že ji nesmím posekat před červencem. Na co všechno se čeká.', body: ['Na louce roste jedenáct druhů orchidejí. Pro mě jsou to kytky, pro úředníky chráněné druhy.', 'Seču pozdě a ručně. Seno je potom jiné než to, na které jsem byl zvyklý.'] },
  { n: 6, title: 'Červen: světlo do půl jedenácté', date: '2026-06-20', minutes: 22, perex: 'V červnu se nespí. Světlo je do půl jedenácté a ráno začíná dřív, než jsem zvyklý vstávat.', body: ['Za hřebenem zapadá slunce pomalu, jako by nechtělo odejít. Na verandě sedím do tmy.', 'Naučil jsem se, že dlouhé dny nejsou o práci, ale o tom, kolik se toho nechá nedodělat.'] },
  { n: 7, title: 'Červenec: sousedé na dohled', date: '2026-07-20', minutes: 20, perex: 'Nejbližší soused je kilometr a půl daleko, ale v létě vidím jeho světlo. Poprvé za půl roku.', body: ['Soused zapaluje lampu každý večer. Nevím, jestli je to znamení, nebo zvyk.', 'Jednou jsem odpověděl svou lampou. Druhý den přinesl koláč.'] },
  { n: 8, title: 'Srpen: studna na dně', date: '2026-08-20', minutes: 23, perex: 'V srpnu přestala téct voda. Studna na dně a já s kbelíkem na dvou kilometrech cesty k prameni.', body: ['Studna byla vždycky hluboká, ale nikdy tak prázdná. Poprvé jsem viděl její dno.', 'Voda z pramene je studená a chutná po kameni. Nosit ji je práce na celé odpoledne.'] },
  { n: 9, title: 'Září: brambory z kamení', date: '2026-09-20', minutes: 18, perex: 'Brambory rostou mezi kameny, kterými je zahrada posetá. Sklizeň je malá, ale chutná jako nic z obchodu.', body: ['Zahradu jsem kopal celý týden. Kameny, kameny a občas brambora.', 'Sklidil jsem dva pytle. Na zimu stačí, na jaro ne.'] },
  { n: 10, title: 'Říjen: tma v pět', date: '2026-10-20', minutes: 21, perex: 'Čas se změnil a tma přišla o hodinu dřív. Večery jsou teď dlouhé a lampa svítí od odpoledne.', body: ['V pět už je tma. V šest se člověk ptá, co s večerem.', 'Čtu, píšu a poslouchám vítr. Je to, co jsem hledal, i když jsem to nečekal.'], },
  { n: 11, title: 'Listopad: první sníh a poslední dříví', date: '2026-11-20', minutes: 24, perex: 'K nejbližšímu sousedovi je to kilometr a půl a pluh sem nezajíždí. Tomáš Havlena píše každý měsíc, co obnáší bydlet na hřebeni nad Sněžným. Tentokrát o tom, kdy poznáte, že dřeva je dost.', body: ['První sníh přišel v noci a ráno byla louka bílá. Na verandě ležely stopy, které nebyly moje.', 'Poslední dříví jsem přivezl na saních. Za chalupou stojí vysoká hromada a já konečně vím, kolik je dost: když se ho přestanete bát.'] },
]

export const demo = {
  settings: {
    siteName: 'Souvrať',
    tagline: 'Čtení z Vysočiny',
    ctaLabel: 'Newsletter',
    aboutLabel: 'O Souvrati',
    publisher: 'Souvrať, z. s.',
    address: 'U Vlečky 39, 592 42 Jimramov',
    companyId: '12345678',
    registration: 'ISSN 1234-5678 · MK ČR E 12345',
    email: 'redakce@souvrat.example',
    phone: '123 456 701',
    bankAccount: '1234567890/0000',
    foundedYear: 2019,
    footerNote: 'Vychází každý týden od roku 2019.',
    copyNote: 'Texty a fotografie nepřebírejte bez svolení redakce.',
    social: [
      { label: 'Instagram', url: 'https://instagram.example/souvrat' },
      { label: 'Facebook', url: 'https://facebook.example/souvrat' },
      { label: 'Mastodon', url: 'https://mastodon.example/@souvrat' },
    ],
    metaDescription: 'Souvrať je malý internetový magazín z Vysočiny. Každý týden píše o lidech, krajině, paměti, kuchyni a řemesle.',
  },
  menu: { series: 'Seriály', privacy: 'Zásady ochrany osobních údajů' },
  sections: [
    { key: 'lide', name: 'Lidé', description: 'Rozhovory a portréty sousedů.' },
    { key: 'krajina', name: 'Krajina', description: 'Cesty, lesy, voda a počasí.' },
    { key: 'pamet', name: 'Paměť', description: 'Kroniky, pamětníci, zmizelá místa.' },
    { key: 'kuchyne', name: 'Kuchyně', description: 'Recepty, které se tu opravdu vaří.' },
    { key: 'remeslo', name: 'Řemeslo', description: 'Lidé, kteří něco umějí rukama.' },
  ] as const,
  authors: [
    { key: 'marketa', name: 'Markéta Vondrová', role: 'šéfredaktorka', bio: 'Vyrostla v Jimramově, deset let psala do krajských novin. Píše o lidech a o tom, co si pamatují.', photo: 'autorMarketa' },
    { key: 'tomas', name: 'Tomáš Havlena', role: 'krajina a řemeslo', bio: 'Lesník a fotograf. Žije na samotě nad Sněžným a většinu snímků pořídil cestou do práce.', photo: 'autorTomas' },
    { key: 'bara', name: 'Bára Kosinová', role: 'kuchyně', bio: 'Kuchařka z hospody ve Fryšavě. Vaří podle sešitů po babičce a zkouší, co z nich obstojí dnes.', photo: 'autorBara' },
  ] as const,
  series: {
    name: 'Rok na samotě',
    description: 'Tomáš Havlena píše každý měsíc o tom, co obnáší bydlet na hřebeni nad Sněžným, kilometr a půl od nejbližšího souseda. Dvanáct dílů, jeden na každý měsíc roku.',
    plannedParts: 12,
    nextDate: '2026-12-19',
  },
  articles,
  parts,
  photoCredit: 'Tomáš Havlena',
  captions: { pastevec: 'Josef Ptáček se svým stádem nad Líšnou', prehrada: 'Vírská přehrada v říjnu, při nízké hladině' } as Record<string, string>,
  home: {
    title: 'Úvod',
    front: { briefHeading: 'Krátce', question: '', leadLabel: '' },
    picks: { heading: 'Minulý týden', note: '' },
    list: {
      heading: 'Obsah',
      text: 'Co dalšího vyšlo od minulé neděle. Krátké texty stihnete u kávy, dlouhé si nechte na večer.',
      links: [{ label: 'Celý archiv', url: '/clanky' }, { label: 'Rubriky', url: '/#rubriky' }, { label: 'Seriály', url: '/#serial' }],
    },
    series: { eyebrow: 'Seriál', partsLabel: 'Všechny díly' },
    sections: { heading: 'Pět rubrik', text: 'Každý článek patří do jedné z nich. Za sedm let jich vyšlo 362 a žádný jsme nesmazali.' },
    newsletter: {
      mostReadHeading: 'Nejčtenější v listopadu', eyebrow: 'Newsletter', schedule: 'každou neděli v 7.00', minutes: 20,
      heading: 'Nedělní Souvrať',
      text: 'Jeden e-mail týdně: dlouhý text, tři krátké a tip, kam vyrazit, než se setmí. Bez reklam. Čte ho 3 180 lidí.',
    },
    authors: { heading: 'Kdo Souvrať píše', text: 'Tři lidé, kteří na Vysočině žijí a nikam se nechystají. Fotografie si děláme sami, cestou.' },
    about: {
      heading: 'O Souvrati',
      text: 'Souvrať je pruh na konci pole, kde se obrací pluh. Oráč se tam na chvíli zastaví a rozhlédne. O totéž se od roku 2019 snažíme každý týden: *zastavit se a napsat pořádně o místě, kde žijeme.*',
      supportHeading: 'Podpořte nás',
      supportText: 'Souvrať nemá placenou zeď ani bannery. Platí ji 412 čtenářů, kteří posílají od 80 Kč měsíčně.',
      supportLabel: 'Podpořit Souvrať',
      adHeading: 'Inzerce a spolupráce',
      adText: 'Každý týden dáváme jedno místo podniku nebo akci z okolí. Ceník a volné termíny pošle Markéta Vondrová.',
      writeHeading: 'Napište redakci',
      writeText: 'Tip na článek, oprava, pozvání na výlov.',
    },
  },
  archive: { title: 'Všechny články', heading: 'Všechny články', text: 'Všechno, co jsme od začátku napsali, od nejnovějšího.' },
  search: { title: 'Hledání', heading: 'Hledání', text: 'Napište slovo nebo dvě a najdeme články, které je obsahují.' },
  privacy: {
    title: 'Ochrana osobních údajů', heading: 'Zásady ochrany osobních údajů',
    paragraphs: [
      'Tento text je ukázkový. Nahraďte ho zásadami svého magazínu.',
      'Vydavatel zpracovává e-mailovou adresu, kterou čtenář zadá do přihlášky k odběru newsletteru, aby mu mohl posílat nedělní číslo. Adresu nikomu nepředává a smaže ji, jakmile se čtenář odhlásí.',
      'Odhlásit se lze jedním kliknutím v každém e-mailu nebo zprávou redakci. Magazín nesleduje čtenáře reklamními cookies.',
    ],
  },
  photos: {
    pastevec: 'Pastevec s holí stojí zády na stráni nad stádem ovcí, v údolí pod ním leží ranní mlha',
    prehrada: 'Dlouhá přehradní nádrž v hlubokém zalesněném údolí pod zataženou oblohou',
    polevka: 'Smaltovaný hrnec bramboračky na litinových kamnech, na zdi visí šňůra sušených hub',
    sindel: 'Naštípané smrkové šindele, pořízek a dřevěná palice na strouhací stolici plné hoblin',
    zidka: 'Nízká kamenná zídka z žulových balvanů na kraji ojíněné louky, za ní řada jeřábů',
    studanka: 'Lesní studánka s kamennou nádržkou pod malou šindelovou stříškou',
    vcelar: 'Včelařka v klobouku se závojem stojí u řady barevných úlů na kraji starého sadu',
    krizaly: 'Kolečka jablek navlečená na šňůrách se suší nad zelenými kachlovými kamny',
    samota: 'Osamělá bílá chalupa se šindelovou střechou na poprašku sněhu za modrého soumraku, v jednom okně se svítí',
    autorMarketa: 'Markéta Vondrová',
    autorTomas: 'Tomáš Havlena',
    autorBara: 'Bára Kosinová',
  },
}

// What Čtvrthodinka's design words differently from the texts above: a site made in that look
// gets these (the seed is told the look).
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  ctvrthodinka: {
    settings: { ctaLabel: 'Odebírat' },
    home: {
      front: { briefHeading: '', question: 'Kolik máte času?', leadLabel: 'Hlavní článek týdne' },
      picks: { heading: 'Na čtvrthodinku', note: 'Tři texty, každý na jednu kávu.' },
      list: { heading: 'Od dvou minut do dvanácti', links: [{ label: 'Starší články v archivu', url: '/clanky' }] },
      series: { eyebrow: 'Na celý večer' },
      sections: { heading: 'Pět rubrik, 362 článků', text: 'Za sedm let jsme nesmazali ani jeden.' },
      authors: { heading: 'Píšou tři', text: 'Žijí tu a nikam se nechystají. Fotí si sami, cestou.' },
    },
  },
}
