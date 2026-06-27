import { defineEntity, eq, f } from "@my-cms/core"

export const Author = defineEntity("author", {
  label: "Authors",
  titleField: "name",
  admin: { list: { columns: ["name", "email"] } },
  fields: {
    name: f.text({ required: true }),
    email: f.text({ required: true, format: "email" }).unique(),
    bio: f.richtext().optional(),
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
    slug: f.slug({ from: "title", unique: true }),
    status: f.select({
      options: ["draft", "published"] as const,
      default: "draft",
    }),
    publishedAt: f.datetime().optional(),
    hero: f.media({ accept: "image/*" }).optional(),
    author: f.relation({
      to: () => Author,
      kind: "many-to-one",
      required: true,
      onDelete: "restrict",
    }),
    tags: f.relation({ to: () => Tag, kind: "many-to-many" }),
    body: f.richtext(),
  },
  access: {
    read: () => true,
    // `table` is the entity's own typed table — no need to reference Post here.
    update: ({ user, table }) =>
      user.role === "admin" || eq(table.authorId, user.id),
  },
  // Headless delivery: only published posts, looked up by slug, with relations resolved.
  content: {
    public: true,
    published: (table) => eq(table.status, "published"),
    slug: "slug",
    populate: ["hero", "author", "tags"],
  },
})
