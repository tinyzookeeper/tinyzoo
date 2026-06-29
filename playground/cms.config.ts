import { defineEntity, defineSingleton, eq, f, seo } from "@my-cms/core"

// A single-row global: site-wide settings, editable under "Globals" in the admin
// and delivered headlessly at GET /api/content/_global/siteSettings.
export const SiteSettings = defineSingleton("siteSettings", {
  label: "Site settings",
  titleField: "siteName",
  fields: {
    siteName: f.text({ required: true }).help("Shown in the header and browser tab."),
    tagline: f.text().optional(),
    logo: f.media({ accept: "image/*" }).optional(),
    ...seo(),
  },
  content: { public: true, populate: ["logo", "ogImage"] },
})

export const Author = defineEntity("author", {
  label: "Authors",
  titleField: "name",
  admin: { list: { columns: ["name", "email"] } },
  fields: {
    name: f.text({ required: true }),
    email: f.text({ required: true, format: "email" }).unique()
      .help("Private — used for sign-in, never shown on the public site."),
    bio: f.richtext().optional().help("A short author biography."),
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
  label: "Tags",
  titleField: "name",
  admin: { list: { columns: ["name", "slug"] } },
  fields: {
    name: f.text({ required: true }),
    slug: f.slug({ from: "name", unique: true }),
  },
  // Reference data — every tag is public (no published filter).
  content: { public: true },
})

export const Post = defineEntity("post", {
  label: "Posts",
  titleField: "title",
  admin: {
    list: {
      columns: ["hero", "title", "status", "author", "publishedAt"],
      searchable: ["title"],
    },
  },
  fields: {
    title: f.text({ required: true }),
    slug: f.slug({ from: "title", unique: true })
      .help("Auto-generated from the title — edit to override."),
    status: f.select({
      options: ["draft", "published"] as const,
      default: "draft",
    }),
    publishedAt: f.datetime().optional().label("Publish date"),
    hero: f.media({ accept: "image/*" }).optional()
      .help("Shown at the top of the post and in listings."),
    author: f.relation({
      to: () => Author,
      kind: "many-to-one",
      required: true,
      onDelete: "restrict",
    }),
    tags: f.relation({ to: () => Tag, kind: "many-to-many" }),
    body: f.richtext().help("Use the toolbar to add headings, links, and images."),
    ...seo(),
  },
  access: {
    read: () => true,
    // `table` is the entity's own typed table — no need to reference Post here.
    update: ({ user, table }) =>
      user.role === "admin" || eq(table.authorId, user.id),
  },
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
