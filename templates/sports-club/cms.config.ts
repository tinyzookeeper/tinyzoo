import { customTypeBlocks, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'
import { looks } from './looks'

// The content model of the Sports club template: what a club can write and change. One model
// for all three looks (looks.ts): a look decides how a block is drawn, never what it holds.
// Change it here, then `pnpm db:generate` (review the SQL), `pnpm cms:client` and `pnpm typecheck`.

// One language. (A second one means `.localized()` on the texts below, a file beside
// texts/cs.ts and a switcher in each look's header.)
export const locales = defineLocales({ default: 'cs', locales: ['cs'] })

const EMPHASIS_HELP = {
  cs: 'Text mezi *hvězdičkami* se zvýrazní, třeba kurzivou nebo barvou klubu.',
  en: 'Text between *asterisks* stands out, for example in italics or in the club colour.',
}

// ── the whole club: who, where, how to reach it ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  description: { en: 'The club’s name, ground and contacts, the look and the colours.', cs: 'Název klubu, hřiště a kontakty, vzhled a barvy webu.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  admin: {
    // The home page beside the form: a change of look or colours shows before it is saved.
    preview: '/',
    sections: [
      { label: { en: 'Name and look', cs: 'Název a vzhled' }, fields: ['siteName', 'logo', 'look', 'colors'] },
      { label: { en: 'The club', cs: 'Klub' }, fields: ['fullName', 'sport', 'founded', 'footerText', 'motto', 'companyId'] },
      { label: { en: 'Ground and contacts', cs: 'Hřiště a kontakty' }, fields: ['groundName', 'address', 'mapUrl', 'admission', 'email', 'phone', 'phoneNote', 'facebook'] },
      { label: { en: 'Header button', cs: 'Tlačítko v záhlaví' }, fields: ['ctaLabel', 'ctaUrl'] },
    ],
  },
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Club name', cs: 'Název klubu' })
      .help({ en: 'The short name the website is headed with, for example “Tatran Hořany”.', cs: 'Krátký název, kterým se web podepisuje, například „Tatran Hořany“.' }),
    logo: f.media({ accept: 'image/*' }).optional().label({ en: 'Crest', cs: 'Znak klubu' })
      .help({ en: 'Upload your crest to show it in the header in place of the plain one the look draws.', cs: 'Nahrajte znak klubu a v záhlaví se zobrazí místo jednoduchého znaku, který nakreslí vzhled.' }),
    look: f.select(looks.fields.look).label({ en: 'Look', cs: 'Vzhled' })
      .help({ en: 'Choose how your website displays your content.', cs: 'Zvolte, jak se na webu zobrazí váš obsah.' }),
    // Only the chosen look's palettes are offered; a change of look moves the colours to its first one.
    colors: f.select(looks.fields.colors).label({ en: 'Colours', cs: 'Barvy' })
      .help({ en: 'Each look has three colour palettes: pick your club’s.', cs: 'Každý vzhled má tři barevné palety: vyberte barvy svého klubu.' }),
    fullName: f.text().optional().label({ en: 'Full name of the club', cs: 'Celý název klubu' })
      .help({ en: 'The registered name, for example “TJ Tatran Hořany, z. s.”. It stands in the footer.', cs: 'Úřední název, například „TJ Tatran Hořany, z. s.“. Je v zápatí.' }),
    sport: f.text().optional().label({ en: 'Sport', cs: 'Sport' })
      .help({ en: 'One word under the name, for example “fotbal”. Bulletin writes “Fotbal · založeno 1931”, Pitch “fotbal od roku 1931”.', cs: 'Jedno slovo pod názvem, například „fotbal“. Zpravodaj napíše „Fotbal · založeno 1931“, Hřiště „fotbal od roku 1931“.' }),
    founded: f.number({ int: true, min: 1800, max: 2100 }).optional().label({ en: 'Founded in', cs: 'Rok založení' }),
    footerText: f.text({ multiline: true }).optional().label({ en: 'Few words about the club', cs: 'Pár slov o klubu' })
      .help({ en: 'A sentence or two in the footer. Dres leaves it out.', cs: 'Věta nebo dvě v zápatí. Vzhled Dres ji vynechává.' }),
    motto: f.text().optional().label({ en: 'Motto', cs: 'Heslo' })
      .help({ en: 'A short line at the very bottom, after the copyright. Only Pitch shows it.', cs: 'Krátká věta úplně dole za copyrightem. Ukáže ji jen vzhled Hřiště.' }),
    companyId: f.text().optional().label({ en: 'Company number (IČO)', cs: 'IČO' }),
    groundName: f.text().optional().label({ en: 'Name of the ground', cs: 'Název hřiště' }).help({ en: 'For example “Stadion Na Sádkách”. It is where the club’s home matches are played.', cs: 'Například „Stadion Na Sádkách“. Tam se hrají domácí zápasy.' }),
    address: f.text().optional().label({ en: 'Address of the ground', cs: 'Adresa hřiště' }),
    mapUrl: f.text({ format: 'url' }).optional().label({ en: 'Link to a map', cs: 'Odkaz do mapy' }),
    admission: f.text().optional().label({ en: 'Admission', cs: 'Vstupné' }).help({ en: 'For example “40 Kč, děti a důchodci zdarma”. It is written in the next match’s card.', cs: 'Například „40 Kč, děti a důchodci zdarma“. Napíše se do karty příštího zápasu.' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'E-mail of the club', cs: 'E-mail klubu' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    phoneNote: f.text().optional().label({ en: 'Whose phone it is', cs: 'Čí je telefon' }).help({ en: 'For example “sekretář”. It stands after the number.', cs: 'Například „sekretář“. Napíše se za číslo.' }),
    facebook: f.text({ format: 'url' }).optional().label({ en: 'Facebook page', cs: 'Facebook' }),
    ctaLabel: f.text().optional().label({ en: 'Header button text', cs: 'Text tlačítka v záhlaví' }),
    ctaUrl: f.text({ format: 'link' }).optional().label({ en: 'Button destination', cs: 'Cíl tlačítka' }),
    ...seo(),
  },
  content: { public: true, populate: ['logo', 'ogImage'] },
})

// ── the teams of the club ──
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const Squad = defineEntity('squad', {
  label: { en: 'Teams', cs: 'Týmy' },
  labelSingular: { en: 'Team', cs: 'Tým' },
  description: { en: 'The club’s teams with their competition, coach and training times. Drag to put them in order: the first team is the one the opening of the home page follows.', cs: 'Týmy klubu se soutěží, trenérem a časy tréninků. Pořadí změníte přetažením: první tým je ten, o kterém píše úvod úvodní stránky.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  admin: { list: { columns: ['name', 'badge', 'competition', 'coach'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }).help({ en: 'For example “A-tým” or “Žáci”.', cs: 'Například „A-tým“ nebo „Žáci“.' }),
    badge: f.text({ max: 6 }).optional().label({ en: 'Short mark', cs: 'Zkratka' })
      .help({ en: 'One to four characters: “A”, “U19”, “35+”. Jersey and Pitch print it large.', cs: 'Jeden až čtyři znaky: „A“, „U19“, „35+“. Vzhledy Dres a Hřiště ji vysázejí velkou.' }),
    category: f.text().optional().label({ en: 'Age group', cs: 'Věková kategorie' })
      .help({ en: 'For example “U19” or “U7–U11”. Bulletin writes it small after the name.', cs: 'Například „U19“ nebo „U7–U11“. Zpravodaj ji napíše malým písmem za název.' }),
    competition: f.text().optional().label({ en: 'Competition', cs: 'Soutěž' }).help({ en: 'For example “I. B třída, skupina C”.', cs: 'Například „I. B třída, skupina C“.' }),
    coachRole: f.text().optional().label({ en: 'Coach’s title', cs: 'Označení trenéra' }).help({ en: 'For example “trenér”, “trenérka” or “vedoucí”.', cs: 'Například „trenér“, „trenérka“ nebo „vedoucí“.' }),
    coach: f.text().optional().label({ en: 'Coach', cs: 'Trenér' }),
    matchName: f.text().optional().label({ en: 'Name in the match list', cs: 'Název v rozpisu zápasů' })
      .help({ en: 'How the team is written in its matches, for example “Tatran Hořany B”. Empty: the club’s name.', cs: 'Jak je tým psán v zápasech, například „Tatran Hořany B“. Prázdné: název klubu.' }),
    inMatches: f.boolean().label({ en: 'Shown in the match list', cs: 'Zobrazit v rozpisu zápasů' })
      .help({ en: 'Turn on for the teams that get a tab in the fixtures and results.', cs: 'Zapněte u týmů, které mají v zápasech a výsledcích svou záložku.' }),
    trainings: f.list({
      fields: {
        day: f.select({
          options: DAYS, default: 'mon',
          labels: {
            mon: { en: 'Monday', cs: 'Pondělí' }, tue: { en: 'Tuesday', cs: 'Úterý' }, wed: { en: 'Wednesday', cs: 'Středa' }, thu: { en: 'Thursday', cs: 'Čtvrtek' },
            fri: { en: 'Friday', cs: 'Pátek' }, sat: { en: 'Saturday', cs: 'Sobota' }, sun: { en: 'Sunday', cs: 'Neděle' },
          },
        }).label({ en: 'Day', cs: 'Den' }),
        time: f.text({ required: true, max: 20 }).label({ en: 'Time', cs: 'Čas' }).help({ en: 'For example “18:00”.', cs: 'Například „18:00“.' }),
      },
      max: 10, itemLabel: { en: 'Training', cs: 'Trénink' },
    }).label({ en: 'Training times', cs: 'Tréninky' })
      .help({ en: 'Pitch draws them as a timetable by day; Bulletin and Jersey write them out, joining days that share a time (“út a čt 18:00”).', cs: 'Hřiště je nakreslí jako rozvrh po dnech; Zpravodaj a Dres je napíšou textem a dny se stejným časem spojí („út a čt 18:00“).' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the players ──
export const Player = defineEntity('player', {
  label: { en: 'Players', cs: 'Hráči' },
  labelSingular: { en: 'Player', cs: 'Hráč' },
  description: { en: 'The squad of the first team. Players with a photo are shown with it; the others look right too. Drag to put them in order.', cs: 'Soupiska prvního týmu. Hráči s fotografií se ukážou s ní, ostatní vypadají také dobře. Pořadí změníte přetažením.' },
  icon: 'i-lucide-shirt',
  titleField: 'name',
  admin: { list: { columns: ['photo', 'number', 'name', 'role', 'note'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    number: f.number({ int: true, min: 0, max: 999 }).optional().label({ en: 'Shirt number', cs: 'Číslo dresu' }),
    role: f.select({
      options: ['goalkeeper', 'defender', 'midfielder', 'forward'] as const, default: 'midfielder',
      labels: {
        goalkeeper: { en: 'Goalkeeper', cs: 'Brankář' }, defender: { en: 'Defender', cs: 'Obránce' },
        midfielder: { en: 'Midfielder', cs: 'Záložník' }, forward: { en: 'Forward', cs: 'Útočník' },
      },
    }).label({ en: 'Position', cs: 'Post' }).help({ en: 'Bulletin groups the squad by it.', cs: 'Zpravodaj podle něj soupisku seskupí.' }),
    note: f.text().optional().label({ en: 'Note', cs: 'Poznámka' }).help({ en: 'For example “kapitán” or “9 gólů”. It stands after the position.', cs: 'Například „kapitán“ nebo „9 gólů“. Napíše se za post.' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photo', cs: 'Fotografie' })
      .help({ en: 'A portrait. Bulletin and Pitch show the first four players that have one as portraits above the list, Jersey in the player’s own tile.', cs: 'Portrét. Zpravodaj a Hřiště ukážou první čtyři hráče s fotografií jako portréty nad seznamem, Dres v dlaždici hráče.' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true, populate: ['photo'] },
})

// ── the news ──
export const Article = defineEntity('article', {
  label: { en: 'News', cs: 'Aktuality' },
  labelSingular: { en: 'Article', cs: 'Článek' },
  description: { en: 'Match reports, news from the youth teams and from the club. Each article has a page of its own.', cs: 'Reporty ze zápasů, novinky z mládeže a ze života klubu. Každý článek má vlastní stránku.' },
  icon: 'i-lucide-newspaper',
  titleField: 'title',
  admin: { list: { columns: ['image', 'title', 'category', 'status', 'date'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Headline', cs: 'Titulek' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    date: f.datetime({ allDay: true }).optional().label({ en: 'Date', cs: 'Datum' }).help({ en: 'Newer articles come first.', cs: 'Nejnovější články se zobrazí jako první.' }),
    category: f.select({
      options: ['report', 'youth', 'club'] as const, default: 'club',
      labels: { report: { en: 'Match report', cs: 'Report ze zápasu' }, youth: { en: 'Youth', cs: 'Mládež' }, club: { en: 'Club', cs: 'Ze života klubu' } },
    }).label({ en: 'Section', cs: 'Rubrika' }),
    summary: f.text({ multiline: true }).optional().label({ en: 'Short text', cs: 'Perex' }).help({ en: 'Shown in lists, under the headline and when the page is shared.', cs: 'Zobrazí se v seznamech, pod titulkem a při sdílení stránky.' }),
    image: f.media({ accept: 'image/*' }).optional().label({ en: 'Photo', cs: 'Fotografie' }),
    body: f.richtext().optional().label({ en: 'Text', cs: 'Text' }),
    ...seo(),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/aktuality/:slug' },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: '/aktuality/:slug',
    populate: ['image', 'ogImage'],
  },
})

// ── the matches ──
export const Match = defineEntity('match', {
  label: { en: 'Matches', cs: 'Zápasy' },
  labelSingular: { en: 'Match', cs: 'Zápas' },
  description: { en: 'Every match with its date and, once played, its score. A match without a score is still to come; the website works out the next match and the latest results from them.', cs: 'Každý zápas s datem a po odehrání se skóre. Zápas bez skóre teprve přijde; z nich web sám určí příští zápas a poslední výsledky.' },
  icon: 'i-lucide-calendar-days',
  titleField: 'opponent',
  admin: { list: { columns: ['date', 'squad', 'opponent', 'home', 'goalsFor', 'goalsAgainst'] } },
  fields: {
    squad: f.relation({ to: () => Squad, kind: 'many-to-one', required: true, onDelete: 'cascade' }).label({ en: 'Team', cs: 'Tým' }),
    date: f.datetime().label({ en: 'Date and kick-off', cs: 'Datum a výkop' }),
    opponent: f.text({ required: true }).label({ en: 'Opponent', cs: 'Soupeř' }).help({ en: 'For example “Sokol Bezděkov”.', cs: 'Například „Sokol Bezděkov“.' }),
    home: f.boolean().label({ en: 'Played at home', cs: 'Hraje se doma' }).help({ en: 'Off for an away match.', cs: 'U venkovního zápasu vypněte.' }),
    round: f.number({ int: true, min: 1, max: 99 }).optional().label({ en: 'Round', cs: 'Kolo' }),
    goalsFor: f.number({ int: true, min: 0 }).optional().label({ en: 'Our goals', cs: 'Naše góly' })
      .help({ en: 'Fill in both scores once the match is played; until then the match is still to come.', cs: 'Po odehrání zápasu doplňte obě skóre; do té doby zápas teprve přijde.' }),
    goalsAgainst: f.number({ int: true, min: 0 }).optional().label({ en: 'Opponent’s goals', cs: 'Góly soupeře' }),
    scorers: f.text().optional().label({ en: 'Scorers', cs: 'Střelci' }).help({ en: 'For example “Zeman 2, Šimek”. Written under the last result.', cs: 'Například „Zeman 2, Šimek“. Napíše se pod poslední výsledek.' }),
    report: f.relation({ to: () => Article, kind: 'many-to-one', onDelete: 'set null' }).optional().label({ en: 'Match report', cs: 'Report' })
      .help({ en: 'An article about the match. The last result links to it.', cs: 'Článek o zápase. Poslední výsledek na něj odkáže.' }),
    reference: f.text().optional().label({ en: 'Private note', cs: 'Poznámka pro vás' })
      .help({ en: 'A name for you to recognise the match by. It is not shown on the website.', cs: 'Jméno, podle kterého zápas poznáte. Na webu se nezobrazuje.' }),
  },
  content: { public: true, populate: ['squad', 'report'] },
})

// ── the league table ──
export const Standing = defineEntity('standing', {
  label: { en: 'League table', cs: 'Tabulka' },
  labelSingular: { en: 'Table row', cs: 'Řádek tabulky' },
  description: { en: 'The table of the first team’s competition, one row per club. Drag to put the rows in the order of the table.', cs: 'Tabulka soutěže prvního týmu, jeden řádek na klub. Pořadí tabulky změníte přetažením.' },
  icon: 'i-lucide-list-ordered',
  titleField: 'club',
  admin: { list: { columns: ['club', 'played', 'wins', 'draws', 'losses', 'score', 'points', 'ours'], orderField: 'position' } },
  fields: {
    club: f.text({ required: true }).label({ en: 'Club', cs: 'Klub' }),
    ours: f.boolean().label({ en: 'Our club', cs: 'Náš klub' }).help({ en: 'The row is highlighted, and the opening and the footer read the club’s place from it.', cs: 'Řádek se zvýrazní a úvod i záhlaví z něj čtou postavení klubu.' }),
    played: f.number({ int: true, min: 0 }).label({ en: 'Played', cs: 'Zápasy' }),
    wins: f.number({ int: true, min: 0 }).label({ en: 'Wins', cs: 'Výhry' }),
    draws: f.number({ int: true, min: 0 }).label({ en: 'Draws', cs: 'Remízy' }),
    losses: f.number({ int: true, min: 0 }).label({ en: 'Losses', cs: 'Prohry' }),
    score: f.text({ max: 20 }).label({ en: 'Score', cs: 'Skóre' }).help({ en: 'For example “24:10”.', cs: 'Například „24:10“.' }),
    points: f.number({ int: true, min: 0 }).label({ en: 'Points', cs: 'Body' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── who takes children, and when ──
export const AgeGroup = defineEntity('ageGroup', {
  label: { en: 'Age groups', cs: 'Nábor: ročníky' },
  labelSingular: { en: 'Age group', cs: 'Ročníky' },
  description: { en: 'Who the club takes in and when they train. Drag to put them in order.', cs: 'Koho klub přijímá a kdy trénuje. Pořadí změníte přetažením.' },
  icon: 'i-lucide-baby',
  titleField: 'name',
  admin: { list: { columns: ['name', 'years', 'when'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }).help({ en: 'For example “Mladší přípravka”.', cs: 'Například „Mladší přípravka“.' }),
    years: f.text().optional().label({ en: 'Years of birth', cs: 'Ročníky' }).help({ en: 'For example “2018–2020”.', cs: 'Například „2018–2020“.' }),
    when: f.text().optional().label({ en: 'Training', cs: 'Trénink' }).help({ en: 'For example “po a st 16:00”.', cs: 'Například „po a st 16:00“.' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the sponsors ──
export const Sponsor = defineEntity('sponsor', {
  label: { en: 'Partners', cs: 'Partneři' },
  labelSingular: { en: 'Partner', cs: 'Partner' },
  description: { en: 'The firms and the town that support the club, by level. Drag to put them in order.', cs: 'Firmy a město, které klub podporují, podle úrovně. Pořadí změníte přetažením.' },
  icon: 'i-lucide-handshake',
  titleField: 'name',
  admin: { list: { columns: ['name', 'level', 'url'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    level: f.select({
      options: ['main', 'partner', 'supporter'] as const, default: 'partner',
      labels: { main: { en: 'Main partner', cs: 'Hlavní partner' }, partner: { en: 'Partner', cs: 'Partner' }, supporter: { en: 'Supporter', cs: 'Podporovatel' } },
    }).label({ en: 'Level', cs: 'Úroveň' }),
    url: f.text({ format: 'link' }).optional().label({ en: 'Link', cs: 'Odkaz' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── the committee ──
export const Committee = defineEntity('committee', {
  label: { en: 'Committee', cs: 'Výbor' },
  labelSingular: { en: 'Committee member', cs: 'Člen výboru' },
  description: { en: 'Who runs the club and how to reach them. Drag to put them in order.', cs: 'Kdo klub vede a jak ho zastihnout. Pořadí změníte přetažením.' },
  icon: 'i-lucide-contact',
  titleField: 'name',
  admin: { list: { columns: ['role', 'name', 'contact'], orderField: 'position' } },
  fields: {
    role: f.text({ required: true }).label({ en: 'Role', cs: 'Funkce' }).help({ en: 'For example “Předseda”.', cs: 'Například „Předseda“.' }),
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    contact: f.text().optional().label({ en: 'Phone or e-mail', cs: 'Telefon nebo e-mail' }),
    position: f.number({ int: true }).optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})

// ── page building blocks: each is drawn by app/components/global/Block<Type>.vue, which hands
//    it to the look's own component (app/components/<look>/<Type>.vue) ──
const eyebrow = () => f.text().label({ en: 'Line above the heading', cs: 'Řádek nad nadpisem' })
const heading = (required = true) => f.text({ required }).label({ en: 'Heading', cs: 'Nadpis' }).help(EMPHASIS_HELP)
const text = () => f.text({ multiline: true }).label({ en: 'Text', cs: 'Text' })
const link = (en: string, cs: string) => f.text({ format: 'link' }).optional().label({ en, cs })
const photo = (en = 'Photograph', cs = 'Fotografie') => f.media({ accept: 'image/*' }).label({ en, cs })

const nextMatch = defineBlock({
  label: { en: 'Next match', cs: 'Příští zápas' },
  description: { en: 'The opening of the home page: the next match of the first team, worked out from the Matches section, with a few words, the kick-off facts and a photo.', cs: 'Úvod úvodní stránky: příští zápas prvního týmu, který web určí ze sekce Zápasy, pár slov, údaje o výkopu a fotografie.' },
  icon: 'i-lucide-timer',
  fields: {
    heading: heading(false).help({ en: 'Pitch writes it as the headline. Bulletin and Jersey write the two teams of the next match instead, unless you fill this in; text between *asterisks* is set in the second line.', cs: 'Hřiště ji napíše jako hlavní nadpis. Zpravodaj a Dres místo ní napíšou oba týmy příštího zápasu, pokud pole nevyplníte; text mezi *hvězdičkami* jde na druhý řádek.' }),
    lead: text().help({ en: 'A few sentences under the headline.', cs: 'Pár vět pod nadpisem.' }),
    preMatch: f.text().label({ en: 'Before the match', cs: 'Předzápas' })
      .help({ en: 'For example “10:15, dorost s Kamencem”: the time, a comma, what is on. Leave it empty if there is nothing before the match.', cs: 'Například „10:15, dorost s Kamencem“: čas, čárka, co se hraje. Pokud se před zápasem nic nehraje, pole nechte prázdné.' }),
    image: photo().help({ en: 'Bulletin and Pitch show it in the opening; Jersey uses the one of the “Last result” block.', cs: 'Zpravodaj a Hřiště ji ukážou v úvodu; Dres použije fotografii z bloku „Poslední výsledek“.' }),
    caption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'Bulletin and Pitch write it on or under the photo.', cs: 'Zpravodaj a Hřiště ho napíšou na fotografii nebo pod ni.' }),
    primaryLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }),
    primaryUrl: link('Button destination', 'Cíl tlačítka'),
    secondaryLabel: f.text().label({ en: 'Second button text', cs: 'Text druhého tlačítka' }).help({ en: 'Bulletin and Pitch show it; Jersey has one button.', cs: 'Zpravodaj a Hřiště ho ukážou; Dres má jedno tlačítko.' }),
    secondaryUrl: link('Second button destination', 'Cíl druhého tlačítka'),
  },
})

const lastResult = defineBlock({
  label: { en: 'Last result, form and place', cs: 'Poslední výsledek, forma a postavení' },
  description: { en: 'The latest result of the first team, its last five matches and its place in the table, all worked out from Matches and League table.', cs: 'Poslední výsledek prvního týmu, jeho posledních pět zápasů a místo v tabulce; vše web určí ze sekcí Zápasy a Tabulka.' },
  icon: 'i-lucide-trophy',
  fields: {
    image: photo().help({ en: 'Jersey lays the last result over this photo; the other looks do not show it.', cs: 'Dres přes ni položí poslední výsledek; ostatní vzhledy ji nezobrazují.' }),
    resultLabel: f.text().label({ en: 'Label of the last result', cs: 'Popisek posledního výsledku' }).help({ en: 'For example “Minule”. The date of the match is added.', cs: 'Například „Minule“. Připíše se datum zápasu.' }),
    scorersLabel: f.text().label({ en: 'Word before the scorers', cs: 'Slovo před střelci' }).help({ en: 'For example “Branky” or “Góly”.', cs: 'Například „Branky“ nebo „Góly“.' }),
    reportLabel: f.text().label({ en: 'Link to the report', cs: 'Odkaz na report' }).help({ en: 'For example “Číst report”. It appears when the match has a report.', cs: 'Například „Číst report“. Zobrazí se, má-li zápas report.' }),
    formLabel: f.text().label({ en: 'Label of the last five', cs: 'Popisek posledních pěti' }),
    formNote: text().help({ en: 'A sentence about the form. Bulletin and Pitch write it under the five squares.', cs: 'Věta o formě. Zpravodaj a Hřiště ji napíšou pod pětici čtverečků.' }),
    standingLabel: f.text().label({ en: 'Label of the place', cs: 'Popisek postavení' }),
    standingNote: f.text().label({ en: 'Note on the place', cs: 'Poznámka k postavení' }).help({ en: 'For example “Dva body za Bezděkovem.” Only Bulletin shows it.', cs: 'Například „Dva body za Bezděkovem.“ Ukáže ji jen Zpravodaj.' }),
    standingLinkLabel: f.text().label({ en: 'Link to the table', cs: 'Odkaz na tabulku' }),
  },
})

const fixtures = defineBlock({
  label: { en: 'Fixtures and results', cs: 'Zápasy a výsledky' },
  description: { en: 'The matches of each team that has a tab (Teams → Shown in the match list), the coming ones and the played ones.', cs: 'Zápasy každého týmu, který má záložku (Týmy → Zobrazit v rozpisu zápasů), nadcházející i odehrané.' },
  icon: 'i-lucide-calendar-days',
  fields: {
    heading: heading(),
    season: f.text().label({ en: 'Season', cs: 'Sezona' }).help({ en: 'Written after the competition of the chosen team, for example “podzim 2026”.', cs: 'Napíše se za soutěž vybraného týmu, například „podzim 2026“.' }),
    comingLabel: f.text().label({ en: 'Heading of the coming matches', cs: 'Nadpis nadcházejících zápasů' }).help({ en: 'Bulletin and Pitch show it; Jersey lists all matches in one table.', cs: 'Zpravodaj a Hřiště ho ukážou; Dres řadí všechny zápasy do jedné tabulky.' }),
    playedLabel: f.text().label({ en: 'Heading of the played matches', cs: 'Nadpis odehraných zápasů' }),
    note: text().help({ en: 'A note by the matches, for example about the bus. Pitch shows it under the lists.', cs: 'Poznámka u zápasů, například o autobusu. Hřiště ji ukáže pod seznamy.' }),
    note2: f.text().label({ en: 'Second note', cs: 'Druhá poznámka' }).help({ en: 'Pitch shows it in a smaller type.', cs: 'Hřiště ji ukáže menším písmem.' }),
    moreLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'For example “Celý rozpis podzimu 2026”.', cs: 'Například „Celý rozpis podzimu 2026“.' }),
    moreUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const table = defineBlock({
  label: { en: 'League table', cs: 'Tabulka' },
  description: { en: 'The table from the League table section, the club’s row highlighted. Bulletin draws it beside the fixtures when it follows that block.', cs: 'Tabulka ze sekce Tabulka se zvýrazněným řádkem klubu. Zpravodaj ji nakreslí vedle zápasů, pokud za nimi následuje.' },
  icon: 'i-lucide-list-ordered',
  fields: {
    heading: heading(),
    competition: f.text().label({ en: 'Competition', cs: 'Soutěž' }).help({ en: 'For example “I. B třída, skupina C”. “After round 10” is added from the table.', cs: 'Například „I. B třída, skupina C“. „Po 10. kole“ se doplní z tabulky.' }),
    note: f.text().label({ en: 'Note under the table', cs: 'Poznámka pod tabulkou' }).help({ en: 'For example about who is promoted or relegated.', cs: 'Například kdo postupuje a kdo sestupuje.' }),
    image: photo().help({ en: 'Pitch shows it beside the table.', cs: 'Hřiště ji ukáže vedle tabulky.' }),
    asideHeading: f.text().label({ en: 'Heading beside the table', cs: 'Nadpis u tabulky' }).help({ en: 'Pitch shows it with the photo.', cs: 'Hřiště ho ukáže u fotografie.' }),
    asideText: text().help({ en: 'Jersey and Pitch show it beside the table.', cs: 'Dres a Hřiště ho ukážou u tabulky.' }),
    asideLinkLabel: f.text().label({ en: 'Link text', cs: 'Text odkazu' }).help({ en: 'Pitch shows it under the text.', cs: 'Hřiště ho ukáže pod textem.' }),
    asideLinkUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const teams = defineBlock({
  label: { en: 'Teams', cs: 'Týmy' },
  description: { en: 'The teams from the Teams section, with their competition, coach and training times.', cs: 'Týmy ze sekce Týmy se soutěží, trenérem a časy tréninků.' },
  icon: 'i-lucide-users',
  fields: {
    heading: heading(),
    text: text(),
    image: photo().help({ en: 'Only Bulletin shows it, beside the list, on wide screens.', cs: 'Ukáže ji jen Zpravodaj, vedle seznamu na širokých obrazovkách.' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }),
  },
})

const roster = defineBlock({
  label: { en: 'Squad', cs: 'Soupiska' },
  description: { en: 'The players from the Players section, with portraits for those who have a photo.', cs: 'Hráči ze sekce Hráči, s portrétem u těch, kdo mají fotografii.' },
  icon: 'i-lucide-shirt',
  fields: {
    heading: heading(),
    season: f.text().label({ en: 'Season', cs: 'Sezona' }).help({ en: 'For example “Podzim 2026”.', cs: 'Například „Podzim 2026“.' }),
    staff: f.list({
      fields: {
        name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
        role: f.text({ required: true }).label({ en: 'Role', cs: 'Role' }).help({ en: 'For example “trenér” or “asistent”.', cs: 'Například „trenér“ nebo „asistent“.' }),
      },
      max: 6, itemLabel: { en: 'Person', cs: 'Osoba' },
    }).label({ en: 'Coaching staff', cs: 'Realizační tým' })
      .help({ en: 'Bulletin and Pitch write them after the season (“trenér Radek Vondráček”), Jersey as a tile of its own.', cs: 'Zpravodaj a Hřiště je napíšou za sezonu („trenér Radek Vondráček“), Dres jako vlastní dlaždici.' }),
  },
})

const news = defineBlock({
  label: { en: 'News', cs: 'Aktuality' },
  description: { en: 'The newest articles from the News section: the first large, the next ones beside or below it. Each opens its own page.', cs: 'Nejnovější články ze sekce Aktuality: první velký, další vedle něj nebo pod ním. Každý se otevře na vlastní stránce.' },
  icon: 'i-lucide-newspaper',
  fields: {
    heading: heading(),
    count: f.number({ int: true, min: 1, max: 60 }).label({ en: 'How many articles', cs: 'Kolik článků' }).help({ en: 'The home page shows four; the list of all articles shows them all.', cs: 'Úvodní stránka ukazuje čtyři; seznam všech článků ukazuje všechny.' }),
    linkLabel: f.text().label({ en: 'Link to all articles', cs: 'Odkaz na všechny články' }).help({ en: 'For example “Všechny články”. Leave it empty on the list itself.', cs: 'Například „Všechny články“. Na samotném seznamu pole nechte prázdné.' }),
    linkUrl: link('Link destination', 'Cíl odkazu'),
  },
})

const join = defineBlock({
  label: { en: 'Join the club', cs: 'Nábor' },
  description: { en: 'Who the club takes in, with the age groups from the Age groups section and a form for a trial training. The replies arrive in the admin.', cs: 'Koho klub přijímá, s ročníky ze sekce Nábor: ročníky a formulářem na zkušební trénink. Přihlášky najdete v administraci.' },
  icon: 'i-lucide-user-plus',
  fields: {
    eyebrow: eyebrow(),
    heading: heading(),
    text: text(),
    image: photo(),
    listLabel: f.text().label({ en: 'Label of the list', cs: 'Popisek seznamu' }).help({ en: 'Bulletin writes it above the age groups.', cs: 'Zpravodaj ho napíše nad ročníky.' }),
    formHeading: f.text().label({ en: 'Heading of the form', cs: 'Nadpis formuláře' }),
    buttonLabel: f.text().label({ en: 'Button text', cs: 'Text tlačítka' }).help({ en: 'Leave it empty to use the form’s own.', cs: 'Pokud pole nevyplníte, použije se text z formuláře.' }),
    contactText: f.text().label({ en: 'Who will reply', cs: 'Kdo se ozve' }).help({ en: 'The sentence before the phone number, for example “Ozve se vám Lenka Marková,”.', cs: 'Věta před telefonním číslem, například „Ozve se vám Lenka Marková,“.' }),
    contactPhone: f.text().label({ en: 'Phone number', cs: 'Telefonní číslo' }),
  },
})

const sponsors = defineBlock({
  label: { en: 'Partners', cs: 'Partneři' },
  description: { en: 'The partners from the Partners section, by level.', cs: 'Partneři ze sekce Partneři podle úrovně.' },
  icon: 'i-lucide-handshake',
  fields: {
    heading: heading(),
    text: text(),
    note: f.text().label({ en: 'Invitation to join', cs: 'Pozvánka k partnerství' }).help({ en: 'Bulletin writes it under the list, with the e-mail below as a link, for example “Chcete se přidat? Napište předsedovi klubu na”.', cs: 'Zpravodaj ji napíše pod seznam, s e-mailem níže jako odkazem, například „Chcete se přidat? Napište předsedovi klubu na“.' }),
    noteEmail: f.text({ format: 'email' }).optional().label({ en: 'E-mail for partners', cs: 'E-mail pro partnery' }),
  },
})

const about = defineBlock({
  label: { en: 'About the club', cs: 'O klubu' },
  description: { en: 'The club’s story and figures, the ground with its address and practical facts, and the committee from the Committee section.', cs: 'Příběh a čísla klubu, hřiště s adresou a praktickými údaji a výbor ze sekce Výbor.' },
  icon: 'i-lucide-landmark',
  fields: {
    heading: heading(),
    text: text(),
    image: photo().help({ en: 'The ground. Jersey lays the heading over its bottom edge.', cs: 'Hřiště. Dres přes jeho spodní okraj položí nadpis.' }),
    imageCaption: f.text().label({ en: 'Caption', cs: 'Popisek' }).help({ en: 'Bulletin and Pitch write it under the photo.', cs: 'Zpravodaj a Hřiště ho napíšou pod fotografii.' }),
    facts: f.list({
      fields: {
        value: f.text({ required: true, max: 20 }).label({ en: 'Figure', cs: 'Údaj' }).help({ en: 'For example “142”.', cs: 'Například „142“.' }),
        label: f.text({ required: true, max: 40 }).label({ en: 'What it is', cs: 'Co to je' }).help({ en: 'For example “členů”.', cs: 'Například „členů“.' }),
      },
      max: 3, itemLabel: { en: 'Figure', cs: 'Údaj' },
    }).label({ en: 'Figures', cs: 'Čísla' }),
    groundHeading: f.text().label({ en: 'Heading of the ground', cs: 'Nadpis hřiště' }).help({ en: 'For example “Stadion Na Sádkách”. Empty: the name of the ground from Site settings.', cs: 'Například „Stadion Na Sádkách“. Prázdné: název hřiště z Nastavení webu.' }),
    groundText: text().help({ en: 'Bulletin and Jersey write it under the address.', cs: 'Zpravodaj a Dres ho napíšou pod adresu.' }),
    groundFacts: f.list({
      fields: {
        label: f.text({ required: true }).label({ en: 'What', cs: 'Co' }).help({ en: 'For example “Tribuna”.', cs: 'Například „Tribuna“.' }),
        value: f.text({ required: true }).label({ en: 'Value', cs: 'Hodnota' }).help({ en: 'For example “krytá, 180 míst”.', cs: 'Například „krytá, 180 míst“.' }),
      },
      max: 10, itemLabel: { en: 'Fact', cs: 'Údaj' },
    }).label({ en: 'Facts about the ground', cs: 'Údaje o hřišti' })
      .help({ en: 'Pitch writes them as a list beside the address; Bulletin and Jersey use the text above instead.', cs: 'Hřiště je napíše jako seznam u adresy; Zpravodaj a Dres místo toho použijí text výše.' }),
    matchDayHeading: f.text().label({ en: 'Heading of the match day', cs: 'Nadpis dne zápasu' }).help({ en: 'For example “V den zápasu”. Pitch leaves this block out.', cs: 'Například „V den zápasu“. Hřiště tento oddíl vynechává.' }),
    matchDayTitle: f.text().label({ en: 'Line above the match day', cs: 'Řádek nad textem' }).help({ en: 'Jersey writes it large, for example “Vstupné 40 Kč”.', cs: 'Dres ho napíše velkým písmem, například „Vstupné 40 Kč“.' }),
    matchDayText: text().help({ en: 'Bulletin and Jersey. An empty line starts a new paragraph.', cs: 'Zpravodaj a Dres. Prázdný řádek začne nový odstavec.' }),
    committeeHeading: f.text().label({ en: 'Heading of the committee', cs: 'Nadpis výboru' }),
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
  blocks: { nextMatch, lastResult, fixtures, table, teams, roster, news, join, sponsors, about, text: richText, ...customTypeBlocks() },
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
  formsPlugin(), // the applications of the form below
]

// ── the application for a trial training ──
export const Trial = defineForm('trial', {
  label: { en: 'Trial training applications', cs: 'Přihlášky na zkušební trénink' },
  labelSingular: { en: 'Application', cs: 'Přihláška' },
  fields: {
    child: f.text({ required: true, max: 200 }).label({ en: 'Child’s name', cs: 'Jméno dítěte' }).help({ en: 'For example Matěj Novák', cs: 'Například Matěj Novák' }),
    birthYear: f.text({ required: true, max: 4 }).label({ en: 'Year of birth', cs: 'Rok narození' }).help({ en: 'For example 2017', cs: 'Například 2017' }),
    parent: f.text({ required: true, max: 200 }).label({ en: 'Parent’s name', cs: 'Jméno rodiče' }),
    contact: f.text({ required: true, max: 200 }).label({ en: 'Phone or e-mail', cs: 'Telefon nebo e-mail' }),
  },
  titleField: 'child',
  submitLabel: { en: 'Send the application', cs: 'Odeslat přihlášku' },
  successMessage: { en: 'Thank you, we have your application. We will be in touch about the first training.', cs: 'Děkujeme, přihlášku máme. Ozveme se vám ohledně prvního tréninku.' },
})
export const FormSettings = defineFormSettings()
