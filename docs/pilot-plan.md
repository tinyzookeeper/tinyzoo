# Pilot plan: tinyzoo ready for the first company project

**Goal:** bring the company a tinyzoo that a colleague can use to build a typical
client site (pages, news, contact form, cs/en, menus) without help, and that the
client's editors can run without calling us. The comparison the company makes is
"better than WordPress, and a better fit than October for a Vue/Nuxt team".

**Ready means:**

- A colleague goes from `pnpm create tinyzoo` to a deployed site with content using
  only the docs.
- Every task an editor does on a typical site works on desktop and phone, in light
  and dark, in Czech and English.
- The final audit (Track C) finds no High issues, and every Medium is
  fixed or written down as a known issue.

Sizes: **S** ≤ 1 day · **M** 2–4 days · **L** 1–2 weeks.

---

## Track 0: before anything else

| # | Item | Size |
|---|---|---|
| 0.1 | Finish and merge `feat/admin-redesign` (54 files in progress). Every UX fix below builds on it. | M |
| 0.2 | Pick the pilot client site and write down its content model, to check the features below against. | S |
| 0.3 | Unblock publishing and deploy: the GitHub org with a packages token, and the Pushbase token, bucket and SMTP account. Phase 6 waits on these too. | S (waiting on others) |

## Track A: features the pilot needs

### A1 Plugin API and the Forms plugin (L)

The plugin API is shaped by its first real user. Forms is the first plugin.

- **Plugin API (minimal):** `defineCmsPlugin({ entities, singletons, adminPages,
  navItems, fields, serverHooks, i18n })`, registered in `cms.config.ts`. A plugin
  ships as a package (`@tinyzoo/forms`) and adds tables through the normal
  `tinyzoo generate`.
- **Forms:** `defineForm('contact', { fields, notify, successMessage })` with the
  same `f.*` fields.
  - Submissions endpoint with Zod validation, honeypot, rate limit, and optional
    Turnstile.
  - Submissions list in the admin (read/unread, search, CSV export, delete).
  - Email notification to an address editors set in the admin, plus an
    auto-reply.
  - Typed `<CmsForm name="contact">` for the frontend.
- **Done when:** the pilot's contact form works end to end, and a second form
  (for example a race sign-up) needs no CMS change.

### A2 Field types (M)

- `f.list({ fields })`: a repeater for opening hours, team members, FAQ, price
  lists. Items can be reordered, are validated per item, can be `.localized()`,
  and are typed in the client.
- `f.group({ fields })`: a named group of fields stored together (address,
  contact).
- `f.file({ accept })`: PDFs and documents (price list, rules), with name, size,
  and a download link in the content API.
- `f.color()` and `f.json()`. Small, but they come up.

### A3 Menus and links (M)

- **Nested menus:** a menu item can have children (dropdowns), up to two levels,
  ordered by drag.
- **Link picker:** choose an internal page or entry, so you don't type a URL. The
  link follows the item when its address changes, in both languages. External
  URLs still work.
- **Page tree (should have):** pages with a parent, nested addresses
  (`/o-nas/tym`), and breadcrumbs in the content API.

### A4 Starter and frontend kit (L)

- `pnpm create tinyzoo`: a new Nuxt site with Pages, Navigation, Site settings,
  Contact form, News, cs/en, Postgres in `compose.yaml`, demo content, and
  `.env.example`.
- Frontend kit for the site:
  - `<CmsBlocks>` renders each block with the site's own component, by name.
  - `<CmsImage>` (focal point, sizes) and `<CmsRichText>`.
  - `<CmsNav>`, `<CmsForm>`, `useCmsSeo()` (meta, `hreflang`, OG image).
  - A language switcher that goes to the same item in the other language. Phase
    6 left this open, because items don't carry their other-language address.
- **Done when:** a new site renders its demo content with no hand wiring.

### A5 Developer experience (M)

- **Dev watch:** a change to `cms.config.ts` regenerates `schema.ts` and offers
  to generate and apply the migration, with a clear diff of what changes.
- **Seeds:** `tinyzoo seed` from a typed seed file, the way triatlon-tabor-web
  seeds through the API today.
- **Content export/import:** content plus media between environments
  (dev → staging → prod).
- **Error messages:** a wrong config fails at startup and names the field and the
  fix.
- Decide the Phase 6 leftover: should fields be optional unless `required`? The
  pilot is the last cheap moment to change it.
- A sitemap hook for a site's fixed pages (`/aktuality`).

### A6 Docs (M)

- Getting started: the starter, then the first entity, then deploy.
- Recipes for the ten most common client requests (contact form, news, team page,
  FAQ, opening hours, gallery, documents to download, partners, events, menus).
- "Coming from WordPress / October": how each familiar idea maps to tinyzoo.
- A CLAUDE.md / agent skill shipped with the package, so coding agents write
  correct `cms.config.ts`.

### A7 Operations (M, partly waiting on 0.3)

- Packages published, with versions and a changelog. An upgrade guide whenever
  `cms_*` tables change.
- The pilot deployed on Pushbase, with a documented backup and restore that has
  been tried once.
- Cost per site written down (hosting, bucket, mail), to compare with October
  hosting plus its licence.

### Later (not for the pilot)

Custom roles and per-field permissions (unless the pilot client needs them), Blog
preset, site search, multisite, dashboard widgets, CSV import into collections.

---

## Track B: UX/UI (from the baseline audit, 2026-11-15)

One audit run worked through 12 editor tasks in the playground at 1440 px and
390 px. It didn't get to dark mode, because the dev server stopped answering (see
B4).

### B1 Bugs

| # | Severity | Bug |
|---|---|---|
| 1 | High | An English URL address auto-fills only the first letter (`/en/blog/h`) |
| 2 | Medium | A long title widens the list table on desktop: status, author and the row menu scroll off-screen |
| 3 | Medium | A long title overflows the home "In progress" card on phone, and the welcome sentence prints it unclamped |
| 4 | Medium | A redirect to itself (`/a` → `/a`) is accepted |
| 5 | Medium | The publish review shows a green tick although a required field is empty; the error then sits in a closed side panel |
| 6 | Medium | Inserting an image in rich text replaces the selected text |
| 7 | Medium | An existing entry shows empty or raw values (UUIDs in author and tags, empty cover) for 2–3 s while loading |
| 8 | Medium | The page preview shows the browser's "refused to connect" frame when the site has no page there |
| 9 | Low | Deleting an item that's in use shows an English error that doesn't name what uses it |
| 10 | Low | The media library flashes "no files yet" while loading; a new folder appears only after a reload |
| 11 | Low | A stray grey scrollbar shows next to every entry title and the Filter button |
| 12 | Low | Hydration mismatch: the folded sidebar width comes from browser storage, so the server renders it wrong and it jumps |
| 13 | Low | The wrong-password message isn't announced (`role=alert`); the login card jumps when it appears |

### B2 UX/UI

| Area | Change |
|---|---|
| Rich text | An in-app link popover with a page/entry picker instead of the browser's `window.prompt`. Inline images ask for a description. |
| Editor details | Author, tags and address are truncated ("Jana Nov…", a hidden second tag): show tags as chips that wrap, and the full address |
| Blocks | Undo after "Remove" (toast), only the new block opens, drag handles for reordering |
| Navigation | A picker for existing pages and entries; nested items; menus editable per language |
| Dialogs | One dialog style: the safe answer is the primary button ("Stay", "Cancel"); delete names what uses the item |
| Editor actions | Duplicate, Delete and Open on website in the editor's "…" and in the list row menu |
| Scheduling | Defaults to 9:00; a scheduled entry's button says "Save changes", not "Update" |
| Translation | The default-language title isn't shown as the placeholder (it read as a value) |
| Filters | The calendar picker instead of native date inputs; SEO fields aren't offered as filters |
| Home and sidebar | Quick-create puts the main collection first; empty-site copy ("Everything is on the website.") fits an empty site |
| Account menu | "Design system" is for administrators only |
| Contrast | "Forgot password?" and the amber "Unsaved changes" pass AA |
| Dark mode | Check the default follows the system, then do a full pass (not audited yet) |

### B3 What works well (keep it)

The first-run setup, the publish review ("Almost done") with its translation
warning, the leave-without-saving dialog, the animal moments, History with diff
and restore-into-form, the language switcher hints, the media panel (alt per
language, focal point, "used in"), lists with filters in the address, the block
picker, and the editor top bar on phone.

### B4 Found by testing the test

- **The dev server dies when a WebSocket upgrade is reset before it answers**
  (`Restarting Nuxt due to error: read ECONNRESET`), and it can get stuck
  answering `426 Upgrade Required` to every request. A production build survives
  the same resets (checked 2026-11-15), so this is dev-only. All automated audits
  run against a production build.
- **Testability:**
  - Folded sidebar links have no accessible name.
  - Comboboxes are labelled "Show popup" (untranslated).
  - Links use `window.prompt`.
  - The editor shows "Loading editor…" for 1–3 s with no ready signal.
  - Hydration warnings flood the console.

  Fixing these helps real users too (screen readers).

---

## Track C: the final test, a parallel audit

Run twice: a **baseline** now (a single run, done 2026-11-15) and the **final
test** when Tracks A and B are done. The same scenarios both times give a
before/after comparison.

**Setup**

- Each area gets its own app instance and its own database (separate port, a DB
  created from the migrations plus a seed), so the runs never break each other's
  data.
- Each run drives a real browser at desktop (1440) and phone
  (390) widths, light and dark, in Czech and English.
- The rule for every run: report only what it saw, with steps, expected vs
  actual, a screenshot, and the console output.

**Areas, one run each**

1. Content editing: entries, rich text, relations, slugs, autosave and unsaved
   changes.
2. Publishing: drafts, preview, publish, schedule, history and restore.
3. Pages and blocks: add, reorder and remove blocks, live preview, menus with
   nesting, the link picker, redirects.
4. Media: upload, library, folders, alt text, focal point, where used, files and
   galleries.
5. Languages: translate, fallback, translated addresses, language switch on the
   site.
6. People: setup, sign-in, forgot/reset, invites, roles (an author can't publish),
   account.
7. Forms: build a form, submit on the site, spam, notifications, export.
8. Mobile and dark mode: every screen at 390 px and in dark, against
   `docs/ui-foundation.md`.
9. Mistakes and edge cases: empty required fields, very long text, double clicks,
   two tabs editing the same entry, deleting things that are in use, slow
   network.

**Then**

- A verify pass: a separate run reproduces each finding and drops the ones it
  can't reproduce.
- One report, sorted by severity: Bugs, UX/UI issues, Missing.
- Fix all Highs and Mediums, then re-run only the failed scenarios.
- The headline numbers go into the company presentation.

**Testability prerequisites** (from the baseline's testing notes): _see Track B._

---

## Track C results: second audit (2026-11-15)

Six audits ran in parallel. Each had its own production build, database and
headless browser (Playwright scripts). The areas were: editing and publishing, pages and menus (starter),
media and lists, languages and forms (starter), accounts with phone and dark mode,
and mistakes and edge cases. Brief: one shared file with the rules and report format,
plus a short area list per audit.

**Found and fixed**

| Severity | Finding | Fix |
|---|---|---|
| High | Removing an image from rich text deleted the file from the **media library** (orphan cleanup predates the library); History then lost it too | `cms_media.in_library`: files uploaded or edited in the library are never cleaned up automatically; existing files are marked kept by the migration; only files uploaded straight into a field still are |
| High | After an admin **changed someone's role**, that person got a 500 ("instance unavailable") on every admin page and was stuck | the session middleware also checks admin pages and drops the dead cookie; on the server the layout redirects to sign-in at once (no `await` before `navigateTo`) |
| Medium | "Unsaved changes" right after publishing (false leave warning) | the server's stamped publish date is applied quietly, not as an edit |
| Medium | A form sent within 2 s showed "Thank you" but was dropped, even when empty | validation first; the time trap only for valid posts under 1.5 s; `<CmsForm>` never sends that early |
| Medium | Phone: the starter's dropdown menu couldn't be reached, and the header didn't fold | menu button, sub-links listed under their parent on phones, a caret on desktop |
| Medium | The starter's "Send" button had no styling (Tailwind's reset beat zero-specificity defaults) | form defaults are one-class selectors in the base layer |
| Medium | Duplicating twice failed on the unique address | `-kopie`, `-kopie-2`, … until free |
| Medium | Export ignored the filters; technical CSV (raw values, commas, ISO dates) | same search, tab and filters as the list; labels, choice names, author names, local dates, `;` for Czech |
| Medium | Notification email: no reply address, anonymous subject | Reply-To = the visitor, "New message from Jana: …" |
| Medium | Media picker showed UUID file names; English and technical upload errors; empty or fake images accepted | names shown; one plain-language error helper (offline, permission, size, type, server); empty and unreadable images refused |
| Medium | English calendar in the list filters; brand colour accepted anything until save | admin locale, Monday first; colour tidied on leaving the field, hint inline |
| Medium | Removing a translation had no confirmation | confirm dialog |
| Medium | Phone list: the "In progress" cards overflowed | grid column `minmax(0, 1fr)` |
| Medium | An author saw settings they couldn't save, with an English 403 | unchangeable settings hidden; 403 explained in Czech |
| Medium | The playground's button-link fields accepted `javascript:` | `format: 'link'` (a config mistake; links in blocks were already validated) |
| Medium | Pasted values with a stray space were refused; titles saved with spaces | text fields trim before checking (multi-line excepted) |
| Low | Hydration mismatches | two real causes, found with the dev server: the home's site host (browser-only) and `localeCompare` sorting the animals differently in Czech browsers; the editor's sidebar now starts folded on the server |
| Low | 404 for the shared-editing session on every screen without rich text | not requested there |
| Low | Unknown admin address showed a blank editor; a redirect circle had the self-redirect wording; the bulk delete text was singular and named nothing; the undo toast was too long; "Add: Opening hours"; new form messages didn't stand out; amber text failed AA | each fixed |
| Low | Starter: `/home` duplicated `/`, an English-and-Nuxt 404, no news title, a "Draft preview" banner on published pages, misaligned text block | 301 to `/`, the site's own Czech/English error page, titles, banner only for drafts, aligned |

**Re-check:** one more run went through a 21-item checklist on fresh builds. 19 items
were fixed; 4 leftovers it found are now fixed too (`#red` colour, a deleted entry's
address opening a blank editor, the starter's menu button showing on desktop, an
English "file is empty").

**Left for later (reviewed, not blocking the pilot)**

- **Hydration ids in production builds.** Every `useId` gets a different prefix on
  the server (`v-0-0-15-…`) than in the browser (`v-0-0-0-…`): an async-boundary count
  differs above the pages. A debug build (`debug.hydration`) shows only ids, and Vue
  keeps the server's, so nothing looks wrong. Found with the debug build, not fixed.
  The real mismatches (site host, Czech sorting, the folded sidebar on phones) are
  fixed.

- The publish review shows "Fix" without listing errors in tabs that aren't open (works, could be clearer).
- Small phone tap targets (24–28 px toolbar and menu buttons).
- Combobox triggers announced as "Show popup" (inside reka-ui).
- The author role can't start a post in the playground (posts require an Author entry
  that authors can't create): a playground content-model choice, not a CMS bug.
- Czech addresses also answer under `/en` (fallback content without a canonical).
- Picked links are stored as addresses (renaming a page breaks menu links: redirects cover it for now).
- Preview of a page whose site has no route in the playground; inline images split a paragraph (block image node).

## Order

1. Track 0, then A2, A1, A3 (the content model the pilot needs).
2. A4 and A5 (the starter and DX), while Track B fixes land.
3. A6 and A7, then the pilot built by a colleague.
4. Track C final test, fixes, re-run, presentation.

### Build order for this round (2026-11-15, uncommitted, for review)

1. **B1 bugs and the testability fixes**, because every later screen depends on
   them.
2. **Links everywhere:** one picker for internal pages and entries, used by the
   rich-text link popover, navigation and link fields. Nested menus and
   per-language menus (B2, A3).
3. **Field types:** `f.list`, `f.group`, `f.file`, `f.color` (A2).
4. **Editor and list actions:** duplicate, delete, open on website, block undo
   and drag, dialogs, scheduling, filters (B2).
5. **Plugin API and Forms** (A1).
6. **Starter and frontend kit:** `create-tinyzoo`, `<CmsBlocks>`, `<CmsForm>`,
   `<CmsNav>`, `useCmsSeo` (A4).
7. **Second audit** (Track C) against a production build, then fixes.

Not in this round: A5 dev watch and content export/import, A6 docs site, A7
deploy (waiting on credentials), custom roles.

### Status after this round (2026-11-15, uncommitted)

| Item | State |
|---|---|
| B1 bugs 1–13 | Fixed. 12 and 13 (hydration, login jump) are fixed in code; the audit re-checks them. |
| Link picker | Built. `/api/cms/_links` + `CmsLinkPicker`, used by rich text (popover, no `window.prompt`), link/path fields, menus. Picked pages are stored as their address; links that follow a renamed page come later. |
| Rich text images | Inserted after the selection; the editor asks for a description when the file has none; "Image description" edits it later. |
| Required fields in the publish review | Listed first, block publishing, "Fix" opens the field. |
| Redirect loops | Refused on save (self, and circles through other redirects), 422 on `to`. |
| Delete in use | 409 names what uses it; Czech/English toast. |
| Loading states | Relations, media and shared text show placeholders, never raw ids or an empty cover. |
| Preview of a missing page | Explained in the panel instead of the browser's error frame. |
| A2 fields | `f.list` (items with ids, drag, undo, max), `f.file`, `f.color`. `f.group` later. |
| A3 menus | Menus are lists; "under the link above" makes dropdowns; `cmsMenuTree()` in the client; language switcher after the first save. Page tree later. |
| Editor and list actions | View on website, Duplicate, Delete… in the editor's "…" and in list rows; CSV export on every list. |
| Dialogs | Shared confirm dialog: when going ahead loses something, the safe answer is the strong button. |
| Scheduling, filters | Default time 9:00; "Save changes" on scheduled entries; date filters use the calendar and the admin's time zone (the old filter could shift a day); SEO pictures aren't offered as filters. |
| Home and sidebar | Quick-create leads with published content; empty-site copy; Design system for admins only; the folded sidebar keeps link names and its state in a cookie (no hydration jump). |
| A1 Forms | `defineForm` + `defineFormSettings` presets, `GET/POST /api/content/_form/:name`, `<CmsForm>`, spam protection (hidden field, minimum fill-in time, rate limit, Origin, optional Turnstile), email to the recipients set in the admin. A general plugin API comes later (forms is a first-party preset for now). |
| A4 starter and frontend kit | `packages/cms/starter` (typechecked in `pnpm typecheck`), `tinyzoo init <dir>`, `<CmsBlocks>`, `<CmsImage>`, `<CmsNav>`, `useCmsSeo`. A smoke test of the built starter passed 16/16 checks. Demo-content seeding comes later. |
| Tests | Unit 118 ✓ (new `fields-pilot.spec.ts`), API 225 ✓ (new `forms.spec.ts`, `pilot-fixes.spec.ts`; after the second audit's fixes). |
| Migrations | Playground `0013_site_settings_list_color_file`, `0014_contact_form`, `0015_media_in_library`; starter `0000_init`. Run `pnpm db:migrate` on your own dev database. |

## Open questions

- Which client site is the pilot?
- Does the pilot client need custom roles?
- Should fields be optional by default (A5)?
- npm or GitHub Packages for the packages? `production-plan.md` lists npm,
  Phase 6 says GitHub Packages.
