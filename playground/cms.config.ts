import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, ilike, not, seo } from "tinyzoo"
import { defineForm, defineFormSettings, formsPlugin } from "tinyzoo/forms"
import { eventsPlugin } from "./cms-plugins/events"

// Content languages: Czech is the default (each entry's own row), English is a
// translation of the fields marked .localized(), falling back to Czech when missing.
export const locales = defineLocales({ default: "cs", locales: ["cs", "en"] })

// A single-row global: site-wide settings, editable under "Globals" in the admin
// and delivered headlessly at GET /api/content/_global/siteSettings.
export const SiteSettings = defineSingleton("siteSettings", {
  label: { en: "Site settings", cs: "Nastavení webu" },
  description: { en: "The site name, tagline and logo used across the whole website.", cs: "Název webu, slogan a logo, které se používají na celém webu." },
  icon: "i-lucide-settings-2",
  titleField: "siteName",
  fields: {
    siteName: f.text({ required: true })
      .label({ en: "Site name", cs: "Název webu" })
      .help({ en: "Shown in the header and browser tab.", cs: "Zobrazí se v hlavičce webu a v záložce prohlížeče." }),
    tagline: f.text().optional().label({ en: "Tagline", cs: "Slogan" }),
    logo: f.media({ accept: "image/*" }).optional().label({ en: "Logo", cs: "Logo" }),
    brandColor: f.color().optional().label({ en: "Brand colour", cs: "Barva značky" }),
    openingHours: f.list({
      fields: {
        days: f.text({ required: true }).label({ en: "Days", cs: "Dny" }),
        hours: f.text().label({ en: "Hours", cs: "Hodiny" }),
      },
      max: 14,
      itemLabel: { en: "Opening hours", cs: "Otevírací doba" },
    }).label({ en: "Opening hours", cs: "Otevírací doba" }),
    rules: f.file().optional().label({ en: "Rules (PDF)", cs: "Pravidla (PDF)" }),
    // A group: the address and contact kept together (one column, one object in the API).
    contact: f.group({
      fields: {
        phone: f.text().label({ en: "Phone", cs: "Telefon" }),
        email: f.text({ format: "email" }).optional().label({ en: "Email", cs: "E-mail" }),
        address: f.group({
          fields: {
            street: f.text({ required: true }).label({ en: "Street", cs: "Ulice" }),
            city: f.text({ required: true }).label({ en: "City", cs: "Město" }),
            zip: f.text().label({ en: "Postcode", cs: "PSČ" }),
          },
        }).label({ en: "Address", cs: "Adresa" }),
        photo: f.media({ accept: "image/*" }).optional().label({ en: "Photo of the entrance", cs: "Fotka vchodu" }),
      },
    }).optional().label({ en: "Contact", cs: "Kontakt" }),
    ...seo(),
  },
  content: { public: true, populate: ["logo", "rules", "ogImage"] },
})

export const Author = defineEntity("author", {
  label: { en: "Authors", cs: "Autoři" },
  labelSingular: { en: "Author", cs: "Autor" },
  description: { en: "People who write for the blog. Their name and bio appear with each post.", cs: "Lidé, kteří píšou na blog. Jméno a medailonek se zobrazí u každého článku." },
  icon: "i-lucide-users",
  titleField: "name",
  // Arranged by hand (drag in the list): the website lists authors in this order.
  admin: { list: { columns: ["name", "email"], orderField: "position" } },
  fields: {
    name: f.text({ required: true }).label({ en: "Name", cs: "Jméno" }),
    position: f.number().optional().label({ en: "Position", cs: "Pořadí" }),
    email: f.text({ required: true, format: "email" }).unique()
      .label({ en: "Email", cs: "E-mail" })
      .help({ en: "Private — never shown on the website.", cs: "Soukromé — na webu se nikdy nezobrazí." }),
    bio: f.richtext().optional()
      .label({ en: "Bio", cs: "Medailonek" })
      .help({ en: "A few sentences about the author.", cs: "Pár vět o autorovi." }),
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
  label: { en: "Tags", cs: "Štítky" },
  labelSingular: { en: "Tag", cs: "Štítek" },
  description: { en: "Topics that group related posts together.", cs: "Témata, která seskupují související články." },
  icon: "i-lucide-tag",
  titleField: "name",
  admin: { list: { columns: ["name", "slug"] } },
  fields: {
    name: f.text({ required: true }).localized().label({ en: "Name", cs: "Název" }),
    slug: f.slug({ from: "name", unique: true }).label({ en: "URL address", cs: "Adresa (URL)" }),
  },
  // Reference data — every tag is public (no published filter).
  content: { public: true },
})

export const Post = defineEntity("post", {
  label: { en: "Posts", cs: "Články" },
  labelSingular: { en: "Post", cs: "Článek" },
  description: { en: "Articles on the blog. Drafts stay private until you publish them.", cs: "Články na blogu. Koncepty zůstávají soukromé, dokud je nezveřejníte." },
  icon: "i-lucide-newspaper",
  titleField: "title",
  admin: {
    list: {
      columns: ["hero", "title", "status", "author", "publishedAt"],
      searchable: ["title"],
    },
    // The form's main column in two tabs: the text first, the main image beside it.
    tabs: [
      { label: { en: "Text", cs: "Text" }, fields: ["body"] },
      { label: { en: "Images", cs: "Obrázky" }, fields: ["hero", "gallery"] },
    ],
  },
  fields: {
    title: f.text({ required: true }).localized().label({ en: "Title", cs: "Název" }),
    slug: f.slug({ from: "title", unique: true }).localized()
      .label({ en: "URL address", cs: "Adresa (URL)" })
      .help({ en: "Filled in from the title — change it if you like.", cs: "Vyplní se podle názvu — můžete ji změnit." }),
    status: f.select({
      options: ["draft", "published"] as const,
      default: "draft",
      labels: { draft: { en: "Draft", cs: "Koncept" }, published: { en: "Published", cs: "Zveřejněno" } },
    }).label({ en: "Status", cs: "Stav" }),
    publishedAt: f.datetime().optional().label({ en: "Publish date", cs: "Datum zveřejnění" }),
    hero: f.media({ accept: "image/*" }).optional()
      .label({ en: "Main image", cs: "Hlavní obrázek" })
      .help({ en: "Shown at the top of the post and in listings.", cs: "Zobrazí se nahoře v článku a v přehledu článků." }),
    author: f.relation({
      to: () => Author,
      kind: "many-to-one",
      required: true,
      onDelete: "restrict",
    }).label({ en: "Author", cs: "Autor" }),
    tags: f.relation({ to: () => Tag, kind: "many-to-many" }).label({ en: "Tags", cs: "Štítky" }),
    body: f.richtext().localized().label({ en: "Text", cs: "Text" }),
    // A translatable group: each language has its own whole "where" note.
    location: f.group({
      fields: {
        place: f.text({ required: true }).label({ en: "Place", cs: "Místo" }),
        note: f.text().label({ en: "Note", cs: "Poznámka" }),
      },
    }).optional().localized().label({ en: "Location", cs: "Místo konání" }),
    gallery: f.gallery().label({ en: "Photos", cs: "Fotky" })
      .help({ en: "Shown under the text, in this order.", cs: "Zobrazí se pod textem, v tomto pořadí." }),
    ...seo(),
  },
  // Who may do what comes from the built-in roles (admin, editor, author). An entity
  // can narrow it further with `access`, e.g. a row-level rule that is AND-ed in:
  //   access: { update: ({ user, table }) => eq(table.authorId, user.id) }
  // First-class publish workflow: publish/unpublish toggles `status`, stamps
  // `publishedAt`, and the Preview button opens the draft at /blog/:slug?preview.
  publish: {
    field: "status",
    publishedValue: "published",
    draftValue: "draft",
    dateField: "publishedAt",
    preview: "/blog/:slug",
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
  access: { read: ({ user, table }) => (user.role === "author" ? not(ilike(table.slug, "interni%")) : true) },
  // The address differs per language: /o-nas in Czech, /en/pages/about in English.
  path: { cs: "/:slug", en: "/pages/:slug" },
  blocks: {
    hero: defineBlock({
      label: { en: "Hero", cs: "Úvod" },
      description: { en: "A large heading with an image and a button.", cs: "Velký nadpis s obrázkem a tlačítkem." },
      icon: "i-lucide-panel-top",
      fields: {
        heading: f.text({ required: true }).label({ en: "Heading", cs: "Nadpis" }),
        lead: f.text().label({ en: "Lead", cs: "Perex" }),
        image: f.media({ accept: "image/*" }).label({ en: "Image", cs: "Obrázek" }),
        buttonLabel: f.text().label({ en: "Button text", cs: "Text tlačítka" }),
        buttonUrl: f.text({ format: "link" }).label({ en: "Button link", cs: "Odkaz tlačítka" }),
      },
    }),
    text: defineBlock({
      label: { en: "Text", cs: "Text" },
      description: { en: "Formatted text with an optional heading.", cs: "Formátovaný text s volitelným nadpisem." },
      icon: "i-lucide-text",
      fields: {
        heading: f.text().label({ en: "Heading", cs: "Nadpis" }),
        body: f.richtext().label({ en: "Text", cs: "Text" }),
      },
    }),
    image: defineBlock({
      label: { en: "Image", cs: "Obrázek" },
      description: { en: "One image across the page, with a caption.", cs: "Jeden obrázek přes celou šířku s popiskem." },
      icon: "i-lucide-image",
      fields: {
        image: f.media({ accept: "image/*" }).label({ en: "Image", cs: "Obrázek" }),
        caption: f.text().label({ en: "Caption", cs: "Popisek" }),
      },
    }),
    cta: defineBlock({
      label: { en: "Call to action", cs: "Výzva k akci" },
      description: { en: "A short message with one button.", cs: "Krátké sdělení s jedním tlačítkem." },
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
        text: f.text({ required: true }).label({ en: "Text", cs: "Text" }),
        buttonLabel: f.text().label({ en: "Button text", cs: "Text tlačítka" }),
        buttonUrl: f.text({ format: "link" }).label({ en: "Button link", cs: "Odkaz tlačítka" }),
        highlighted: f.boolean().label({ en: "Highlighted", cs: "Zvýrazněné" }),
      },
    }),
    // A block with a group inside: the group is a named object of fields.
    contact: defineBlock({
      label: { en: "Contact", cs: "Kontakt" },
      description: { en: "A heading and an address.", cs: "Nadpis a adresa." },
      icon: "i-lucide-map-pin",
      fields: {
        heading: f.text().label({ en: "Heading", cs: "Nadpis" }),
        address: f.group({
          fields: {
            street: f.text({ required: true }).label({ en: "Street", cs: "Ulice" }),
            city: f.text().label({ en: "City", cs: "Město" }),
            photo: f.media({ accept: "image/*" }).label({ en: "Photo", cs: "Fotka" }),
          },
        }).label({ en: "Address", cs: "Adresa" }),
      },
    }),
    // A block with a list inside: cards (services, team, advantages), each with a picture.
    cards: defineBlock({
      label: { en: "Cards", cs: "Karty" },
      description: { en: "A heading and a few cards side by side.", cs: "Nadpis a několik karet vedle sebe." },
      icon: "i-lucide-layout-grid",
      fields: {
        heading: f.text().label({ en: "Heading", cs: "Nadpis" }),
        items: f.list({
          fields: {
            title: f.text({ required: true }).label({ en: "Title", cs: "Nadpis" }),
            text: f.text({ multiline: true }).label({ en: "Text", cs: "Text" }),
            image: f.media({ accept: "image/*" }).label({ en: "Picture", cs: "Obrázek" }),
          },
          max: 12,
          itemLabel: { en: "Card", cs: "Karta" },
        }).label({ en: "Cards", cs: "Karty" }),
      },
    }),
  },
})

// The site's menus (main + footer), each an ordered list of links, per language.
export const Navigation = defineNavigation({ localized: true })

// Old address → new address, applied by the server to every page request.
export const Redirect = defineRedirects()

// Plugins (forms here, and the example "events" plugin): each adds entities, admin pages,
// routes or upgrade steps under its own name.
export const plugins = [formsPlugin(), eventsPlugin()]

// A form on the website: each message lands here as an entry, and the people in
// Forms settings get an email. On a page: <CmsForm name="contactForm" />.
export const ContactForm = defineForm("contactForm", {
  label: { en: "Contact form", cs: "Kontaktní formulář" },
  labelSingular: { en: "Message", cs: "Zpráva" },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: "Your name", cs: "Vaše jméno" }),
    email: f.text({ required: true, format: "email" }).label({ en: "Email", cs: "E-mail" }),
    topic: f.select({ options: ["question", "race", "other"] as const, labels: { question: { en: "A question", cs: "Dotaz" }, race: { en: "A race", cs: "Závod" }, other: { en: "Something else", cs: "Něco jiného" } } })
      .optional().label({ en: "Topic", cs: "Téma" }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: "Message", cs: "Zpráva" }),
    consent: f.boolean().label({ en: "I agree to the processing of my details", cs: "Souhlasím se zpracováním údajů" }),
  },
  successMessage: { en: "Thank you, we will reply soon.", cs: "Děkujeme, brzy se ozveme." },
  // Messages are deleted after half a year (shown under the list; a daily task does it).
  retentionDays: 180,
})

// Who gets an email about new form messages (editable in the admin).
export const FormSettings = defineFormSettings()
