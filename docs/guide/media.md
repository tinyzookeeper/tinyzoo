# Media: uploads, storage and pictures

Use `f.media({ accept })` to let editors attach pictures and files to an entry. This page shows how an upload travels, where the files are stored, and how to show them on your site.

The common case needs no setup. Files go to a local folder, and you switch to S3 or R2 when you deploy. The upload pipeline looks like this:

```
file → POST /api/cms/_media → StorageDriver.put → cms_media row → FK on the entity
                                     │
                       GET /api/cms/_media/raw/** (public, served by LocalDriver)
```

## How uploads work

### The storage driver

The `StorageDriver` seam (`server/utils/cmsStorage.ts`) decides where the files go. Pick one with `cms.storage.driver`. Set the size cap with `cms.storage.maxSizeMb`.

- `LocalDriver` writes to disk. It serves files through a Nitro route, as a stream with byte ranges.
- `S3Driver` targets any S3-compatible store: AWS S3, Cloudflare R2, MinIO or Pushbase Storage. The bucket can be public or private ([see below](#s3--cloudflare-r2)).

### In the admin

- The upload widget shows a thumbnail preview, with replace and remove.
- List cells show thumbnails.
- Image dimensions (`width` / `height`) are captured on upload, with `image-size`. The admin uses them for intrinsic sizing and lazy loading.

### Lifecycle and clean-up

Blobs are reference-counted across every media field. Replacing or clearing a media field, or deleting its owning row, removes the now-orphan row **and** blob.

- Files uploaded or edited **in the library** are never removed automatically. They are removed only by deleting them there. Such files are the ones with `cms_media.in_library` set, from the library's page or its picker.
- `DELETE /api/cms/_media/:id` removes a specific media. It returns 409 if the media is still referenced.

### Limits

- `cms.storage.maxSizeMb`: the cap per file (default 10).
- `cms.storage.maxBytes`: how much the whole site may store, in bytes (0 = no limit, the default; env `NUXT_CMS_STORAGE_MAX_BYTES`). It is the sum of the sizes of the site's media files, the same number the status route reports as `media.bytes`. An upload that would take the site over the limit is refused with `413`, and the admin tells the editor there is not enough space left. A file that fits exactly is accepted. Deleting media frees room at once.
- `maxBytesPerUser`: a quota per user (0 = off).
- `uploadRatePerMin`: a rate limit (default 60; in memory, single instance).

The smaller copies made of pictures are derived from the originals and are not counted against `maxBytes`. They are made again when needed, and deleting a picture deletes them.

The total is checked twice. Before the file is stored, so an upload that cannot fit costs the store no write. And again at the moment its row is inserted, under a lock that lets one such check-and-insert run at a time per site. The lock is held for a sum and an insert, never for the upload itself. Ten uploads that arrive together therefore cannot all see room: only as many as fit are kept, and a file that lost the race is removed from the store again. With `maxBytes` (or `maxBytesPerUser`) unset, there is no lock and nothing changes.

The status payload (`/api/health/status`) carries `media.limitBytes` next to `media.bytes` when a limit is set.

When one running app serves several sites, `maxSizeMb` and `maxBytes` are read from each site's own settings: a site at its limit does not affect the others.

### Streamed, not buffered

An upload is parsed as it arrives and written to a temporary file. On the local driver the file sits next to the uploads. With S3 it is in `<os temp dir>/tinyzoo-uploads`. Then it is moved or streamed on to the store.

The server's memory stays flat whatever the file size. A 100 MB video does not need 100 MB of RAM. The old buffered upload needed 33 times that.

The size cap counts the bytes that really arrive. A chunked body without a `Content-Length` is stopped with `413` the moment it crosses the cap.

With S3, the temp folder must be a real disk, not a memory-backed `/tmp`, if you raise `maxSizeMb` far.

### Hardened

- A strict server-side MIME allowlist applies. There is no SVG or HTML, so there is no stored XSS.
- The first bytes must agree with the type. A picture must be readable. A PDF starts with `%PDF-`. MP4, WebM and MP3 carry their signature.
- Pictures over **80 megapixels** are refused, with a message that states the limit. The resizer cannot decode more.
- A field's `accept` is checked on save. A video in a picture field gets `422`.
- Served blobs carry `nosniff` and `Content-Security-Policy: sandbox`.
- Path-traversal guards are in place.
- A `Content-Length` ceiling applies on `/api/cms/**` before any body is read.

### Only your files are served

`/api/cms/_media/raw/<key>` answers only for keys that belong to a `cms_media` row, and for their resized copies. Anything else in a shared bucket is a `404`.

- PDFs are served with their file name (`Content-Disposition: inline; filename=…`), so *Save as* does not offer a uuid.
- A picture that cannot be resized gets a redirect to the original instead of an error. That happens for a picture with more pixels than the limit, stored before the check existed.

### S3 / Cloudflare R2

The S3 driver signs requests with SigV4 via [`aws4fetch`](https://github.com/mhart/aws4fetch) (`fetch` plus Web Crypto). It uses path-style addresses (`endpoint/bucket/key`).

How browsers get the files is set by `cms.storage.s3.delivery` (env `NUXT_CMS_STORAGE_S3_DELIVERY`):

| `delivery` | Bucket | The stored address (`cms_media.url`) | The bytes |
|---|---|---|---|
| `public` — the default when `publicBaseUrl` is set | public read, or a CDN in front | `<publicBaseUrl>/<key>` (or `<endpoint>/<bucket>/<key>`) | straight from the bucket / CDN, never through the app |
| `proxy` — the default without `publicBaseUrl` | **private** (no bucket policy) | `/api/cms/_media/raw/<key>` | the app streams them: `Range`/`206` (Safari plays video), `ETag`/`304`, never held in memory |
| `redirect` | **private** | `/api/cms/_media/raw/<key>` | the app answers `302` to a signed address valid 5 minutes (`Cache-Control: private, max-age=240`) |

A stored address never expires:

- Under `proxy` and `redirect` it is the app's own path. That is the local driver's path too, so switching from local disk keeps old rows working.
- A signed address is made per request. It is never in the database, an API response or cached HTML.

Picture sizes (`<CmsImage>`) are not stored at all. Their address is always `/api/cms/_media/img/<id>/<width>.webp`.

`tinyzoo export` / `import`, `backup` / `restore` and the seed work in every mode.

### A place of its own in a shared bucket

Several sites can share one bucket. Give each its own place with `cms.storage.s3.prefix` (env `NUXT_CMS_STORAGE_S3_PREFIX`), for example `sites/7f3a`:

- Every object of the site is stored as `<prefix>/<key>`: uploads, the smaller copies of pictures, and whatever else the driver writes, reads or deletes. A signed address is for the prefixed object.
- The key the site keeps in its database stays `2026/11/<uuid>.png`, with or without a prefix, and so does the address of the app under `proxy` and `redirect` (`/api/cms/_media/raw/<key>`). A site can move between a bucket of its own and a prefixed place by copying its objects; its database is not touched.
- Under `public`, the stored address has the prefix after the public address: `<publicBaseUrl>/<prefix>/<key>`, or `<endpoint>/<bucket>/<prefix>/<key>`. `publicBaseUrl` is the address of the bucket's root, so a CDN in front of the bucket needs no rule per site. A row stored under `public` before the prefix was set keeps the address it was stored with.
- The prefix is path segments of `a-z`, `0-9`, `-`, `_` and `.`, separated by `/`: no empty segment, no `.` or `..`, no slash at the start. One slash at the end is dropped. Anything else stops the site's storage with an error that names the setting. A key can never leave its prefix: keys with `..` or empty segments are refused before any request is made.
- Empty (the default) is the bucket's root, as before.
- `tinyzoo backup` / `restore` and `export` / `import` read and write the same place, from the same setting: a backup of a prefixed site holds exactly that site's files under their keys without the prefix, and a restore puts them under the prefix of the site it restores into.

When one app serves many sites, every site that uses the S3 driver needs a place of its own: its own bucket, or its own prefix. The app cannot see across sites that two of them point at the same endpoint, bucket and prefix, and then they share files, each one's deletes included. Whoever writes the site directory is responsible for keeping them apart.

Pushbase Storage is a private bucket. [`docs/deploying.md`](../deploying.md#pushbase--private-buckets) has the setup and says when to pick `redirect`.

Before 0.2, an S3 store without `publicBaseUrl` stored the bucket's own address. Set `delivery: 'public'` to keep that.

Configure with env vars. Secrets stay server-side, so never commit them:

```bash
NUXT_CMS_STORAGE_DRIVER=r2                 # or 's3'
NUXT_CMS_STORAGE_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
NUXT_CMS_STORAGE_S3_REGION=auto            # 'auto' for R2; e.g. 'us-east-1' for AWS
NUXT_CMS_STORAGE_S3_BUCKET=my-bucket
NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID=...
NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY=...
NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL=https://cdn.example.com   # public bucket / custom domain (→ delivery 'public')
NUXT_CMS_STORAGE_S3_DELIVERY=proxy         # 'public' | 'proxy' | 'redirect' — leave out for the default
NUXT_CMS_STORAGE_S3_PREFIX=sites/7f3a      # a place of its own in a shared bucket — leave out for the bucket's root
# NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE is accepted and ignored: addresses are always path-style
```

For a private bucket, leave `PUBLIC_BASE_URL` out. Or set `delivery: 'proxy'` / `'redirect'` in `cms.storage.s3` of `nuxt.config`.

### Trying S3 locally with MinIO

This is verified end-to-end against MinIO, an S3-compatible store you can run locally. It ships in `compose.yaml` behind the `s3` profile. On its first start it creates a public-read `cms-media` bucket (`MINIO_DEFAULT_BUCKETS`; use `cms-media:none` for a private bucket):

```bash
docker compose --profile s3 up -d     # MinIO on :9100, console on :9101
```

Then run the playground against it (console login: `minio` / `minio12345`):

```bash
NUXT_CMS_STORAGE_DRIVER=s3 \
NUXT_CMS_STORAGE_S3_ENDPOINT=http://localhost:9100 \
NUXT_CMS_STORAGE_S3_REGION=us-east-1 \
NUXT_CMS_STORAGE_S3_BUCKET=cms-media \
NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID=minio \
NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY=minio12345 \
NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL=http://localhost:9100/cms-media \
pnpm play
```

> Host ports are `9100`/`9101` rather than MinIO's usual `9000`/`9001`, which collide with
> common local tooling; override with `CMS_MINIO_PORT` / `CMS_MINIO_CONSOLE_PORT`.

### Rendering media on your frontend

Draw a picture from the CMS with `<CmsImage>`. It needs no provider and no setup:

```vue
<CmsImage :media="post.hero" sizes="(min-width: 768px) 50vw, 100vw" class="aspect-video w-full object-cover" />
```

It writes the alt text, the real size (no layout jump), lazy loading, the editor's focal point,
and a `srcset` of the picture's smaller copies (below). Say in `sizes` how wide the picture is
shown, and the browser downloads the smallest copy that is sharp there.

### Picture sizes

Every uploaded JPEG, PNG, WebP or AVIF gets smaller copies, as WebP, at these widths (those
smaller than the picture itself): 320, 480, 640, 750, 828, 960, 1080, 1280, 1440, 1920 and 2560 px.
They are served at `/api/cms/_media/img/<id>/<width>.webp` and cached for a year. The list
only grows.

The copies are made right after the upload, in the background, so no visitor waits for
one. A picture is decoded once, every width is drawn from that, and the server works on one
picture at a time: a page of twenty new photos never decodes twenty of them at once, which is
what takes a small server over its memory. A width asked for before it exists is made on the
spot, alone, and kept.

Pictures uploaded before tinyzoo 1.10, and every picture when a width is added, are caught up
by the scheduled task `cms:media-sizes` (every minute), newest first. It needs nothing from
you. The site's status (`GET /api/health/status`) says how far it is:
`media.sizes: { done, waiting, failed }`. A picture that cannot be resized (a damaged file)
is tried three times, an hour apart; its original is shown meanwhile.

### Pictures in public/ for @nuxt/image

`@nuxt/image` resizes with IPX unless told otherwise: every `<NuxtImg>` is decoded and
resized on the server while the visitor waits, nothing is kept, and a page full of photos
decodes them all at once. On a small server that is how a site runs out of memory.

A site that uses `@nuxt/image` therefore gets tinyzoo's provider by default. When the site is
built (and when `nuxt dev` starts), every picture in `public/` wider than 320 px gets WebP
copies at the widths above and at its own width, served as static files under
`/_tz/img/<hash>/<width>.webp` and cached for a year (the hash is the file's content, so a
changed picture gets new addresses). `<NuxtImg>` then only picks a copy:

```vue
<NuxtImg src="/img/team.jpg" sizes="100vw md:50vw" alt="The team" class="aspect-video w-full object-cover" />
```

- Only the width counts. The copies are WebP at fixed widths, so `height`, `fit`, `format` and
  `quality` change nothing: crop with CSS (`object-fit: cover`).
- A picture that is not in `public/` (another site's address, a CMS file) is shown as it is.
  Use `<CmsImage>` for CMS files.
- The copies are kept in `node_modules/.cache/tinyzoo/images`, so a second build on the same
  machine only makes those of new or changed pictures.
- To keep IPX or use another provider, set `image: { provider: '…' }` in `nuxt.config.ts`
  (tinyzoo warns when it is IPX), or turn tinyzoo's off with `cms: { images: { static: false } }`.
