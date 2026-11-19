# Seeding: content a site starts with

`seed/index.ts` holds the content a new site starts with: demo pages, the first menus and its settings. You write it in code, and `tinyzoo seed` puts it into a running site.

The starter has one seed, a small bakery in Czech and English, with pictures. With `pnpm dev` running, seed it like this:

```bash
SEED_EMAIL=you@example.com SEED_PASSWORD='a long password' pnpm seed
```

On a site with no administrator yet, the command creates the first one with these details. Otherwise it signs in as that administrator.

A deployed site asks for its setup code first. Pass it as `SEED_SETUP_CODE`, or as `--setup-code`. The server's log prints the code. Prefer the variable, because `--setup-code` shows in the process list while the command runs.

## Writing a seed

```ts
// seed/index.ts
import { defineSeed } from 'tinyzoo'
import { Author, Navigation, Page, Post, SiteSettings } from '../cms.config'

export default defineSeed(async (s) => {
  const hero = await s.upload('seed/media/hero.jpg', { alt: 'The shop front', altLocales: { en: 'The shop front' } })

  const jana = await s.create(Author, { name: 'Jana', email: 'jana@example.com' }, { by: 'email' })
  const home = await s.upsert(Page, {
    title: 'Úvod', slug: 'home', status: 'published',
    sections: [{ type: 'hero', heading: 'Vítejte', text: '…', image: hero, buttonLabel: '', buttonUrl: '/' }],
  }, { translations: { en: { title: 'Home', sections: [/* … */] } } })
  await s.create(Post, { title: 'První', slug: 'prvni', author: jana.id, body: s.rich.doc(s.rich.p('Text.')) })

  await s.global(Navigation, { main: [s.link('Úvod', home), s.link('Blog', '/blog')], footer: [] })
  await s.global(SiteSettings, { siteName: 'Můj web', logo: hero })
})
```

Each call is a method on `s`:

| In the seed | What it does |
|---|---|
| `s.create(Entity, data, { by?, translations? })` | makes the entry when nothing has its key yet; otherwise leaves it **exactly as it is** (editors' changes stay) |
| `s.upsert(Entity, data, { by?, translations? })` | makes it, or brings an existing one up to the seed (only the fields you give) |
| `s.translate(entry, 'en', data)` | one language of an entry or global (only the `.localized()` fields); follows `create` / `upsert` |
| `s.global(Entity, data, { translations?, ifMissing? })` | saves a global (settings, menus) whole; `ifMissing` leaves a saved one alone |
| `s.upload(file, { alt, altLocales, focal, folder, name })` | a file from disk into the media library; returns its id |
| `s.link(label, '/address' \| entry, { locale?, newTab?, sub? })` | a menu link; for an entry (a page the website links to) it stores a reference, so the menu follows the page when it is renamed or moved |
| `s.rich.doc / p / h2 / ul / quote / bold / link / image` | rich-text builders |

- **Typed from `cms.config.ts`.** Pass the entity (`s.create(Post, …)`) and a wrong field, a missing required one or a wrong choice is a type error. A name (`s.create('post', …)`) works too, without the types.
- **Relations take the id a call returned** (`author: jana.id`).
- **A seed that goes through `s.upsert`** can be changed and run again to update a live site's pages.

## Running it

```bash
tinyzoo seed                      # seed/index.ts, http://localhost:3000, $SEED_EMAIL / $SEED_PASSWORD (or --url / $SEED_URL)
tinyzoo seed other.ts --url https://demo.example.com --email you@example.com
tinyzoo seed --dry-run            # sign in, read, say what would be created, changed, uploaded; write nothing
tinyzoo seed --reset              # first remove what this seed made (found by key and file name), then seed again
tinyzoo seed --verbose            # also list what was already up to date
```

- Without `--url` or `SEED_URL`, the command talks to `http://localhost:3000`.
- The password is only ever read from `SEED_PASSWORD`.

**Which site?** The command talks to `http://localhost:3000` whatever answers there. `nuxt dev` moves to another port when 3000 is taken, and says so when it starts. Give the address it printed. Otherwise you would sign in to some other project. With an empty database you would even create that project's first administrator.

## Details

### Running it twice changes nothing

An entry is recognised by its **key**.

- The key is `by`. It defaults to the entity's address field (`content.slug`, else its only `f.slug()`).
- An entity without one needs `by: 'email'` (or several fields).
- A file is recognised by its name, folder and size.

Before an update, the stored values are read and compared with the seed's. Only a real difference is written. So a second run makes no save, no new saved version and no upload.

- A decimal (`f.number({ int: false })`) is compared by its value. The site gives `2.5` back as `"2.50"`, and that is no difference. Write it as a number or as a numeric string, either works.
- A file's folder (`folder`) is one level, as in the media library. A name with `/` or `\`, doubled spaces or spaces at the ends stops the seed with an error. The site would file it under another name, and the next run would not find the file there.

Blocks and list items need no `id`, and no `type` when there is one. That holds for a list inside a group too. The runner makes stable ids, so the same seed gives the same ones every time.

Write dates as fixed values (`'2026-03-01T09:00:00Z'`), not "now".

### Fields you leave out

- `s.upsert` leaves a field you leave out alone. It cannot clear a field. Give `null` to clear one.
- A global is saved whole, so give every required field.

### Links to your own pages

Write references, not typed addresses. A button or link field that leads to a page the seed made should hold what the admin's link picker stores: `cms:page/<id>`. A reference follows the page when it is renamed or moved, and gives each language its own address.

- In a menu, `s.link(label, entry)` does this.
- In a block or field, write the same with `s.link('', entry).url`.

A typed address (`buttonUrl: '/kontakt'`) works, but `s.upsert` then compares it with what is stored:

1. After `tinyzoo links:convert`, or after an editor picks the page in the picker, the stored value is a reference.
2. The seed sees a difference.
3. The next run writes the typed address back over the reference.

Pages the website draws itself (`/aktuality`, `/hledat`) are not entries and stay typed.

`s.create` never touches an entry that exists. For content editors own from the start, it avoids the question altogether. The starter's seed uses references.

### `--reset`

`--reset` removes only what the seed made.

- An entry found by its key counts only when the account the seed signs in with created it. A page an editor made with the same address stays. So does an entry somebody else changed after `s.create` left it alone.
- The seed's files go too, unless something still uses them, such as a global's logo. That file stays and is found again.
- Globals are not removed, because the seed overwrites them.

The command lists every entry and file by name first and asks. `--yes` skips the question, and is needed without a terminal.

Menus and settings the seed writes first lose their links to the pages that go. The seed writes them again afterwards. Entries are removed in an order the site accepts.

If a delete would still be refused, because a page the seed did not make links to one of its pages, the command says which and stops before removing anything.

### Why it goes over HTTP

The seed goes through the admin's own API, with an administrator's session. Every write meets the rules an editor's save does:

- validation
- translations
- the media pipeline (sizes, the library)
- the search index
- saved versions
- webhooks
- access

So a seeded site cannot differ from one an editor filled in. It also works against a deployed site, where the database is not reachable from your laptop.

The cost is that the site has to be running, and sign-in limits apply. You get ten tries per address per fifteen minutes. Uploads wait when the minute's limit of 60 is reached.
