# Content between environments

`tinyzoo export` and `tinyzoo import` move a site's content from one environment to
another (production → staging, a laptop → a new server) as one file, and are the
way out when a migration goes wrong. Run them from the website's folder (where
`cms.config.ts` is). The database and the media storage (the local `.cms-uploads`
folder, or the S3 / R2 bucket) are found the way the running site finds them: the
environment (`DATABASE_URL`, `NUXT_CMS_STORAGE_*`), then the website's `.env`, then the
`cms:` options of `nuxt.config`.

```bash
tinyzoo export site.tar.gz                      # everything below
tinyzoo export site.tar.gz --only post,author   # just those entries (and the media they use)
tinyzoo export site.tar.gz --no-media           # media rows without the files (the target already has its own copy of them)

# on the other site, whose database is migrated and empty:
tinyzoo import site.tar.gz
tinyzoo import site.tar.gz --replace            # delete the content the archive covers first (asks, and says what; --yes skips the question)
tinyzoo import site.tar.gz --merge              # add and update entries by id, delete nothing
tinyzoo import site.tar.gz --dry-run            # check and report, write nothing
```

**What is in it.** Every collection's entries with their translations and
many-to-many links, the globals (settings, menus, home page), and the media library
with its files. Ids are kept, so links between entries and pictures in pages survive.
Left out on purpose, because people and their history belong to an environment (a
copy of production must not carry its accounts, invitation links or audit trail into
staging): accounts and tokens, sessions, the audit log, live-editing state, and the
search index (rebuilt from the content on import). Who created or last changed an
entry is dropped too (it points at accounts). Saved versions come with
`--with-revisions`; form submissions, which are personal data, with
`--with-submissions` — also when you name a form in `--only`, which is refused
without the flag. The file is created readable by its owner only (it holds your
content, and with the options above personal data).

**Media and buckets.** Every environment has its **own** bucket (or, with the local
driver, its own folder). Do not point staging at production's bucket to skip copying
the files: media files are shared by address, so deleting a picture in staging's admin
would delete production's. `--no-media` is only for a target that already has the
files (a copy of the bucket made by the storage provider, say). The archive records a
fingerprint (never the name) of the storage it was exported from, and `import` prints
a warning when the target writes to that very storage — the same folder on the same
machine, or the same endpoint and bucket.

**Export** reads everything in one `REPEATABLE READ` transaction, so the file is a
consistent snapshot while editors keep saving. Tables are read in pages and written
straight to disk, and media files one at a time: memory does not grow with the site.

**Import** refuses unless the target holds no content (`--replace` deletes what the
archive covers first, in the same transaction; `--merge` upserts by id and sets each
many-to-many field to the archive's list). `--replace` says before it asks what it
deletes. Of the media library, a full archive replaces **all** of it (the archive
brings the whole library back); an `--only` archive deletes just the media rows it lists
that nothing else uses (links, pictures in rich text and in blocks are checked, as the
server's own clean-up does) and updates the ones other content still uses in place:
a site logo or the pictures of pages that are not in the archive are never touched. It
checks the archive first:

- the archive format must be one this tinyzoo reads (a newer one asks you to upgrade);
- if the content model differs from the one the archive was exported from (the
  *fingerprint*: entity and field names, types, choices and block definitions), it
  lists every difference — entities and fields missing on either side, changed types,
  other choices, added or removed blocks, blocks (or list items) at a newer `version`
  than this site's definition — and stops. `--allow-mismatch` imports what
  fits and reports what it skipped. Another *default language* cannot be mapped and
  always stops. Blocks stored at an older version are brought up to date on import; a
  block stored at a *newer* one than this site knows is refused, because the site could
  neither read nor save it (update the site first);
- **each language's own publish state** (an entity with `publish.perLocale`) travels in the
  archive as `translations[].publish` (`{ "published": true, "publishedAt": "…" }`, or
  `"published": null` for a language that follows the default language), and the content model
  says which entities have it. An archive from a site without it, or from before 0.6, has none:
  `--merge` then leaves the states already in the target as they are, and a new translation
  follows the default language. An archive that carries the states into a site where that entity
  does not publish per language is a difference like any other (`--allow-mismatch` imports it, the
  languages follow the default language, and the import warns how many states it left out). A
  0.6 archive with such states cannot be imported into 0.5 faithfully: 0.5 does not know the key
  and drops the states without a word;
- media files are checked against their hashes, and uploaded to the target's storage;
  the media rows get that storage's public addresses, and pictures embedded in rich
  text are pointed at them;
- the archive is read with a cap on what it may unpack to (20 GiB; set
  `TINYZOO_MAX_ARCHIVE_BYTES` to change it), only plain files are written, and a path
  that leaves the folder is refused.

A **page tree** is checked as a whole once its pages are written, inside the same
transaction, with the rules the server applies to every edit: no page is its own ancestor,
nothing is deeper than `maxDepth`, and every page has an address of its own in each language.
The database does not enforce these, so an archive (or a `--merge` onto pages that are
already there) could break them. A tree that fails refuses the import, naming the pages,
and nothing is changed. With `--merge` only problems that involve a page of the archive
count, so an old problem in the target does not stop an unrelated import. (`--dry-run`
checks the archive's files and content model, not the tree.) No redirects are left for
addresses an import changes.

Rows are inserted in dependency order (media, then entries so that a post comes after
its author, then translations, links and saved versions). A link that cannot be
satisfied in any order — a page's parent, two entries pointing at each other — is
left empty first and filled in afterwards; a *required* link in a cycle cannot be
imported. All database changes are one transaction: a failure leaves the database as
it was (media files uploaded before it stay in storage, unreferenced). With
`--replace`, the media files of the old content also stay in storage: they may be
shared with another environment. Afterwards the search index is rebuilt; if that
fails the site rebuilds it on its next start, or run `nitro task run cms:search-reindex`.
The website's caches (CDN, pre-rendered pages) are not purged.

**The archive** is one `.tar.gz` (format 1), all JSON so it can be read without
tinyzoo:

```
manifest.json              format, tinyzoo version, exportedAt, fingerprint, the content
                           model (entities, fields, types, blocks), languages, what is
                           inside (rows per entity), what was left out
content/<entity>.jsonl     one entry per line
globals/<name>.json        the one row of a global
media.jsonl                the media library's rows
media/<storage key>        the files
revisions.jsonl            only with --with-revisions
```

An entry is keyed by field names, not columns:

```json
{ "id": "…", "createdAt": "…", "updatedAt": "…",
  "fields": { "title": "První", "author": "<id>", "hero": "<media id>", "body": { "type": "doc" } },
  "translations": [{ "id": "…", "locale": "en", "createdAt": "…", "updatedAt": "…", "fields": { "title": "First" },
                     "publish": { "published": true, "publishedAt": "…" } }],
  "relations": { "tags": ["<id>", "<id>"] } }
```

This is not `tinyzoo backup` (a raw database dump of everything, accounts included,
for the same version): the archive is for content, across versions of the site that
still agree on the content model. Block and list JSON is written as it was exported;
import brings older ones up to date (see above).
