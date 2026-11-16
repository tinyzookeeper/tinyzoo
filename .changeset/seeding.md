---
'tinyzoo': minor
---

Seeding: `tinyzoo seed` puts the content a site starts with, written in `seed/index.ts` with `defineSeed`, into a running site.

```ts
export default defineSeed(async (s) => {
  const hero = await s.upload('seed/media/hero.jpg', { alt: 'The shop front' })
  const home = await s.upsert(Page, { title: 'Home', slug: 'home', status: 'published', sections: [] }, { translations: { en: { title: 'Home' } } })
  await s.global(Navigation, { main: [s.link('Home', home)], footer: [] })
})
```

The seed goes through the admin's own API with an administrator's session, so every write meets the rules an editor's save does (validation, translations, media sizes, the search index, saved versions) and it works against a deployed site. Running it twice changes nothing: an entry is recognised by a key field (the address field by default, or `by`), a file by its name, folder and size, and only a real difference is written. `s.create` leaves an existing entry as editors have it, `s.upsert` brings it up to the seed; `--dry-run` reports what would change, `--reset` first removes what the seed owns, and a site with no account yet gets its first administrator from `SEED_EMAIL` / `SEED_PASSWORD` (and `SEED_SETUP_CODE` in production). Typed from `cms.config.ts` when you pass the entity.

`tinyzoo init` now includes demo content for the starter (a small bakery in Czech and English, with pictures) and a `pnpm seed` script; its next steps mention it.

`defineSeed` and its types are exported from `tinyzoo`. Nothing in the content API, the typed client or the config changes.
