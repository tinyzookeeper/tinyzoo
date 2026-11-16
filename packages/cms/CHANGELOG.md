# tinyzoo

## 0.1.0

The first version, used on the first client site. What exists:

- **Code-first content model.** `defineEntity`, `defineSingleton`, `defineBlock` and the `f.*` field factories (text, rich text, numbers, dates, select, media, gallery, relations, lists, localized fields). One definition drives the database schema, validation, the content API and the admin, with no runtime schema editor.
- **Database.** Drizzle on Postgres. `tinyzoo generate` writes `server/db/schema.ts` and the migration, `tinyzoo up` applies it, and migrations can run at start (`NUXT_CMS_MIGRATIONS_ON_START`).
- **Admin.** An automatic `/admin` with lists (search, filters, bulk actions, manual order), forms with tabs and live preview, dashboard, media library, revisions with compare and restore, scheduled publishing, dark mode, and Czech, English and German interface languages.
- **Editing.** TipTap rich text with co-editing, presence and overwrite protection in the admin.
- **Accounts.** First-run setup, invitations, password reset, admin / editor / author roles, entity- and row-level access rules, API tokens and an audit log.
- **Pages and sites.** Pages with blocks, navigation, redirects, SEO, forms with submissions, several languages with an address per language, and globals.
- **Media.** Upload with a pluggable storage driver (local disk or S3-compatible), image previews and focal points.
- **Content API.** A public, read-only content API for the site's frontend, an OpenAPI 3.1 document, and generated TypeScript types for `@tinyzoo/client`.
- **CLI.** `tinyzoo generate`, `up`, `client`, `openapi` and `init` (a new website from the starter).
- **Runs on Node 22+** (Pushbase, Docker or any VM).
