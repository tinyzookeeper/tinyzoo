import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineSingleton, eq, f, seo } from "@my-cms/core"

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
    ...seo(),
  },
  content: { public: true, populate: ["logo", "ogImage"] },
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
        buttonUrl: f.text().label({ en: "Button link", cs: "Odkaz tlačítka" }),
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
      fields: {
        text: f.text({ required: true }).label({ en: "Text", cs: "Text" }),
        buttonLabel: f.text().label({ en: "Button text", cs: "Text tlačítka" }),
        buttonUrl: f.text().label({ en: "Button link", cs: "Odkaz tlačítka" }),
        highlighted: f.boolean().label({ en: "Highlighted", cs: "Zvýrazněné" }),
      },
    }),
  },
})

// The site's menus (main + footer), each an ordered list of links, per language.
export const Navigation = defineNavigation({ localized: true })

// Old address → new address, applied by the server to every page request.
export const Redirect = defineRedirects()
