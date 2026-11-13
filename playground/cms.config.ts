import { defineEntity, defineSingleton, eq, f, seo } from "@my-cms/core"

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
  admin: { list: { columns: ["name", "email"] } },
  fields: {
    name: f.text({ required: true }).label({ en: "Name", cs: "Jméno" }),
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
    name: f.text({ required: true }).label({ en: "Name", cs: "Název" }),
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
  },
  fields: {
    title: f.text({ required: true }).label({ en: "Title", cs: "Název" }),
    slug: f.slug({ from: "title", unique: true })
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
    body: f.richtext()
      .label({ en: "Text", cs: "Text" })
      .help({ en: "Use the toolbar for headings, links and images.", cs: "Nadpisy, odkazy a obrázky přidáte z panelu nástrojů." }),
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
    populate: ["hero", "author", "tags", "ogImage"],
  },
})
