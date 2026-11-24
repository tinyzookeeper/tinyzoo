// Every Czech text of the Sports club template, in one place: the website's own words (what is
// not content: "doma", "Trénink", the anchors of the sections) and the demo content the seed
// puts in (with what a look's design words differently: `demoByLook`). Another language is a
// file beside this one with the same exports.
// (The words every template shares are the kit's: templates/kit/app/utils/kitWords.ts. The
// admin's labels are in cms.config.ts, in both of the admin's languages.)
import { KIT_WORDS, type KitWords } from '../../kit/app/utils/kitWords'
import type { DemoOverride } from '../../kit/seed'

type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type Role = 'goalkeeper' | 'defender' | 'midfielder' | 'forward'
type Outcome = 'V' | 'R' | 'P'

export interface Words extends KitWords {
  /** The crest's link, for screen readers: "Tatran Hořany, úvodní stránka". */
  homeOf: (name: string) => string
  /** The line under the club's name in Zpravodaj: "Fotbal · založeno 1931". */
  sinceBulletin: (sport: string, year: number | null) => string
  /** The line under the club's name in Hřiště: "fotbal od roku 1931". */
  sinceInline: (sport: string, year: number | null) => string
  /** "ve 14:30", "v 15:00" */
  at: (time: string) => string
  /** Zpravodaj's top line: "Příští zápas:" */
  nextMatchColon: string
  /** "Dopoledne v 10:15 hraje dorost s Kamencem." */
  preMatchLine: (time: string, what: string) => string
  /** "11. kolo" */
  round: (n: number) => string
  /** "místo", after the numeral of the place. */
  placeWord: string
  /** "2. místo" */
  place: (n: number) => string
  /** "po 10 kolech" */
  afterRounds: (n: number) => string
  /** "po 10. kole" */
  afterRound: (n: number) => string
  /** "23 bodů" */
  points: (n: number) => string
  /** "23 bodů z 10 zápasů" */
  pointsOf: (points: number, played: number) => string
  scoreWord: string
  home: string
  away: string
  /** "Příští zápas" (a small heading) */
  nextMatch: string
  when: string
  where: string
  admission: string
  preMatch: string
  kickoff: string
  /** The words of Hřiště's header: "po" – "pá" and the like. */
  outcome: Record<Outcome, string>
  /** The match's two teams, joined for a screen reader: "Tatran Hořany proti Sokol Bezděkov". */
  against: string
  teamTabs: string
  noMatches: string
  /** The table's headings. */
  place_: string
  club: string
  squad: string
  abbr: { played: string; wins: string; draws: string; losses: string }
  scoreHead: string
  pointsHead: string
  pointsShort: string
  tableOf: (competition: string, after: string) => string
  /** "místo po 10 kolech" (Dres, beside the large place) */
  placeAfterRounds: (n: number) => string
  lastFive: string
  training: string
  trainingJoin: string
  /** "Tým, soutěž a trenér" (the head of Hřiště's timetable) */
  timetableHead: string
  timetableCaption: string
  day: Record<Day, { short: string; long: string; full: string }>
  /** "trenér Radek Vondráček" */
  coachOf: (role: string | null, name: string) => string
  roleGroups: Record<Role, string>
  roleOne: Record<Role, string>
  staffHead: string
  /** The news sections: short (Zpravodaj, Dres) and as Hřiště words them. */
  category: Record<'report' | 'youth' | 'club', string>
  categoryLong: Record<'report' | 'youth' | 'club', string>
  readReport: string
  readArticle: string
  allArticles: string
  noArticles: string
  yearsOf: (years: string) => string
  level: Record<'main' | 'partner' | 'supporter', string>
  levelOne: Record<'main' | 'partner' | 'supporter', string>
  address: string
  openMap: string
  club_: string
  contact: string
  onSite: string
  facebook: string
  companyId: string
  copyright: (year: number, name: string) => string
  photoOf: (name: string) => string
  /** What a field of the application shows before anything is typed. */
  placeholders: { child: string; birthYear: string }
  /** The addresses of the sections on a page (`/#zapasy`), by block type. */
  anchors: Record<'fixtures' | 'table' | 'teams' | 'roster' | 'news' | 'join' | 'sponsors' | 'about', string>
}

// "ve 14:30", "v 15:00": Czech says "ve" before two, three, four, twelve to fourteen and twenty onwards.
const at = (time: string): string => {
  const hour = Number.parseInt(time, 10)
  return `${[2, 3, 4, 12, 13, 14, 20, 21, 22, 23].includes(hour) ? 've' : 'v'} ${time}`
}
// One, a few, many: "1 bod", "3 body", "23 bodů".
const many = (n: number, one: string, few: string, lots: string): string => (n === 1 ? one : n >= 2 && n <= 4 ? few : lots)

export const words: Words = {
  ...KIT_WORDS.cs,
  homeOf: (name) => `${name}, úvodní stránka`,
  sinceBulletin: (sport, year) => [sport ? sport[0]!.toUpperCase() + sport.slice(1) : '', year ? `založeno ${year}` : ''].filter(Boolean).join(' · '),
  sinceInline: (sport, year) => [sport, year ? `od roku ${year}` : ''].filter(Boolean).join(' '),
  at,
  nextMatchColon: 'Příští zápas:',
  preMatchLine: (time, what) => `${Number.parseInt(time, 10) < 12 ? 'Dopoledne' : 'Odpoledne'} ${at(time)}${what ? ` hraje ${what}` : ''}.`,
  round: (n) => `${n}. kolo`,
  placeWord: 'místo',
  place: (n) => `${n}. místo`,
  afterRounds: (n) => `po ${n} ${n === 1 ? 'kole' : 'kolech'}`,
  afterRound: (n) => `po ${n}. kole`,
  points: (n) => `${n} ${many(n, 'bod', 'body', 'bodů')}`,
  pointsOf: (points, played) => `${points} ${many(points, 'bod', 'body', 'bodů')} z ${played} ${many(played, 'zápasu', 'zápasů', 'zápasů')}`,
  scoreWord: 'skóre',
  home: 'doma', away: 'venku',
  nextMatch: 'Příští zápas', when: 'Kdy', where: 'Kde', admission: 'Vstupné', preMatch: 'Předzápas', kickoff: 'Výkop',
  outcome: { V: 'výhra', R: 'remíza', P: 'prohra' },
  against: 'proti',
  teamTabs: 'Tým',
  noMatches: 'Tento tým zatím nemá v rozpisu žádné zápasy.',
  place_: 'Pořadí', club: 'Klub', squad: 'Mužstvo',
  abbr: { played: 'Zápasy', wins: 'Výhry', draws: 'Remízy', losses: 'Prohry' },
  scoreHead: 'Skóre', pointsHead: 'Body', pointsShort: 'B',
  tableOf: (competition, after) => `Tabulka ${competition}, ${after}`,
  placeAfterRounds: (n) => `místo po ${n} ${n === 1 ? 'kole' : 'kolech'}`,
  lastFive: 'Posledních pět',
  training: 'Trénink',
  trainingJoin: ' a ',
  timetableHead: 'Tým, soutěž a trenér',
  timetableCaption: 'Rozvrh tréninků podle týmů a dnů',
  day: {
    mon: { short: 'po', long: 'pondělí', full: 'Pondělí' }, tue: { short: 'út', long: 'úterý', full: 'Úterý' },
    wed: { short: 'st', long: 'středa', full: 'Středa' }, thu: { short: 'čt', long: 'čtvrtek', full: 'Čtvrtek' },
    fri: { short: 'pá', long: 'pátek', full: 'Pátek' }, sat: { short: 'so', long: 'sobota', full: 'Sobota' }, sun: { short: 'ne', long: 'neděle', full: 'Neděle' },
  },
  coachOf: (role, name) => [role, name].filter(Boolean).join(' '),
  roleGroups: { goalkeeper: 'Brankáři', defender: 'Obránci', midfielder: 'Záložníci', forward: 'Útočníci' },
  roleOne: { goalkeeper: 'brankář', defender: 'obránce', midfielder: 'záložník', forward: 'útočník' },
  staffHead: 'Realizační tým',
  category: { report: 'Report', youth: 'Mládež', club: 'Klub' },
  categoryLong: { report: 'Report ze zápasu', youth: 'Mládež', club: 'Ze života klubu' },
  readReport: 'Číst report',
  readArticle: 'Číst článek',
  allArticles: 'Všechny články',
  noArticles: 'Zatím tu nejsou žádné články.',
  yearsOf: (years) => `ročníky ${years}`,
  level: { main: 'Hlavní partneři', partner: 'Partneři', supporter: 'Podporují nás' },
  levelOne: { main: 'Hlavní partner', partner: 'Partner', supporter: 'Podporují nás' },
  address: 'Adresa',
  openMap: 'Otevřít v mapě',
  club_: 'Klub',
  contact: 'Kontakt',
  onSite: 'Na webu',
  facebook: 'Facebook',
  companyId: 'IČO',
  copyright: (year, name) => `© ${year} ${name}`,
  photoOf: (name) => `${name}, fotografie`,
  placeholders: { child: 'Matěj Novák', birthYear: '2017' },
  anchors: { fixtures: 'zapasy', table: 'tabulka', teams: 'tymy', roster: 'soupiska', news: 'aktuality', join: 'nabor', sponsors: 'partneri', about: 'klub' },
  defaultName: 'Náš klub',
}

// ── the demo content: the fictional club TJ Tatran Hořany (football, founded 1931), a small
//    Czech town, the week before a home match with the league leader. The town, the clubs it
//    plays, the people, the phone numbers and the addresses are invented; the photographs are
//    an autumn afternoon at its ground. The matches are dated relative to the day the seed runs
//    (`offset` is days from the next home match, which falls on a Saturday a few days ahead), so
//    the demo always has both played and coming matches. ──
const squad = (name: string, badge: string, category: string, competition: string, coachRole: string, coach: string, matchName: string, inMatches: boolean, trainings: Array<{ day: Day; time: string }>) =>
  ({ name, badge, category, competition, coachRole, coach, matchName, inMatches, trainings })
const match = (squad: 'a' | 'b' | 'd' | 'z' | 'p' | 'g', offset: number, time: string, home: boolean, opponent: string, round: number, score: string | null, scorers = '') =>
  ({ squad, offset, time, home, opponent, round, score, scorers })

export const demo = {
  settings: {
    siteName: 'Tatran Hořany',
    fullName: 'TJ Tatran Hořany, z. s.',
    sport: 'fotbal',
    founded: 1931,
    footerText: 'Fotbalový klub s jedním týmem dospělých v I. B třídě a pěti dalšími týmy.',
    motto: 'Sportu zdar a fotbalu zvlášť.',
    companyId: '12345678',
    groundName: 'Stadion Na Sádkách',
    address: 'Cihelní 412, 285 41 Hořany',
    mapUrl: 'https://mapy.example/stadion-na-sadkach',
    admission: '40 Kč, děti a důchodci zdarma',
    email: 'info@tatran.example',
    phone: '123 456 701',
    phoneNote: 'sekretář',
    facebook: 'https://facebook.example/tatranhorany',
    ctaLabel: 'Nábor dětí',
    metaDescription: 'Fotbalový klub TJ Tatran Hořany. Rozpis zápasů, výsledky, tabulka I. B třídy, soupisky a nábor dětí.',
  },
  menu: { fixtures: 'Zápasy', table: 'Tabulka', teams: 'Týmy', news: 'Aktuality', about: 'O klubu', privacy: 'Ochrana osobních údajů' },
  pages: {
    home: { title: 'Úvod' },
    news: { title: 'Aktuality', heading: 'Aktuality' },
    fixtures: { title: 'Zápasy', heading: 'Celý rozpis podzimu 2026' },
    privacy: {
      title: 'Ochrana osobních údajů',
      heading: 'Ochrana osobních údajů',
      paragraphs: [
        'Tato stránka je ukázka. Než web zveřejníte, nahraďte ji vlastním textem o tom, jaké osobní údaje klub zpracovává a proč.',
        'Přihláška na zkušební trénink obsahuje jméno a rok narození dítěte, jméno rodiče a kontakt. Používáme je jen k tomu, abychom se ozvali ohledně prvního tréninku, a po vyřízení přihlášky je smažeme.',
        'Správcem údajů je TJ Tatran Hořany, z. s., IČO 12345678. Na adrese info@tatran.example se můžete zeptat, jaké údaje o vás máme, nebo požádat o jejich výmaz.',
      ],
    },
  },
  nextMatch: {
    heading: '',
    lead: 'Druhý s prvním. Bezděkov vede tabulku o dva body, v sobotu ho můžeme doma přeskočit. Přijďte nás podpořit.',
    preMatch: '10:15, dorost s Kamencem',
    caption: 'Z domácího zápasu s Jiskrou Mokrá, 10. října. Vyhráli jsme 2:0.',
    primaryLabel: 'Rozpis zápasů',
    secondaryLabel: 'Jak se k nám dostanete',
  },
  lastResult: {
    resultLabel: 'Poslední výsledek',
    scorersLabel: 'Branky',
    reportLabel: 'Číst report',
    formLabel: 'Posledních pět zápasů',
    formNote: 'Od porážky v Kamenci jsme čtyřikrát v řadě neprohráli, skóre 10:3.',
    standingLabel: 'Postavení v tabulce',
    standingNote: 'Dva body za Bezděkovem.',
    standingLinkLabel: 'Celá tabulka',
  },
  fixtures: {
    heading: 'Zápasy a výsledky',
    comingLabel: 'Nadcházející',
    playedLabel: 'Odehrané',
    note: '',
    note2: '',
    moreLabel: 'Celý rozpis podzimu 2026',
    season: 'podzim 2026',
  },
  table: {
    heading: 'Tabulka',
    competition: 'I. B třída, skupina C',
    note: 'První postupuje do I. A třídy, poslední dva sestupují.',
    asideHeading: '',
    asideText: '',
    asideLinkLabel: '',
  },
  teams: {
    heading: 'Týmy',
    text: 'Za Tatran hraje 142 členů v šesti týmech, od přípravky po starou gardu. Trénujeme na hřišti Na Sádkách, v zimě v hale základní školy.',
    imageCaption: 'Tréninky jsou otevřené, přijďte se podívat.',
  },
  roster: {
    heading: 'Soupiska A-týmu',
    season: 'Podzim 2026',
    staff: [{ name: 'Radek Vondráček', role: 'trenér' }, { name: 'Karel Zeman', role: 'asistent' }],
  },
  news: { heading: 'Aktuality', linkLabel: 'Všechny články' },
  join: {
    eyebrow: 'Nábor dětí',
    heading: 'Hledáme kluky a holky ročníků 2012 až 2020',
    text: 'Přijďte se podívat na trénink, stačí sportovní oblečení a pití. První měsíc je zdarma, potom 1 200 Kč za půl roku. Dres a míč děti dostanou od klubu.',
    listLabel: 'Kdo nabírá a kdy trénuje',
    formHeading: 'Přihláška na zkušební trénink',
    buttonLabel: 'Odeslat přihlášku',
    contactText: 'Ozve se vám Lenka Marková,',
    contactPhone: '123 456 703',
  },
  sponsors: {
    heading: 'Partneři klubu',
    text: 'Dopravu na zápasy, dresy pro děti i údržbu trávníku platíme díky městu a místním firmám. Děkujeme.',
    note: 'Chcete se přidat? Napište předsedovi klubu na',
    noteEmail: 'predseda@tatran.example',
  },
  about: {
    heading: 'O klubu',
    text: 'Tatran založili v roce 1931 dělníci z hořanské cihelny. Od té doby se tu hraje bez přestávky, nejvýš jsme byli v krajském přeboru v sezoně 1987/88. Klub vedou dobrovolníci: trenéři, pořadatelé i správce hřiště to dělají po práci.',
    imageCaption: 'Hřiště Na Sádkách. Umělé osvětlení svítí od roku 2019.',
    facts: [{ value: '1931', label: 'Založeno' }, { value: '142', label: 'Členů' }, { value: '78', label: 'Z toho dětí' }],
    groundHeading: 'Stadion Na Sádkách',
    groundText: 'Travnaté hřiště 105 × 68 m, krytá tribuna pro 180 diváků, parkování u sokolovny.',
    groundFacts: [
      { label: 'Hrací plocha', value: 'tráva 105 × 68 m' }, { label: 'Tribuna', value: 'krytá, 180 míst' }, { label: 'Vstupné', value: '40 Kč, děti a důchodci zdarma' },
      { label: 'Bufet', value: 'klobása, pivo, limo' }, { label: 'Parkování', value: 'u sokolovny' },
    ],
    matchDayHeading: 'V den zápasu',
    matchDayTitle: '',
    matchDayText: 'Pokladna otevírá hodinu před výkopem. Vstupné 40 Kč, děti do 15 let a důchodci zdarma.\n\nV bufetu klobása z udírny, pivo a limonáda.',
    committeeHeading: 'Výbor a kontakty',
  },
  // The teams, by key (a list of them would be replaced whole by a look's own wording).
  squads: {
    a: squad('A-tým', 'A', '', 'I. B třída, skupina C', 'trenér', 'Radek Vondráček', '', true, [{ day: 'tue', time: '18:00' }, { day: 'thu', time: '18:00' }]),
    b: squad('B-tým', 'B', '', 'III. třída, skupina A', 'trenér', 'Miloš Kadlec', 'Tatran Hořany B', true, [{ day: 'wed', time: '18:00' }, { day: 'fri', time: '17:30' }]),
    d: squad('Dorost', 'U19', 'U19', 'Okresní přebor dorostu', 'trenér', 'Petr Šafránek', '', true, [{ day: 'mon', time: '17:00' }, { day: 'wed', time: '17:00' }]),
    z: squad('Žáci', 'U15', 'U15', 'Okresní přebor starších žáků', 'trenér', 'Tomáš Brabec', '', true, [{ day: 'tue', time: '16:30' }, { day: 'thu', time: '16:30' }]),
    p: squad('Přípravka', 'U11', 'U7–U11', 'Okresní turnaje přípravek', 'trenérka', 'Lenka Marková', '', false, [{ day: 'mon', time: '16:00' }, { day: 'wed', time: '16:00' }]),
    g: squad('Stará garda', '35+', '', 'Přátelské zápasy a turnaje', 'vedoucí', 'Zdeněk Holub', '', false, [{ day: 'fri', time: '19:00' }]),
  },
  // Every match: days from the next home match of the A-team (a Saturday), kick-off, home or away, opponent, round, score (home:away) when played.
  matches: [
    match('a', 0, '14:30', true, 'Sokol Bezděkov', 11, null),
    match('a', 7, '14:00', false, 'SK Podlesí', 12, null),
    match('a', 14, '14:00', true, 'FK Dobrá Voda', 13, null),
    match('a', 22, '13:30', false, 'Čechie Lhotka', 14, null),
    match('a', -6, '15:00', false, 'Slavoj Borová', 10, '1:3', 'Zeman 2, Šimek'),
    match('a', -14, '15:30', true, 'Jiskra Mokrá', 9, '2:0'),
    match('a', -21, '15:30', false, 'Viktoria Záhoří', 8, '1:1'),
    match('a', -28, '16:00', true, 'Baník Březina', 7, '4:1'),
    match('a', -34, '16:00', false, 'Spartak Kamenec', 6, '2:1'),
    match('a', -42, '16:30', true, 'Sokol Újezdec', 5, '3:0'),
    match('b', 1, '14:30', false, 'Sokol Vrbová', 10, null),
    match('b', 8, '14:00', true, 'FK Stříbrná Lhota', 11, null),
    match('b', 15, '14:00', false, 'Sokol Dubečno', 12, null),
    match('b', -7, '15:00', true, 'SK Lipany B', 9, '2:2'),
    match('b', -13, '15:30', false, 'Sokol Chvalov', 8, '3:1'),
    match('b', -20, '15:30', true, 'Slavoj Borová B', 7, '5:2'),
    match('b', -27, '16:00', false, 'FK Kozlany', 6, '0:1'),
    match('d', 0, '10:15', true, 'Spartak Kamenec', 9, null),
    match('d', 8, '10:15', false, 'Sokol Bezděkov', 10, null),
    match('d', 14, '10:15', true, 'SK Podlesí', 11, null),
    match('d', -6, '10:15', false, 'FK Dobrá Voda', 8, '2:4'),
    match('d', -14, '10:15', true, 'Jiskra Mokrá', 7, '1:1'),
    match('d', -21, '10:15', false, 'Sokol Újezdec', 6, '0:3'),
    match('d', -28, '10:15', true, 'Čechie Lhotka', 5, '2:3'),
    match('z', 1, '10:00', true, 'Slavoj Borová', 9, null),
    match('z', 7, '10:00', false, 'Baník Březina', 10, null),
    match('z', 15, '10:00', true, 'Sokol Bezděkov', 11, null),
    match('z', -7, '10:00', true, 'FK Dobrá Voda', 8, '4:2'),
    match('z', -14, '10:00', false, 'Spartak Kamenec', 7, '1:6'),
    match('z', -20, '10:00', true, 'SK Podlesí', 6, '3:0'),
    match('z', -27, '10:00', false, 'Viktoria Záhoří', 5, '2:2'),
  ],
  // The league table of the A-team's competition after ten rounds: club, played, wins, draws, losses, score, points.
  standings: [
    ['Sokol Bezděkov', 10, 8, 1, 1, '27:9', 25], ['Tatran Hořany', 10, 7, 2, 1, '24:10', 23], ['Spartak Kamenec', 10, 6, 2, 2, '21:12', 20],
    ['FK Dobrá Voda', 10, 5, 3, 2, '18:13', 18], ['Slavoj Borová', 10, 4, 2, 4, '15:16', 14], ['Čechie Lhotka', 10, 4, 1, 5, '19:19', 13],
    ['Jiskra Mokrá', 10, 4, 1, 5, '14:17', 13], ['Sokol Újezdec', 10, 3, 3, 4, '13:15', 12], ['Viktoria Záhoří', 10, 3, 1, 6, '12:20', 10],
    ['SK Podlesí', 10, 2, 3, 5, '11:19', 9], ['Baník Březina', 10, 2, 1, 7, '10:22', 7], ['Sokol Hlubočany', 10, 1, 2, 7, '8:20', 5],
  ] as Array<[string, number, number, number, number, string, number]>,
  // The A-team's squad: number, name, position, note, and the photograph (a key of seed/photos.ts) when there is one.
  players: [
    [1, 'Jakub Hruška', 'goalkeeper', '', 'playerKeeper'], [22, 'Ondřej Mach', 'goalkeeper', '', null],
    [2, 'Martin Beneš', 'defender', '', null], [3, 'Lukáš Dvořák', 'defender', '', null], [4, 'Tomáš Kříž', 'defender', 'kapitán', 'playerCaptain'],
    [5, 'David Pokorný', 'defender', '', null], [15, 'Jiří Vlček', 'defender', '', null],
    [6, 'Petr Novotný', 'midfielder', '', null], [8, 'Michal Urban', 'midfielder', '', null], [10, 'Filip Šimek', 'midfielder', '', 'playerYoung'],
    [14, 'Adam Kolář', 'midfielder', '', null], [16, 'Vojtěch Bureš', 'midfielder', '', null], [18, 'Daniel Říha', 'midfielder', '', null],
    [7, 'Jan Kučera', 'forward', '', null], [9, 'Marek Zeman', 'forward', '9 gólů', 'playerStriker'], [11, 'Šimon Holub', 'forward', '', null], [17, 'Matěj Fiala', 'forward', '', null],
  ] as Array<[number, string, Role, string, string | null]>,
  ageGroups: [
    { name: 'Mladší přípravka', years: '2018–2020', when: 'po a st 16:00' },
    { name: 'Starší přípravka', years: '2016–2017', when: 'po a st 16:00' },
    { name: 'Mladší žáci', years: '2014–2015', when: 'út a čt 16:30' },
    { name: 'Starší žáci', years: '2012–2013', when: 'út a čt 16:30' },
  ],
  partners: [
    { name: 'Město Hořany', level: 'main' }, { name: 'Stavebniny Kříž', level: 'main' },
    { name: 'Pekárna Vondra', level: 'partner' }, { name: 'Autoservis Mach a syn', level: 'partner' }, { name: 'ZD Podlesí', level: 'partner' }, { name: 'Elektro Bureš', level: 'partner' },
    { name: 'Řeznictví Holub', level: 'supporter' }, { name: 'Truhlářství Fiala', level: 'supporter' }, { name: 'Hospoda Na Sádkách', level: 'supporter' }, { name: 'Lékárna U Kostela', level: 'supporter' },
    { name: 'Květiny Jarmila', level: 'supporter' }, { name: 'Pila Borová', level: 'supporter' }, { name: 'Zahradnictví Urban', level: 'supporter' },
  ] as Array<{ name: string; level: 'main' | 'partner' | 'supporter' }>,
  committee: [
    { role: 'Předseda', name: 'Ing. Josef Marek', contact: '123 456 702' },
    { role: 'Sekretář', name: 'Pavel Hruška', contact: '123 456 701' },
    { role: 'Mládež', name: 'Lenka Marková', contact: '123 456 703' },
    { role: 'Pokladní', name: 'Jana Křížová', contact: 'pokladna@tatran.example' },
  ],
  // The articles, by key; `offset` is days from the next home match (negative: before it).
  articles: {
    borova: {
      slug: 'z-borove-vezeme-tri-body', category: 'report' as const, offset: -6, photo: 'celebration',
      title: 'Z Borové vezeme tři body, Zeman dal dva góly',
      summary: 'Na těžkém terénu jsme šli do vedení po půl hodině, domácí po změně stran vyrovnali z penalty. Rozhodla 67. minuta a hlavička Marka Zemana po rohu, pojistku přidal střídající Filip Šimek.',
      body: [
        'Na těžkém terénu v Borové jsme šli do vedení po půl hodině hry, kdy Marek Zeman využil přihrávku Tomáše Kříže a z vápna přesně zamířil k tyči. Domácí po změně stran vyrovnali z penalty, kterou rozhodčí nařídil po souboji v šestnáctce.',
        'Rozhodla 67. minuta a Zemanova hlavička po rohu. Pojistku přidal sedm minut před koncem střídající Filip Šimek, který se prosadil ve své první minutě na hřišti.',
        'Do tabulky jsme se tak dostali na druhé místo, dva body za Bezděkovem. S ním se v sobotu potkáme doma. Začátek je ve 14:30, v 10:15 hraje dorost s Kamencem.',
      ],
    },
    zaci: {
      slug: 'zaci-porazili-dobrou-vodu', category: 'youth' as const, offset: -7, photo: 'youthMatch',
      title: 'Žáci porazili Dobrou Vodu 4:2 a vedou okresní přebor',
      summary: 'Čtvrtá výhra v řadě, dva góly dal Vojta Marek. V neděli v deset doma s Borovou.',
      body: [
        'Starší žáci vyhráli nad Dobrou Vodou 4:2 a se čtyřmi výhrami v řadě vedou okresní přebor. Dva góly dal Vojta Marek, po jednom přidali Kuba Holub a Štěpán Urban.',
        'Hosté se dvakrát dostali na dosah, ale v obou případech jsme odpověděli do pěti minut. Trenér Tomáš Brabec chválil hlavně druhý poločas, ve kterém kluci drželi míč a nenechali soupeře nadechnout.',
        'V neděli v deset hodin hrají žáci doma s Borovou. Přijďte je podpořit, vstup je zdarma.',
      ],
    },
    brigada: {
      slug: 'diky-za-brigadu', category: 'club' as const, offset: -12, photo: 'lineMarking',
      title: 'Děkujeme za brigádu: střídačky mají novou střechu',
      summary: 'Přišlo vás dvacet tři. Hotová je střecha na obou střídačkách i nátěr zábradlí.',
      body: [
        'Na sobotní brigádu přišlo dvacet tři dobrovolníků, od žáků po členy staré gardy. Za jedno dopoledne je hotová střecha na obou střídačkách a natřené zábradlí kolem celého hřiště.',
        'Guláš pro všechny uvařil pan Holub, pivo z hospody Na Sádkách věnoval majitel. Děkujeme všem, kdo přišli, i těm, kdo poslali aspoň zprávu.',
        'Další brigáda bude na jaře, před začátkem jarní části. Termín oznámíme v aktualitách.',
      ],
    },
    priprava: {
      slug: 'zimni-priprava-zacne-12-ledna', category: 'club' as const, offset: -22, photo: 'ball',
      title: 'Zimní příprava začne 12. ledna, hala je zamluvená',
      summary: 'Úterky a čtvrtky v hale základní školy, soboty na umělé trávě v Kamenci.',
      body: [
        'Zimní příprava A-týmu začne 12. ledna. Úterky a čtvrtky od šesti trénujeme v hale základní školy, soboty na umělé trávě v Kamenci.',
        'Přípravka a žáci trénují v hale už od prosince. Rozpis tréninků najdete u každého týmu a změny budeme psát sem.',
        'Hala je zamluvená do konce března. Kdo se chce k tréninkům přidat, ať se ozve trenérovi svého týmu.',
      ],
    },
  },
  // What is in each photograph, for people who cannot see it.
  photos: {
    heroMatch: 'Zápas na hřišti Na Sádkách, diváci u zábradlí sledují hru',
    ground: 'Hřiště Na Sádkách za soumraku s rozsvíceným osvětlením',
    youthTraining: 'Trenér s dětmi na tréninku přípravky',
    youthMatch: 'Zápas starších žáků',
    celebration: 'Hráči Tatranu se radují z gólu',
    lineMarking: 'Správce hřiště lajnuje postranní čáru',
    ball: 'Míč a kopačky u postranní čáry',
    net: 'Síť branky na hřišti Na Sádkách',
    playerCaptain: 'Tomáš Kříž, obránce a kapitán',
    playerKeeper: 'Jakub Hruška, brankář',
    playerStriker: 'Marek Zeman, útočník',
    playerYoung: 'Filip Šimek, záložník',
  },
}

// What a look's design words differently: a site made in that look gets these (the seed is told
// the look). Zpravodaj's wording is the shared one above; the lists that differ are keyed
// objects (`squads`, `articles`) so a look changes only the entries it words differently.
export const demoByLook: Partial<Record<string, DemoOverride<typeof demo>>> = {
  dres: {
    settings: { ctaLabel: 'Nábor' },
    menu: { about: 'Klub', privacy: 'Ochrana údajů' },
    nextMatch: {
      lead: 'Druhý s prvním. Kdo vyhraje, přezimuje v čele. V sobotu všichni na Sádky.',
      primaryLabel: 'Celý rozpis',
      secondaryLabel: '',
    },
    lastResult: { resultLabel: 'Minule', reportLabel: 'Jak to bylo' },
    fixtures: { heading: 'Zápasy', moreLabel: 'Celý podzim 2026' },
    table: { asideText: 'Dva body za Bezděkovem, tři před Kamencem. Sedm výher, dvě remízy, jediná porážka.' },
    teams: { text: 'Šest týmů, 142 členů. Od šestiletých v přípravce po starou gardu.' },
    news: { heading: 'Aktuality', linkLabel: 'Všechny články' },
    join: {
      eyebrow: 'Nábor · ročníky 2012 až 2020',
      heading: 'Pojď hrát za Tatran',
      text: 'Kluci i holky. Stačí tepláky, tenisky a pití, první měsíc je zdarma. Potom 1 200 Kč za půl roku, dres a míč dostane každý od klubu.',
      buttonLabel: 'Odeslat',
      contactText: 'Ozve se vám vedoucí mládeže Lenka Marková. Radši voláte?',
    },
    sponsors: { heading: 'Stojí za námi', text: 'Dresy pro děti, autobus na zápasy, trávník. Bez nich by to nešlo.' },
    about: {
      heading: 'Od roku 1931',
      text: 'Tatran založili v roce 1931 dělníci z hořanské cihelny. Hraje se tu bez přestávky, nejvýš jsme byli v krajském přeboru v sezoně 1987/88. Klub vedou dobrovolníci: trenéři, pořadatelé i správce hřiště to dělají po práci.',
      facts: [{ value: '142', label: 'Členů' }, { value: '78', label: 'Dětí' }, { value: '6', label: 'Týmů' }],
      groundText: 'Tráva 105 × 68 m, krytá tribuna pro 180 diváků, osvětlení od roku 2019. Parkování u sokolovny.',
      matchDayTitle: 'Vstupné 40 Kč',
      matchDayText: 'Děti do 15 let a důchodci zdarma. Pokladna otevírá hodinu před výkopem. V bufetu klobása z udírny, pivo a limonáda.',
      committeeHeading: 'Výbor',
    },
    articles: {
      borova: {
        title: 'Z Borové vezeme tři body. Zeman dal dva góly',
        summary: 'Vedení po půl hodině, vyrovnání z penalty a pak hlavička Marka Zemana po rohu. Pojistku přidal střídající Filip Šimek.',
      },
      brigada: { title: 'Díky za brigádu: střídačky mají novou střechu' },
    },
  },
  hriste: {
    settings: { footerText: 'Fotbalový klub pro muže, dorost, žáky i nejmenší. V Hořanech od roku 1931.', ctaLabel: 'Nábor dětí' },
    menu: { privacy: 'Ochrana údajů' },
    nextMatch: {
      heading: 'V sobotu doma *o první místo*',
      lead: 'Druhý s prvním: Bezděkov vede tabulku o dva body a v sobotu ho můžeme doma přeskočit. V bufetu budou klobásy z udírny a točené pivo.',
      caption: 'Doma s Mokrou, 10. října. Vyhráli jsme 2:0.',
      primaryLabel: 'Celý rozpis',
      secondaryLabel: 'Kudy na hřiště',
    },
    lastResult: {
      resultLabel: 'Minule', scorersLabel: 'Góly', reportLabel: 'Jak to bylo', formLabel: 'Posledních pět',
      formNote: 'Čtyři zápasy bez porážky, naposledy v Kamenci.', standingLabel: 'V tabulce', standingLinkLabel: 'Tabulka',
    },
    fixtures: {
      comingLabel: 'Co nás čeká', playedLabel: 'Odehráno',
      note: 'Na venkovní zápasy A-týmu jezdí autobus od sokolovny, odjezd hodinu a čtvrt před výkopem. Místo si zamluvte u sekretáře, fanoušci platí 50 Kč.',
      note2: 'Výkopy se mohou změnit, sledujte aktuality.',
    },
    table: {
      asideHeading: 'Druzí, dva body za Bezděkovem',
      asideText: 'Sedm výher, dvě remízy, jedna porážka. V sobotu se hraje o čelo: když doma vyhrajeme, přezimujeme první.',
      asideLinkLabel: 'Kdy hrajeme',
    },
    teams: { heading: 'Týmy a tréninky', text: 'Šest týmů, 142 členů. Trénujeme Na Sádkách, v zimě v hale základní školy.' },
    roster: { staff: [{ name: 'Radek Vondráček', role: 'trenér' }] },
    news: { heading: 'Co je nového', linkLabel: 'Starší zprávy' },
    join: {
      eyebrow: 'Nábor · ročníky 2012 až 2020',
      heading: 'Hledáme kluky a holky, co chtějí hrát',
      text: 'Přijďte se podívat na trénink. Stačí tepláky, tenisky a pití. První měsíc je zdarma, potom 1 200 Kč za půl roku. Dres a míč dostane každý od klubu.',
      contactText: 'Ozve se vám Lenka Marková, vedoucí mládeže. Nebo rovnou zavolejte:',
    },
    sponsors: { heading: 'Bez nich by to nešlo', text: 'Dresy pro děti, autobus na zápasy, sekání trávníku. Děkujeme.' },
    about: {
      heading: 'Hrajeme tu od roku 1931',
      text: 'Tatran založili v roce 1931 dělníci z hořanské cihelny. Hraje se tu bez přestávky, nejvýš jsme byli v krajském přeboru v sezoně 1987/88. Klub vedou dobrovolníci: trenéři, pořadatelé i správce hřiště to dělají po práci.',
      imageCaption: 'Hřiště Na Sádkách. Světla svítí od roku 2019.',
      facts: [{ value: '1931', label: 'rok založení' }, { value: '142', label: 'členů' }, { value: '6', label: 'týmů' }],
      groundHeading: 'Hřiště',
      committeeHeading: 'Výbor klubu',
    },
    squads: {
      d: { competition: 'okresní přebor' }, z: { competition: 'okresní přebor' },
      p: { competition: 'okresní turnaje' }, g: { competition: 'přáteláky a turnaje' },
    },
    articles: {
      zaci: {
        title: 'Žáci porazili Dobrou Vodu 4:2 a vedou okres',
        summary: 'Čtvrtá výhra v řadě. Dva góly dal Vojta Marek, po jednom Kuba Holub a Štěpán Urban. V neděli v deset hrajeme doma s Borovou.',
      },
      brigada: {
        title: 'Díky za brigádu, střídačky mají novou střechu',
        summary: 'Přišlo vás dvacet tři. Za jedno dopoledne je hotová střecha na obou střídačkách a natřené zábradlí. Guláš vařil pan Holub.',
      },
      priprava: { summary: 'Úterky a čtvrtky od šesti v hale základní školy, soboty na umělé trávě v Kamenci. Přípravka a žáci trénují v hale už od prosince.' },
    },
  },
}
