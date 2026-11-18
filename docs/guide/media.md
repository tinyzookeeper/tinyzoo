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

- `cms.storage.maxSizeMb`: the cap per file.
- `maxBytesPerUser`: a quota per user (0 = off).
- `uploadRatePerMin`: a rate limit (default 60; in memory, single instance).

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

`@nuxt/image` is a **host/frontend** concern. It is not baked into the layer, because it would force the dependency and a provider config on every host. The right provider also differs by storage backend.

Each `cms_media` row exposes everything an image component needs: `url`, `width`, `height`, `mime` and `alt`. On your site, wire it to your chosen provider:

```vue
<NuxtImg :src="post.hero.url" :width="post.hero.width" :height="post.hero.height"
         :alt="post.hero.alt" sizes="sm:100vw md:50vw" />
```

Which provider to point `@nuxt/image` at depends on the storage:

- For the `local` driver, use an `ipx` or CDN provider.
- For `delivery: 'public'`, use your R2/S3 public domain.
- For `proxy` and `redirect`, the `url` is the app's own path (`/api/cms/_media/raw/<key>`, the same as the local driver's). Configure it the way you would for `local`.

Or use `<CmsImage>`, which needs no provider.
