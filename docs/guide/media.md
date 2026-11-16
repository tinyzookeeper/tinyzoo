# Media: uploads, storage and pictures

`f.media({ accept })` is now a working pipeline, not just an FK column:

```
file → POST /api/cms/_media → StorageDriver.put → cms_media row → FK on the entity
                                     │
                       GET /api/cms/_media/raw/** (public, served by LocalDriver)
```

- **`StorageDriver`** seam (`server/utils/cmsStorage.ts`): `LocalDriver` writes to disk and
  serves through a Nitro route (a stream, with byte ranges); `S3Driver` targets any
  S3-compatible store (AWS S3, Cloudflare R2, MinIO, Pushbase Storage) — public or private
  bucket, see below. Selected via `cms.storage.driver`; size cap via `cms.storage.maxSizeMb`.
- Upload widget with thumbnail preview, replace/remove, and list-cell thumbnails.
- **Image dimensions** captured on upload (`width`/`height` via `image-size`) and used
  for intrinsic sizing + lazy loading in the admin.
- **Lifecycle / GC:** blobs are reference-counted across every media field — replacing or
  clearing a media field, or deleting its owning row, removes the now-orphan row **and** blob.
  Files uploaded or edited **in the library** (its page or picker; `cms_media.in_library`)
  are never removed automatically, only by deleting them there.
  `DELETE /api/cms/_media/:id` removes a specific media (409 if still referenced).
- **Limits:** per-file `cms.storage.maxSizeMb`, per-user `maxBytesPerUser` quota (0 = off),
  and `uploadRatePerMin` rate-limit (default 60; in-memory, single-instance).
- **Streamed, not buffered:** an upload is parsed as it arrives and written to a temporary
  file (next to the uploads on the local driver; `<os temp dir>/tinyzoo-uploads` with S3),
  then moved or streamed on to the store. The server's memory stays flat whatever the file
  size — a 100 MB video does not need 100 MB (or the 33× the old buffered upload took) of
  RAM. The size cap counts the bytes that really arrive, so a chunked body without a
  `Content-Length` is stopped with `413` the moment it crosses the cap. With S3 the temp
  folder must be a real disk (not a memory-backed `/tmp`) if you raise `maxSizeMb` far.
- **Hardened:** strict server-side MIME allowlist (no SVG/HTML → no stored-XSS); the first
  bytes must agree with the type (a picture must be readable, a PDF starts with `%PDF-`,
  MP4/WebM/MP3 carry their signature); pictures over **80 megapixels** are refused with a
  message that states the limit (the resizer cannot decode more); a field's `accept` is
  checked on save (`422` for a video in a picture field);
  `nosniff` + `Content-Security-Policy: sandbox` on served blobs, path-traversal guards,
  and a `Content-Length` ceiling on `/api/cms/**` before any body is read.
- **Only your files are served.** `/api/cms/_media/raw/<key>` answers only for keys that
  belong to a `cms_media` row (and their resized copies); anything else in a shared bucket
  is a `404`. PDFs are served with their file name (`Content-Disposition: inline;
  filename=…`), so *Save as* does not offer a uuid. A picture that cannot be resized (more
  pixels than the limit, stored before the check existed) is answered with a redirect to the
  original instead of an error.

### S3 / Cloudflare R2

The S3 driver signs requests with SigV4 via [`aws4fetch`](https://github.com/mhart/aws4fetch)
(`fetch` + Web Crypto), with path-style addresses (`endpoint/bucket/key`). How browsers get
the files is `cms.storage.s3.delivery` (env `NUXT_CMS_STORAGE_S3_DELIVERY`):

| `delivery` | Bucket | The stored address (`cms_media.url`) | The bytes |
|---|---|---|---|
| `public` — the default when `publicBaseUrl` is set | public read, or a CDN in front | `<publicBaseUrl>/<key>` (or `<endpoint>/<bucket>/<key>`) | straight from the bucket / CDN, never through the app |
| `proxy` — the default without `publicBaseUrl` | **private** (no bucket policy) | `/api/cms/_media/raw/<key>` | the app streams them: `Range`/`206` (Safari plays video), `ETag`/`304`, never held in memory |
| `redirect` | **private** | `/api/cms/_media/raw/<key>` | the app answers `302` to a signed address valid 5 minutes (`Cache-Control: private, max-age=240`) |

A stored address never expires: under `proxy` and `redirect` it is the app's own path (the
local driver's, so switching from local disk keeps old rows working), and a signed address is
made per request — never in the database, an API response or cached HTML. Picture sizes
(`<CmsImage>`) are always `/api/cms/_media/img/<id>/<width>.webp`. `tinyzoo export` / `import`,
`backup` / `restore` and the seed work in every mode. Pushbase Storage is a private bucket:
[`docs/deploying.md`](../deploying.md#pushbase--private-buckets) has the setup and says
when to pick `redirect`. (Before 0.2 an S3 store without `publicBaseUrl` stored the bucket's
own address; set `delivery: 'public'` to keep that.)

Configure with env vars (secrets stay server-side — never commit them):

```bash
NUXT_CMS_STORAGE_DRIVER=r2                 # or 's3'
NUXT_CMS_STORAGE_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
NUXT_CMS_STORAGE_S3_REGION=auto            # 'auto' for R2; e.g. 'us-east-1' for AWS
NUXT_CMS_STORAGE_S3_BUCKET=my-bucket
NUXT_CMS_STORAGE_S3_ACCESS_KEY_ID=...
NUXT_CMS_STORAGE_S3_SECRET_ACCESS_KEY=...
NUXT_CMS_STORAGE_S3_PUBLIC_BASE_URL=https://cdn.example.com   # public bucket / custom domain (→ delivery 'public')
NUXT_CMS_STORAGE_S3_DELIVERY=proxy         # 'public' | 'proxy' | 'redirect' — leave out for the default
# NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE is accepted and ignored: addresses are always path-style
```

For a private bucket leave `PUBLIC_BASE_URL` out (or set `delivery: 'proxy'` / `'redirect'` in
`cms.storage.s3` of `nuxt.config`).

Verified end-to-end against MinIO (an S3-compatible store you can run locally). It ships in
`compose.yaml` behind the `s3` profile, and creates a public-read `cms-media` bucket on its
first start (`MINIO_DEFAULT_BUCKETS`; use `cms-media:none` for a private bucket):

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

`@nuxt/image` is a **host/frontend** concern, not baked into the layer (it would force the
dependency + a provider config on every host, and the right provider differs by storage
backend). Each `cms_media` row exposes everything an image component needs — `url`, `width`,
`height`, `mime`, `alt` — so on your site you wire it to your chosen provider:

```vue
<NuxtImg :src="post.hero.url" :width="post.hero.width" :height="post.hero.height"
         :alt="post.hero.alt" sizes="sm:100vw md:50vw" />
```

Point `@nuxt/image` at an `ipx`/CDN provider for the `local` driver, or your R2/S3 public
domain for `delivery: 'public'`. With `proxy` and `redirect` the `url` is the app's own path
(`/api/cms/_media/raw/<key>`, the same as the local driver's), so configure it the way you
would for `local` — or use `<CmsImage>`, which needs no provider.
