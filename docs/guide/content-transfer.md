# Content between environments

`tinyzoo export` and `tinyzoo import` move a site's content from one environment to another as one file. Use them for production → staging or a laptop → a new server. They are also the way out when a migration goes wrong.

Run them from the website's folder, where `cms.config.ts` is. The database and the media storage are found the way the running site finds them. The media storage is the local `.cms-uploads` folder, or the S3 / R2 bucket. The lookup order is:

1. the environment (`DATABASE_URL`, `NUXT_CMS_STORAGE_*`)
2. the website's `.env`
3. the `cms:` options of `nuxt.config`

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

The common case is a full export, then an import into a site whose database is migrated and empty.

## What is in the archive

- Every collection's entries, with their translations and many-to-many links.
- The globals (settings, menus, home page).
- The media library, with its files.

Ids are kept, so links between entries and pictures in pages survive.

### Left out on purpose

People and their history belong to an environment. A copy of production must not carry its accounts, invitation links or audit trail into staging. So the archive leaves out:

- accounts and tokens
- sessions
- the audit log
- live-editing state
- the search index (rebuilt from the content on import)
- who created or last changed an entry, because it points at accounts

Two kinds of data come only with a flag:

- Saved versions come with `--with-revisions`.
- Form submissions are personal data. They come with `--with-submissions`. The flag is needed also when you name a form in `--only`, which is refused without it.

The file is created readable by its owner only. It holds your content, and with these options personal data.

## Media and buckets

Every environment has its **own** bucket (or, with the local driver, its own folder).

Do not point staging at production's bucket to skip copying the files. Media files are shared by address, so deleting a picture in staging's admin would delete production's.

`--no-media` is only for a target that already has the files, such as a copy of the bucket made by the storage provider.

The archive records a fingerprint of the storage it was exported from, never the name. `import` prints a warning when the target writes to that very storage: the same folder on the same machine, or the same endpoint and bucket.

## Export

Export reads everything in one `REPEATABLE READ` transaction, so the file is a consistent snapshot while editors keep saving. Tables are read in pages and written straight to disk, and media files one at a time. Memory does not grow with the site.

## Import

Import refuses unless the target holds no content. Two flags change that:

- `--replace` deletes what the archive covers first, in the same transaction. It says what it deletes before it asks.
- `--merge` upserts by id and sets each many-to-many field to the archive's list.

### What happens to the media library

- A full archive replaces **all** of the library. The archive brings the whole library back.
- An `--only` archive deletes just the media rows it lists that nothing else uses. Links, and pictures in rich text and in blocks, are checked, as the server's own clean-up does.
- An `--only` archive updates in place the rows that other content still uses.

So a site logo, or the pictures of pages that are not in the archive, are never touched.

### What import checks first

- The archive format must be one this tinyzoo reads. A newer one asks you to upgrade.
- The content model must match. If it differs from the one the archive was exported from, import lists every difference and stops. The comparison is the *fingerprint*: entity and field names, types, choices and block definitions. See [content model differences](#content-model-differences).
- **Each language's own publish state** travels in the archive. See [publish state per language](#publish-state-per-language).
- Media files are checked against their hashes, and uploaded to the target's storage. The media rows get that storage's public addresses, and pictures embedded in rich text are pointed at them.
- The archive is read with a cap on what it may unpack to: 20 GiB. Set `TINYZOO_MAX_ARCHIVE_BYTES` to change it. Only plain files are written, and a path that leaves the folder is refused.

#### Content model differences

Import lists these differences and stops:

- entities and fields missing on either side
- changed types
- other choices
- added or removed blocks
- blocks (or list items) at a newer `version` than this site's definition

`--allow-mismatch` imports what fits and reports what it skipped.

Another *default language* cannot be mapped and always stops.

Blocks stored at an older version are brought up to date on import. A block stored at a *newer* one than this site knows is refused, because the site could neither read nor save it. Update the site first.

#### Publish state per language

An entity with `publish.perLocale` has a publish state for each language. It travels in the archive as `translations[].publish`: `{ "published": true, "publishedAt": "…" }`. A language that follows the default language has `"published": null`. The content model says which entities have per-language states.

- An archive from a site without per-language states, or from before 0.6, has none. `--merge` then leaves the states already in the target as they are. A new translation follows the default language.
- An archive that carries states into a site where that entity does not publish per language is a difference like any other. `--allow-mismatch` imports it, and the languages follow the default language. The import warns how many states it left out.
- A 0.6 archive with such states cannot be imported into 0.5 faithfully. 0.5 does not know the key and drops the states without a word.

### Page trees

A **page tree** is checked as a whole once its pages are written, inside the same transaction. The check uses the rules the server applies to every edit:

- no page is its own ancestor
- nothing is deeper than `maxDepth`
- every page has an address of its own in each language

The database does not enforce these, so an archive (or a `--merge` onto pages that are already there) could break them.

A tree that fails refuses the import, naming the pages, and nothing is changed. With `--merge`, only problems that involve a page of the archive count. So an old problem in the target does not stop an unrelated import.

`--dry-run` checks the archive's files and content model, not the tree. No redirects are left for addresses an import changes.

### Order and failure

Rows are inserted in dependency order: media, then entries (so that a post comes after its author), then translations, links and saved versions.

A link that cannot be satisfied in any order is left empty first and filled in afterwards. Examples are a page's parent, or two entries pointing at each other. A *required* link in a cycle cannot be imported.

All database changes are one transaction. A failure leaves the database as it was. Media files uploaded before it stay in storage, unreferenced. With `--replace`, the media files of the old content also stay in storage, because they may be shared with another environment.

Afterwards the search index is rebuilt. If that fails, the site rebuilds it on its next start. Or run `nitro task run cms:search-reindex`.

The website's caches (CDN, pre-rendered pages) are not purged.

## The archive format

The archive is one `.tar.gz` (format 1). It is all JSON, so it can be read without tinyzoo:

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

This is not `tinyzoo backup`. That is a raw database dump of everything, accounts included, for the same version. The archive is for content, across versions of the site that still agree on the content model.

Block and list JSON is written as it was exported. Import brings older ones up to date (see [what import checks first](#what-import-checks-first)).
