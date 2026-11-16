// Type-level assertions for the inferred entity types. `tsc --noEmit` must pass.
// (Each @ts-expect-error must actually error, or tsc fails — so this verifies precision.)
import type { Insert, Row } from "tinyzoo"
import { Post, SiteSettings } from "./cms.config"

type PostRow = Row<typeof Post>
type PostInsert = Insert<typeof Post>

// ── Row: system cols + scalar cols + FK cols at their DB keys ──────────────────
const row: PostRow = {
  id: "u",
  title: "t",
  slug: "s",
  status: "draft", // enum union
  publishedAt: null, // nullable (optional field)
  heroId: null, // FK → `${key}Id`, nullable
  authorId: "a", // required FK
  body: { type: "doc" },
  gallery: [{ mediaId: "m", caption: "Cíl" }], // gallery: ordered files with captions
  location: { place: "Tábor", note: null }, // optional group: its fields typed, or null (the whole group may be null)
  metaTitle: null, // seo() preset: nullable text …
  metaDescription: null,
  ogImageId: null, // … and a nullable media FK
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null, // system columns: which CMS user created / last changed the row
  updatedBy: "u",
}
void row

// status is the precise union, not string
// @ts-expect-error 'nope' is not 'draft' | 'published'
const badStatus: PostRow = { ...row, status: "nope" }
void badStatus

// m2m / o2m own no column → not present on the row
// @ts-expect-error 'tags' is not a column on the row
const noTags: PostRow = { ...row, tags: [] }
void noTags

// ── Insert: required vs optional, API keys (author/tags, not authorId) ─────────
const okMinimal: PostInsert = {
  title: "t",
  slug: "s",
  author: "a", // required relation id
  body: { type: "doc" },
  // status, publishedAt, hero, tags all omittable (defaults / nullable)
}
void okMinimal

const okFull: PostInsert = {
  title: "t",
  slug: "s",
  author: "a",
  body: { type: "doc" },
  status: "published",
  tags: ["x", "y"],
  publishedAt: new Date(),
}
void okFull

// author is required
// @ts-expect-error missing required 'author'
const missingAuthor: PostInsert = { title: "t", slug: "s", body: { type: "doc" } }
void missingAuthor

// ── group: the whole object is typed, each field by its own kind ────────────────
type SettingsRow = Row<typeof SiteSettings>
const contact: SettingsRow["contact"] = { phone: "1", email: null, address: { street: "s", city: "c" }, photo: null }
void contact
// @ts-expect-error a group's field has its own type (city is text)
const badCity: SettingsRow["contact"] = { phone: "1", address: { street: "s", city: 3 } }
void badCity
// an optional group may be absent
const noContact: SettingsRow["contact"] = null
void noContact
