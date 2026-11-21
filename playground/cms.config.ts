import { defineAdminMenu, defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineRoles, defineSingleton, eq, f, ilike, not, seo } from "tinyzoo"
import { defineForm, defineFormSettings, formsPlugin } from "tinyzoo/forms"
import { analyticsPlugin } from "tinyzoo/analytics"
import { consentPlugin } from "tinyzoo/consent"
import { eventsPlugin } from "./cms-plugins/events"

// Content languages: Czech is the default (each entry's own row), English is a
// translation of the fields marked .localized(), falling back to Czech when missing.
export const locales = defineLocales({ default: "cs", locales: ["cs", "en"] })

// Roles beyond admin, editor and author. Each one extends a built-in role and narrows (or, for an
// author, widens) it per collection; what a role may do with a single field is set on the field.
export const roles = defineRoles({
  // Translates posts and pages: reads the other content, changes only these two, never publishes
  // (it drafts only), and may change only the files it uploaded.
  translator: {
    from: "editor",
    label: { en: "Translator", cs: "Překladatel", de: "Übersetzer" },
    description: { en: "Translates posts and pages; drafts only.", cs: "Překládá články a stránky; jen koncepty.", de: "Übersetzt Beiträge und Seiten; nur Entwürfe." },
    entities: { post: ["read", "update"], page: ["read", "update"], author: ["read"], tag: ["read"] },
    publish: false,
    media: "own",
  },
  // Proofreads posts: edits them (the "Where" note too, which translators may only read), never publishes.
  proofreader: {
    from: "editor",
    label: { en: "Proofreader", cs: "Korektor", de: "Korrektor" },
    entities: { post: ["read", "update"] },
    publish: false,
    media: "own",
  },
  // Looks after the people who write: manages authors (and sees their email), reads posts, has no media library.
  curator: {
    from: "editor",
    label: { en: "Curator", cs: "Správce autorů", de: "Autorenbetreuung" },
    entities: { author: ["read", "create", "update", "delete"], post: ["read"], tag: ["read"] },
    media: "none",
  },
  // Looks after the site's texts: the settings and the posts. May publish, but not rename the site or change its colour.
  marketer: {
    from: "editor",
    label: { en: "Marketing", cs: "Marketing", de: "Marketing" },
    entities: { siteSettings: ["read", "update"], post: ["read", "update"] },
  },
})

// A single-row global: site-wide settings, editable under "Globals" in the admin
// and delivered headlessly at GET /api/content/_global/siteSettings.
export const SiteSettings = defineSingleton("siteSettings", {
  label: { en: "Site settings", cs: "Nastavení webu", de: "Website-Einstellungen" },
  description: { en: "The site name, tagline and logo used across the whole website.", cs: "Název webu, slogan a logo, které se používají na celém webu.", de: "Name, Slogan und Logo, die auf der gesamten Website verwendet werden." },
  icon: "i-lucide-settings-2",
  titleField: "siteName",
  fields: {
    siteName: f.text({ required: true })
      // The name of the site is the editors' to change; marketing sees it but cannot.
      .access({ edit: ["editor"] })
      .label({ en: "Site name", cs: "Název webu", de: "Name der Website" })
      .help({ en: "Shown in the header and browser tab.", cs: "Zobrazí se v hlavičce webu a v záložce prohlížeče.", de: "Wird im Kopfbereich der Website und im Browser-Tab angezeigt." }),
    tagline: f.text().optional().label({ en: "Tagline", cs: "Slogan", de: "Slogan" }),
    logo: f.media({ accept: "image/*" }).optional().label({ en: "Logo", cs: "Logo", de: "Logo" }),
    brandColor: f.color().optional().access({ edit: ["editor"] }).label({ en: "Brand colour", cs: "Barva značky", de: "Markenfarbe" }),
    openingHours: f.list({
      fields: {
        days: f.text({ required: true }).label({ en: "Days", cs: "Dny", de: "Tage" }),
        hours: f.text().label({ en: "Hours", cs: "Hodiny", de: "Uhrzeiten" }),
      },
      max: 14,
      itemLabel: { en: "Opening hours", cs: "Otevírací doba", de: "Öffnungszeiten" },
    }).label({ en: "Opening hours", cs: "Otevírací doba", de: "Öffnungszeiten" }),
    rules: f.file().optional().label({ en: "Rules (PDF)", cs: "Pravidla (PDF)", de: "Regeln (PDF)" }),
    // A group: the address and contact kept together (one column, one object in the API).
    contact: f.group({
      fields: {
        phone: f.text().label({ en: "Phone", cs: "Telefon", de: "Telefon" }),
        email: f.text({ format: "email" }).optional().label({ en: "Email", cs: "E-mail", de: "E-Mail" }),
        address: f.group({
          fields: {
            street: f.text({ required: true }).label({ en: "Street", cs: "Ulice", de: "Straße" }),
            city: f.text({ required: true }).label({ en: "City", cs: "Město", de: "Stadt" }),
            zip: f.text().label({ en: "Postcode", cs: "PSČ", de: "PLZ" }),
          },
        }).label({ en: "Address", cs: "Adresa", de: "Adresse" }),
        photo: f.media({ accept: "image/*" }).optional().label({ en: "Photo of the entrance", cs: "Fotka vchodu", de: "Foto des Eingangs" }),
      },
    }).optional().label({ en: "Contact", cs: "Kontakt", de: "Kontakt" }),
    ...seo(),
  },
  content: { public: true, populate: ["logo", "rules", "ogImage"] },
})

export const Author = defineEntity("author", {
  label: { en: "Authors", cs: "Autoři", de: "Autoren" },
  labelSingular: { en: "Author", cs: "Autor", de: "Autor" },
  description: { en: "People who write for the blog. Their name and bio appear with each post.", cs: "Lidé, kteří píšou na blog. Jméno a medailonek se zobrazí u každého článku.", de: "Menschen, die für den Blog schreiben. Name und Kurzbiografie erscheinen bei jedem Beitrag." },
  icon: "i-lucide-users",
  titleField: "name",
  // Arranged by hand (drag in the list): the website lists authors in this order.
  admin: { list: { columns: ["name", "email"], orderField: "position" } },
  fields: {
    name: f.text({ required: true }).label({ en: "Name", cs: "Jméno", de: "Name" }),
    // Who is first in the list is the editors' say; whoever else manages authors only reads it.
    position: f.number().optional().access({ edit: ["editor"] }).label({ en: "Position", cs: "Pořadí", de: "Reihenfolge" }),
    email: f.text({ required: true, format: "email" }).unique()
      // Private: editors and curators read it, only editors change it; everyone else does not see it.
      .access({ read: ["editor", roles.curator], edit: ["editor"] })
      .label({ en: "Email", cs: "E-mail", de: "E-Mail" })
      .help({ en: "Private — never shown on the website.", cs: "Soukromé — na webu se nikdy nezobrazí.", de: "Privat – wird auf der Website nie angezeigt." }),
    bio: f.richtext().optional()
      // Editors only (a rich text field with a rule is edited alone, not shared with others in real time).
      .access({ read: ["editor"] })
      .label({ en: "Bio", cs: "Medailonek", de: "Kurzbiografie" })
      .help({ en: "A few sentences about the author.", cs: "Pár vět o autorovi.", de: "Ein paar Sätze über die Autorin oder den Autor." }),
    posts: f.relation({
      to: () => Post,
      kind: "one-to-many",
      inverseOf: "author",
    }),
  },
  access: { read: () => true },
  // Public via the content API, but never expose the author's email.
  content: { public: true, hidden: ["email"] },
})

export const Tag = defineEntity("tag", {
  label: { en: "Tags", cs: "Štítky", de: "Schlagwörter" },
  labelSingular: { en: "Tag", cs: "Štítek", de: "Schlagwort" },
  description: { en: "Topics that group related posts together.", cs: "Témata, která seskupují související články.", de: "Themen, die zusammengehörige Beiträge bündeln." },
  icon: "i-lucide-tag",
  titleField: "name",
  admin: { list: { columns: ["name", "slug"] } },
  fields: {
    name: f.text({ required: true }).localized().label({ en: "Name", cs: "Název", de: "Name" }),
    slug: f.slug({ from: "name", unique: true }).label({ en: "URL address", cs: "Adresa (URL)", de: "Adresse (URL)" }),
  },
  // Reference data — every tag is public (no published filter).
  content: { public: true },
})

export const Post = defineEntity("post", {
  label: { en: "Posts", cs: "Články", de: "Beiträge" },
  labelSingular: { en: "Post", cs: "Článek", de: "Beitrag" },
  description: { en: "Articles on the blog. Drafts stay private until you publish them.", cs: "Články na blogu. Koncepty zůstávají soukromé, dokud je nezveřejníte.", de: "Artikel im Blog. Entwürfe bleiben privat, bis Sie sie veröffentlichen." },
  icon: "i-lucide-newspaper",
  titleField: "title",
  admin: {
    list: {
      columns: ["hero", "title", "status", "author", "publishedAt"],
      searchable: ["title"],
    },
    // The form's main column in two tabs: the text first, the main image beside it.
    tabs: [
      { label: { en: "Text", cs: "Text", de: "Text" }, fields: ["body"] },
      { label: { en: "Images", cs: "Obrázky", de: "Bilder" }, fields: ["hero", "gallery"] },
    ],
  },
  fields: {
    title: f.text({ required: true }).localized().label({ en: "Title", cs: "Název", de: "Titel" }),
    slug: f.slug({ from: "title", unique: true }).localized()
      .label({ en: "URL address", cs: "Adresa (URL)", de: "Adresse (URL)" })
      .help({ en: "Filled in from the title — change it if you like.", cs: "Vyplní se podle názvu — můžete ji změnit.", de: "Wird aus dem Titel übernommen – Sie können sie ändern." }),
    status: f.select({
      options: ["draft", "published"] as const,
      default: "draft",
      labels: { draft: { en: "Draft", cs: "Koncept", de: "Entwurf" }, published: { en: "Published", cs: "Zveřejněno", de: "Veröffentlicht" } },
    }).label({ en: "Status", cs: "Stav", de: "Status" }),
    // Who sets the date decides who can schedule: the marketing role may publish posts but not change this field, so the
    // editor does not offer it Publish at all (a publish can be a schedule, and a save of the date would be refused).
    publishedAt: f.datetime().optional().access({ edit: ["editor", "author", roles.translator, roles.proofreader] }).label({ en: "Publish date", cs: "Datum zveřejnění", de: "Veröffentlichungsdatum" }),
    hero: f.media({ accept: "image/*" }).optional()
      .label({ en: "Main image", cs: "Hlavní obrázek", de: "Hauptbild" })
      .help({ en: "Shown at the top of the post and in listings.", cs: "Zobrazí se nahoře v článku a v přehledu článků.", de: "Wird oben im Beitrag und in Übersichten angezeigt." }),
    author: f.relation({
      to: () => Author,
      kind: "many-to-one",
      required: true,
      onDelete: "restrict",
    }).label({ en: "Author", cs: "Autor", de: "Autor" }),
    tags: f.relation({ to: () => Tag, kind: "many-to-many" }).label({ en: "Tags", cs: "Štítky", de: "Schlagwörter" }),
    body: f.richtext().localized().label({ en: "Text", cs: "Text", de: "Text" }),
    // A translatable group: each language has its own whole "where" note. Editors and proofreaders change it;
    // the curator (who only reads posts) does not see it at all, so it never tells them whether it is translated.
    location: f.group({
      fields: {
        place: f.text({ required: true }).label({ en: "Place", cs: "Místo", de: "Ort" }),
        note: f.text().label({ en: "Note", cs: "Poznámka", de: "Anmerkung" }),
      },
    }).optional().localized()
      .access({ read: ["editor", "author", roles.translator, roles.proofreader, roles.marketer], edit: ["editor", roles.proofreader] })
      .label({ en: "Location", cs: "Místo konání", de: "Veranstaltungsort" }),
    gallery: f.gallery().label({ en: "Photos", cs: "Fotky", de: "Fotos" })
      .help({ en: "Shown under the text, in this order.", cs: "Zobrazí se pod textem, v tomto pořadí.", de: "Wird in dieser Reihenfolge unter dem Text angezeigt." }),
    ...seo(),
  },
  // Who may do what comes from the built-in roles (admin, editor, author). An entity
  // can narrow it further with `access`, e.g. a row-level rule that is AND-ed in:
  //   access: { update: ({ user, table }) => eq(table.authorId, user.id) }
  // Here: authors read every post except the internal ones (a title starting with "Interní").
  // `user.base` is the built-in role a person has or a custom role extends: a role built on author is held to it too.
  access: { read: ({ user, table }) => (user.base === "author" ? not(ilike(table.title, "Interní%")) : true) },
  // First-class publish workflow: publish/unpublish toggles `status`, stamps
  // `publishedAt`, and the Preview button opens the draft at /blog/:slug?preview.
  publish: {
    field: "status",
    publishedValue: "published",
    draftValue: "draft",
    dateField: "publishedAt",
    preview: "/blog/:slug",
    // Each language publishes on its own: a translation can be a draft or scheduled while the
    // Czech post is live. Until one is set it follows Czech, so nothing changes by itself.
    // (The API tests build the playground a second time with CMS_TEST_NO_PER_LOCALE=1 to prove that.)
    perLocale: process.env.CMS_TEST_NO_PER_LOCALE !== "1",
  },
  // Headless delivery: only published posts, looked up by slug, with relations resolved.
  content: {
    public: true,
    published: (table) => eq(table.status, "published"),
    slug: "slug",
    path: "/blog/:slug",
    populate: ["hero", "author", "tags", "ogImage"],
  },
})

// Pages assembled from blocks (a ready-made preset: title, address, status, blocks,
// search & sharing, publishing and preview). Title, address and blocks are translatable.
export const Page = definePages({
  localized: true,
  // Pages under pages: /o-nas/tym in Czech, /en/pages/about/team in English.
  tree: true,
  // A row-level rule on top of the roles: authors do not see internal pages (address "interni…").
  access: { read: ({ user, table }) => (user.base === "author" ? not(ilike(table.slug, "interni%")) : true) },
  // The address differs per language: /o-nas in Czech, /en/pages/about in English.
  path: { cs: "/:slug", en: "/pages/:slug" },
  blocks: {
    hero: defineBlock({
      label: { en: "Hero", cs: "Úvod", de: "Einstieg" },
      description: { en: "A large heading with an image and a button.", cs: "Velký nadpis s obrázkem a tlačítkem.", de: "Eine große Überschrift mit Bild und Schaltfläche." },
      icon: "i-lucide-panel-top",
      fields: {
        heading: f.text({ required: true }).label({ en: "Heading", cs: "Nadpis", de: "Überschrift" }),
        lead: f.text().label({ en: "Lead", cs: "Perex", de: "Einleitung" }),
        image: f.media({ accept: "image/*" }).label({ en: "Image", cs: "Obrázek", de: "Bild" }),
        buttonLabel: f.text().label({ en: "Button text", cs: "Text tlačítka", de: "Text der Schaltfläche" }),
        buttonUrl: f.text({ format: "link" }).label({ en: "Button link", cs: "Odkaz tlačítka", de: "Link der Schaltfläche" }),
      },
    }),
    text: defineBlock({
      label: { en: "Text", cs: "Text", de: "Text" },
      description: { en: "Formatted text with an optional heading.", cs: "Formátovaný text s volitelným nadpisem.", de: "Formatierter Text mit optionaler Überschrift." },
      icon: "i-lucide-text",
      fields: {
        heading: f.text().label({ en: "Heading", cs: "Nadpis", de: "Überschrift" }),
        body: f.richtext().label({ en: "Text", cs: "Text", de: "Text" }),
      },
    }),
    image: defineBlock({
      label: { en: "Image", cs: "Obrázek", de: "Bild" },
      description: { en: "One image across the page, with a caption.", cs: "Jeden obrázek přes celou šířku s popiskem.", de: "Ein Bild über die volle Breite, mit Bildunterschrift." },
      icon: "i-lucide-image",
      fields: {
        image: f.media({ accept: "image/*" }).label({ en: "Image", cs: "Obrázek", de: "Bild" }),
        caption: f.text().label({ en: "Caption", cs: "Popisek", de: "Bildunterschrift" }),
      },
    }),
    cta: defineBlock({
      label: { en: "Call to action", cs: "Výzva k akci", de: "Handlungsaufforderung" },
      description: { en: "A short message with one button.", cs: "Krátké sdělení s jedním tlačítkem.", de: "Eine kurze Botschaft mit einer Schaltfläche." },
      icon: "i-lucide-mouse-pointer-click",
      // Version 2: a button is a label AND a link. Stored v1 blocks may hold a label
      // without a link or a link typed with spaces; `upgrade` tidies them when read
      // (`tinyzoo content:migrate` rewrites the stored copies). The shape is the same.
      version: 2,
      upgrade: (data, from) => {
        if (from !== 1) return data
        const link = typeof data.buttonUrl === "string" ? data.buttonUrl.trim() : ""
        const label = typeof data.buttonLabel === "string" ? data.buttonLabel.trim() : ""
        return { ...data, buttonUrl: link || null, buttonLabel: label || null }
      },
      fields: {
        text: f.text({ required: true }).label({ en: "Text", cs: "Text", de: "Text" }),
        buttonLabel: f.text().label({ en: "Button text", cs: "Text tlačítka", de: "Text der Schaltfläche" }),
        buttonUrl: f.text({ format: "link" }).label({ en: "Button link", cs: "Odkaz tlačítka", de: "Link der Schaltfläche" }),
        highlighted: f.boolean().label({ en: "Highlighted", cs: "Zvýrazněné", de: "Hervorgehoben" }),
      },
    }),
    // A block with a group inside: the group is a named object of fields.
    contact: defineBlock({
      label: { en: "Contact", cs: "Kontakt", de: "Kontakt" },
      description: { en: "A heading and an address.", cs: "Nadpis a adresa.", de: "Eine Überschrift und eine Adresse." },
      icon: "i-lucide-map-pin",
      fields: {
        heading: f.text().label({ en: "Heading", cs: "Nadpis", de: "Überschrift" }),
        address: f.group({
          fields: {
            street: f.text({ required: true }).label({ en: "Street", cs: "Ulice", de: "Straße" }),
            city: f.text().label({ en: "City", cs: "Město", de: "Stadt" }),
            photo: f.media({ accept: "image/*" }).label({ en: "Photo", cs: "Fotka", de: "Foto" }),
          },
        }).label({ en: "Address", cs: "Adresa", de: "Adresse" }),
      },
    }),
    // A block with a list inside: cards (services, team, advantages), each with a picture.
    cards: defineBlock({
      label: { en: "Cards", cs: "Karty", de: "Karten" },
      description: { en: "A heading and a few cards side by side.", cs: "Nadpis a několik karet vedle sebe.", de: "Eine Überschrift und mehrere Karten nebeneinander." },
      icon: "i-lucide-layout-grid",
      fields: {
        heading: f.text().label({ en: "Heading", cs: "Nadpis", de: "Überschrift" }),
        items: f.list({
          fields: {
            title: f.text({ required: true }).label({ en: "Title", cs: "Nadpis", de: "Titel" }),
            text: f.text({ multiline: true }).label({ en: "Text", cs: "Text", de: "Text" }),
            image: f.media({ accept: "image/*" }).label({ en: "Picture", cs: "Obrázek", de: "Bild" }),
          },
          max: 12,
          itemLabel: { en: "Card", cs: "Karta", de: "Karte" },
        }).label({ en: "Cards", cs: "Karty", de: "Karten" }),
      },
    }),
  },
})

// The site's menus (main + footer), each an ordered list of links, per language.
export const Navigation = defineNavigation({ localized: true })

// Old address → new address, applied by the server to every page request.
export const Redirect = defineRedirects()

// The admin's menu: the content in the order people reach for it, and what belongs to the website.
// What is not named here (the plugins' collections and settings) keeps its usual place.
export const menu = defineAdminMenu({
  groups: {
    content: [Post, Author, Tag],
    website: [Page, Navigation, SiteSettings, "@media"],
  },
})

// Plugins (forms here, and the example "events" plugin): each adds entities, admin pages,
// routes or upgrade steps under its own name. The cookie banner (consent) asks visitors, and
// lists the services behind a category; the analytics count everyone and, for those who allow
// statistics, also their consent id.
export const plugins = [
  formsPlugin(),
  eventsPlugin(),
  analyticsPlugin({ mode: "consent" }),
  consentPlugin({
    localized: true,
    services: {
      marketing: [{
        name: "YouTube",
        provider: "Google Ireland Limited",
        purpose: { en: "Plays the videos embedded in our pages.", cs: "Přehrává videa vložená do našich stránek.", de: "Spielt die in unsere Seiten eingebetteten Videos ab." },
        cookies: ["YSC", "VISITOR_INFO1_LIVE"],
        duration: { en: "Up to 6 months", cs: "Až 6 měsíců", de: "Bis zu 6 Monate" },
        privacyUrl: "https://policies.google.com/privacy",
      }],
    },
  }),
]

// A form on the website: each message lands here as an entry, and the people in
// Forms settings get an email. On a page: <CmsForm name="contactForm" />.
export const ContactForm = defineForm("contactForm", {
  label: { en: "Contact form", cs: "Kontaktní formulář", de: "Kontaktformular" },
  labelSingular: { en: "Message", cs: "Zpráva", de: "Nachricht" },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: "Your name", cs: "Vaše jméno", de: "Ihr Name" }),
    email: f.text({ required: true, format: "email" }).label({ en: "Email", cs: "E-mail", de: "E-Mail" }),
    topic: f.select({ options: ["question", "race", "other"] as const, labels: { question: { en: "A question", cs: "Dotaz", de: "Eine Frage" }, race: { en: "A race", cs: "Závod", de: "Ein Rennen" }, other: { en: "Something else", cs: "Něco jiného", de: "Etwas anderes" } } })
      .optional().label({ en: "Topic", cs: "Téma", de: "Thema" }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: "Message", cs: "Zpráva", de: "Nachricht" }),
    consent: f.boolean({ mustBeTrue: true }).label({ en: "I agree to the processing of my details", cs: "Souhlasím se zpracováním údajů", de: "Ich stimme der Verarbeitung meiner Daten zu" }),
  },
  successMessage: { en: "Thank you, we will reply soon.", cs: "Děkujeme, brzy se ozveme.", de: "Vielen Dank, wir melden uns bald." },
  // Messages are deleted after half a year (shown under the list; a daily task does it).
  retentionDays: 180,
})

// Who gets an email about new form messages (editable in the admin).
export const FormSettings = defineFormSettings()
