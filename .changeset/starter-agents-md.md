---
'tinyzoo': minor
---

Every new site has an `AGENTS.md`: a short guide for the coding assistant a developer works with. It says where the content model is and that it is code-first, the field types and options, the change workflow (`db:generate`, review the migration, `db:migrate`, `cms:client`; `tinyzoo upgrade` after updating), roles and `.access()`, `publish.perLocale`, the typed client and the frontend kit, what 1.0 freezes and what is `@internal`, and what not to do (`drizzle-kit push`, editing generated files, importing internals). `tinyzoo init` and `pnpm create tinyzoo` copy it with the rest of the starter. The repository also has an `llms.txt` that indexes the docs.

### Upgrade

Nothing is required. To give an existing site the same guide, copy `AGENTS.md` from the starter (`node_modules/tinyzoo/starter/AGENTS.md` after updating) into the site's root, and add your own project's notes to it.
