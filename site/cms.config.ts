import {
  defineBlock, defineEntity, defineLocales, defineNavigation,
  definePages, defineRedirects, defineSingleton, eq, f, seo,
} from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

// The tinyzoo website: what it is, how it compares with October CMS, and the way
// into the demo. Built with tinyzoo itself, from the starter. Change the model here,
// then `pnpm db:generate` (review the SQL) and `pnpm db:migrate`.

// Czech is the default (no prefix); English and German live under /en and /de.
export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en', 'de'] })

// The brand animals a block can show (assets/animals). Bright first: they lead.
const ANIMALS = ['bunny', 'bird', 'fox', 'frog', 'octopus', 'elephant', 'owl', 'whale', 'turtle', 'hedgehog', 'koala', 'penguin'] as const
const animalLabels = {
  bunny: { cs: 'Zajíc', en: 'Bunny', de: 'Hase' }, bird: { cs: 'Pták', en: 'Bird', de: 'Vogel' }, fox: { cs: 'Liška', en: 'Fox', de: 'Fuchs' },
  frog: { cs: 'Žába', en: 'Frog', de: 'Frosch' }, octopus: { cs: 'Chobotnice', en: 'Octopus', de: 'Oktopus' }, elephant: { cs: 'Slon', en: 'Elephant', de: 'Elefant' },
  owl: { cs: 'Sova', en: 'Owl', de: 'Eule' }, whale: { cs: 'Velryba', en: 'Whale', de: 'Wal' }, turtle: { cs: 'Želva', en: 'Turtle', de: 'Schildkröte' },
  hedgehog: { cs: 'Ježek', en: 'Hedgehog', de: 'Igel' }, koala: { cs: 'Koala', en: 'Koala', de: 'Koala' }, penguin: { cs: 'Tučňák', en: 'Penguin', de: 'Pinguin' },
}
const animal = () => f.select({ options: ANIMALS, labels: animalLabels }).label({ cs: 'Zvíře', en: 'Animal', de: 'Tier' })
const eyebrow = () => f.text({ max: 60 }).label({ cs: 'Nadtitulek', en: 'Eyebrow', de: 'Dachzeile' })

// ── the whole site ──
export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu', de: 'Website-Einstellungen' },
  description: { en: 'Name and contacts shown across the website.', cs: 'Název a kontakty, které se ukazují na celém webu.', de: 'Name und Kontaktdaten, die auf der gesamten Website angezeigt werden.' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Site name', cs: 'Název webu', de: 'Name der Website' }),
    tagline: f.text().optional().localized().label({ en: 'Tagline', cs: 'Slogan', de: 'Slogan' }),
    footerNote: f.text({ multiline: true }).optional().localized().label({ en: 'Footer note', cs: 'Poznámka v patičce', de: 'Hinweis in der Fußzeile' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'Email', cs: 'E-mail', de: 'E-Mail' }),
    ...seo({ localized: true }),
  },
  content: { public: true, populate: ['ogImage'] },
})

// ── page blocks: each is drawn by components/global/Block<Type>.vue ──
const hero = defineBlock({
  label: { cs: 'Úvod', en: 'Hero', de: 'Einstiegsbereich' },
  description: { cs: 'Velký nadpis, dvě tlačítka a ukázka (video nebo obrázek).', en: 'A big heading, two buttons and a showcase.', de: 'Eine große Überschrift, zwei Schaltflächen und ein Video oder Bild.' },
  icon: 'i-lucide-panel-top',
  fields: {
    eyebrow: eyebrow(),
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
    primaryLabel: f.text().label({ cs: 'Hlavní tlačítko', en: 'Main button', de: 'Hauptschaltfläche' }),
    primaryUrl: f.text({ format: 'link' }).label({ cs: 'Hlavní tlačítko vede na', en: 'Main button goes to', de: 'Linkziel der Hauptschaltfläche' }),
    secondaryLabel: f.text().label({ cs: 'Druhé tlačítko', en: 'Second button', de: 'Zweite Schaltfläche' }),
    secondaryUrl: f.text({ format: 'link' }).label({ cs: 'Druhé tlačítko vede na', en: 'Second button goes to', de: 'Linkziel der zweiten Schaltfläche' }),
    video: f.media({ accept: 'video/*' }).label({ cs: 'Video (smyčka bez zvuku)', en: 'Video (silent loop)', de: 'Video (Endlosschleife ohne Ton)' }),
    image: f.media({ accept: 'image/*' }).label({ cs: 'Obrázek (když není video)', en: 'Picture (without a video)', de: 'Bild (wenn kein Video vorhanden ist)' }),
  },
})

const features = defineBlock({
  label: { cs: 'Výhody', en: 'Features', de: 'Funktionen' },
  description: { cs: 'Karty se zvířátky: co umíme a proč na tom záleží.', en: 'Cards with animals: what it does and why it matters.', de: 'Karten mit Tieren: Funktionen und ihr Nutzen.' },
  icon: 'i-lucide-layout-grid',
  fields: {
    eyebrow: eyebrow(),
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
    items: f.list({
      fields: {
        title: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Title', de: 'Titel' }),
        text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
        animal: animal(),
      },
      max: 9,
      itemLabel: { cs: 'Karta', en: 'Card', de: 'Karte' },
    }).label({ cs: 'Karty', en: 'Cards', de: 'Karten' }),
  },
})

const showcase = defineBlock({
  label: { cs: 'Videoukázky', en: 'Video tour', de: 'Videorundgang' },
  description: { cs: 'Krátká videa vlevo vybraná, vpravo přehraná.', en: 'Short videos: picked on the left, played on the right.', de: 'Kurze Videos: links auswählen, rechts ansehen.' },
  icon: 'i-lucide-clapperboard',
  fields: {
    eyebrow: eyebrow(),
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
    items: f.list({
      fields: {
        title: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Title', de: 'Titel' }),
        text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
        video: f.media({ accept: 'video/*' }).label({ cs: 'Video', en: 'Video', de: 'Video' }),
      },
      max: 8,
      itemLabel: { cs: 'Ukázka', en: 'Clip', de: 'Video' },
    }).label({ cs: 'Ukázky', en: 'Clips', de: 'Videos' }),
  },
})

const code = defineBlock({
  label: { cs: 'Ukázka kódu', en: 'Code', de: 'Code' },
  description: { cs: 'Tmavý pruh s okny kódu, pro vývojáře.', en: 'A dark band with code windows, for developers.', de: 'Ein dunkler Abschnitt mit Codefenstern für Entwickler.' },
  icon: 'i-lucide-code-xml',
  fields: {
    eyebrow: eyebrow(),
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
    files: f.list({
      fields: {
        name: f.text({ required: true }).label({ cs: 'Název souboru', en: 'File name', de: 'Dateiname' }),
        code: f.text({ multiline: true, required: true, max: 4000 }).label({ cs: 'Kód', en: 'Code', de: 'Code' }),
      },
      max: 3,
      itemLabel: { cs: 'Soubor', en: 'File', de: 'Datei' },
    }).label({ cs: 'Soubory', en: 'Files', de: 'Dateien' }),
    chips: f.text().label({ cs: 'Štítky kolem (oddělené čárkou)', en: 'Floating chips (comma-separated)', de: 'Schwebende Schlagwörter (durch Kommas getrennt)' }),
  },
})

const steps = defineBlock({
  label: { cs: 'Kroky', en: 'Steps', de: 'Schritte' },
  description: { cs: 'Očíslované kroky, volitelně s příkazem.', en: 'Numbered steps, optionally with a command.', de: 'Nummerierte Schritte, optional mit einem Befehl.' },
  icon: 'i-lucide-list-ordered',
  fields: {
    eyebrow: eyebrow(),
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    items: f.list({
      fields: {
        title: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Title', de: 'Titel' }),
        text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
        command: f.text().label({ cs: 'Příkaz', en: 'Command', de: 'Befehl' }),
      },
      max: 6,
      itemLabel: { cs: 'Krok', en: 'Step', de: 'Schritt' },
    }).label({ cs: 'Kroky', en: 'Steps', de: 'Schritte' }),
  },
})

// Where tinyzoo is heading: plans grouped as now / next / later (the column names are in the site's code).
const roadmap = defineBlock({
  label: { cs: 'Plány', en: 'Roadmap', de: 'Roadmap' },
  description: { cs: 'Co děláme teď, co přijde brzy a co později.', en: 'What we are doing now, what comes next and what comes later.', de: 'Woran wir jetzt arbeiten, was als Nächstes kommt und was später.' },
  icon: 'i-lucide-map',
  fields: {
    eyebrow: eyebrow(),
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
    items: f.list({
      fields: {
        title: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Title', de: 'Titel' }),
        text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
        stage: f.select({
          options: ['now', 'next', 'later'] as const, default: 'next',
          labels: { now: { cs: 'Právě teď', en: 'Now', de: 'Jetzt' }, next: { cs: 'Brzy', en: 'Next', de: 'Als Nächstes' }, later: { cs: 'Později', en: 'Later', de: 'Später' } },
        }).label({ cs: 'Kdy', en: 'When', de: 'Wann' }),
        animal: animal(),
      },
      max: 12,
      itemLabel: { cs: 'Plán', en: 'Plan', de: 'Vorhaben' },
    }).label({ cs: 'Plány', en: 'Plans', de: 'Vorhaben' }),
    note: f.text({ multiline: true }).label({ cs: 'Poznámka pod plány', en: 'Note under the plans', de: 'Hinweis unter den Vorhaben' }),
  },
})

const faq = defineBlock({
  label: { cs: 'Otázky a odpovědi', en: 'FAQ', de: 'Fragen und Antworten' },
  description: { cs: 'Rozbalovací otázky.', en: 'Questions that open.', de: 'Fragen mit aufklappbaren Antworten.' },
  icon: 'i-lucide-messages-square',
  fields: {
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
    items: f.list({
      fields: {
        question: f.text({ required: true }).label({ cs: 'Otázka', en: 'Question', de: 'Frage' }),
        answer: f.text({ multiline: true, required: true }).label({ cs: 'Odpověď', en: 'Answer', de: 'Antwort' }),
      },
      max: 20,
      itemLabel: { cs: 'Otázka', en: 'Question', de: 'Frage' },
    }).label({ cs: 'Otázky', en: 'Questions', de: 'Fragen' }),
  },
})

const cta = defineBlock({
  label: { cs: 'Výzva', en: 'Call to action', de: 'Handlungsaufruf' },
  description: { cs: 'Tmavá karta se zvířátkem a tlačítky.', en: 'A dark card with an animal and buttons.', de: 'Eine dunkle Karte mit einem Tier und Schaltflächen.' },
  icon: 'i-lucide-megaphone',
  fields: {
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
    primaryLabel: f.text().label({ cs: 'Hlavní tlačítko', en: 'Main button', de: 'Hauptschaltfläche' }),
    primaryUrl: f.text({ format: 'link' }).label({ cs: 'Hlavní tlačítko vede na', en: 'Main button goes to', de: 'Linkziel der Hauptschaltfläche' }),
    secondaryLabel: f.text().label({ cs: 'Druhé tlačítko', en: 'Second button', de: 'Zweite Schaltfläche' }),
    secondaryUrl: f.text({ format: 'link' }).label({ cs: 'Druhé tlačítko vede na', en: 'Second button goes to', de: 'Linkziel der zweiten Schaltfläche' }),
    animal: animal(),
  },
})

const text = defineBlock({
  label: { cs: 'Text', en: 'Text', de: 'Text' },
  description: { cs: 'Nadpis a odstavce.', en: 'A heading and paragraphs.', de: 'Eine Überschrift und Textabsätze.' },
  icon: 'i-lucide-text',
  fields: {
    heading: f.text().label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    body: f.richtext().label({ cs: 'Text', en: 'Text', de: 'Text' }),
  },
})

const demo = defineBlock({
  label: { cs: 'Vstup do ukázky', en: 'Demo login', de: 'Demo-Zugang' },
  description: { cs: 'Přihlašovací údaje do ukázkové administrace a co si zkusit.', en: 'The demo admin login and what to try.', de: 'Zugangsdaten zur Demo-Verwaltung und Aufgaben zum Ausprobieren.' },
  icon: 'i-lucide-key-round',
  fields: {
    heading: f.text({ required: true }).label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
    tips: f.list({
      fields: { text: f.text({ required: true }).label({ cs: 'Tip', en: 'Tip', de: 'Tipp' }) },
      max: 10,
      itemLabel: { cs: 'Tip', en: 'Tip', de: 'Tipp' },
    }).label({ cs: 'Co si zkusit', en: 'What to try', de: 'Zum Ausprobieren' }),
  },
})

const feedback = defineBlock({
  label: { cs: 'Formulář zpětné vazby', en: 'Feedback form', de: 'Feedbackformular' },
  description: { cs: 'Formulář pro připomínky k pilotu, s nadpisem.', en: 'The pilot feedback form, with a heading.', de: 'Feedbackformular zum Pilotprojekt mit einer Überschrift.' },
  icon: 'i-lucide-mail',
  fields: {
    heading: f.text().label({ cs: 'Nadpis', en: 'Heading', de: 'Überschrift' }),
    text: f.text({ multiline: true }).label({ cs: 'Text', en: 'Text', de: 'Text' }),
  },
})

export const Page = definePages({ blocks: { hero, features, showcase, code, steps, roadmap, faq, cta, text, demo, feedback }, localized: true })

// ── what's new: the pilot's changelog ──
// Its address in each language (the site's pages/[...slug].vue knows the same segments).
const NEWS_PATH = { cs: '/novinky/:slug', en: '/news/:slug', de: '/neuigkeiten/:slug' }
export const News = defineEntity('news', {
  label: { en: "What's new", cs: 'Novinky', de: 'Neuigkeiten' },
  labelSingular: { en: 'Update', cs: 'Novinka', de: 'Neuigkeit' },
  description: { en: 'What changed in tinyzoo, newest first.', cs: 'Co se v tinyzoo změnilo, od nejnovějšího.', de: 'Was sich in tinyzoo geändert hat, das Neueste zuerst.' },
  icon: 'i-lucide-sparkles',
  titleField: 'title',
  admin: { list: { columns: ['title', 'kind', 'status', 'publishedAt'] } },
  fields: {
    title: f.text({ required: true }).localized().label({ en: 'Title', cs: 'Název', de: 'Titel' }),
    slug: f.slug({ from: 'title', unique: true }).localized().label({ en: 'URL address', cs: 'Adresa (URL)', de: 'Adresse (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const, default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept', de: 'Entwurf' }, published: { en: 'Published', cs: 'Zveřejněno', de: 'Veröffentlicht' } },
    }).label({ en: 'Status', cs: 'Stav', de: 'Status' }),
    kind: f.select({
      options: ['feature', 'improvement', 'fix'] as const, default: 'feature',
      labels: { feature: { en: 'New', cs: 'Novinka', de: 'Neu' }, improvement: { en: 'Better', cs: 'Vylepšení', de: 'Verbesserung' }, fix: { en: 'Fix', cs: 'Oprava', de: 'Fehlerbehebung' } },
    }).label({ en: 'Kind', cs: 'Druh', de: 'Art' }),
    publishedAt: f.datetime().optional().label({ en: 'Publish date', cs: 'Datum zveřejnění', de: 'Veröffentlichungsdatum' }),
    cover: f.media({ accept: 'image/*' }).optional().label({ en: 'Cover picture', cs: 'Úvodní obrázek', de: 'Titelbild' }),
    perex: f.text({ multiline: true, max: 300 }).optional().localized().label({ en: 'Summary', cs: 'Perex', de: 'Kurzbeschreibung' }),
    body: f.richtext().localized().label({ en: 'Text', cs: 'Text', de: 'Text' }),
    ...seo({ localized: true }),
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', dateField: 'publishedAt', preview: NEWS_PATH },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: NEWS_PATH,
    populate: ['cover', 'ogImage'],
  },
})

// ── menus, redirects, the feedback form ──
export const Navigation = defineNavigation({ localized: true })
export const Redirect = defineRedirects()

// Plugins add features with their own admin pages, routes and tables: Forms here.
export const plugins = [formsPlugin()]

export const Feedback = defineForm('feedback', {
  label: { en: 'Pilot feedback', cs: 'Zpětná vazba', de: 'Feedback zum Pilotprojekt' },
  labelSingular: { en: 'Message', cs: 'Zpráva', de: 'Nachricht' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Your name', cs: 'Vaše jméno', de: 'Ihr Name' }),
    email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail', de: 'E-Mail' }),
    role: f.select({
      options: ['developer', 'project', 'sales', 'other'] as const,
      labels: { developer: { en: 'Developer', cs: 'Vývojář', de: 'Entwickler' }, project: { en: 'Project manager', cs: 'Projekťák', de: 'Projektleitung' }, sales: { en: 'Sales', cs: 'Obchod', de: 'Vertrieb' }, other: { en: 'Something else', cs: 'Něco jiného', de: 'Etwas anderes' } },
    }).optional().label({ en: 'I am', cs: 'Jsem', de: 'Ich bin' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'Message', cs: 'Zpráva', de: 'Nachricht' }),
  },
  successMessage: { en: 'Thank you! We read every message.', cs: 'Díky! Čteme každou zprávu.', de: 'Vielen Dank! Wir lesen jede Nachricht.' },
})
export const FormSettings = defineFormSettings()
