---
'tinyzoo': minor
---

Private S3 buckets: `cms.storage.s3.delivery` (env `NUXT_CMS_STORAGE_S3_DELIVERY`) says how browsers get the files — `'public'` (straight from a public bucket or CDN, as before), `'proxy'` (the app streams them from a private bucket) or `'redirect'` (the app answers 302 to a signed address valid five minutes). Made for Pushbase Storage, whose objects are private; works with any S3-compatible store.

- Under `proxy` and `redirect` the stored address is the app's own `/api/cms/_media/raw/<key>` — the local driver's, so moving from local disk to S3 keeps old rows working — and a signed address is made per request and never stored, returned by an API or put in cached HTML. Picture sizes stay `/api/cms/_media/img/<id>/<width>.webp`.
- The raw route streams (S3 and local disk): `Range` / `206` / `Content-Range` / `Accept-Ranges` (Safari plays video), `ETag` / `If-None-Match` / `304`, `HEAD`, never the whole file in memory. A missing object is 404, any other answer of the bucket 502 without its address or credentials. The safety headers (`nosniff`, sandboxing CSP, inline, immutable caching) are unchanged. `redirect` answers with `Cache-Control: private, max-age=240`.
- `StorageDriver` gains `read(key, { range, ifNoneMatch })` (a stream) next to `get()`, and optionally `presign(key, seconds)`.
- Storage keys that would leave the bucket (`..`, empty segments) are refused. Requests to the bucket are retried twice, not ten times, so a failing bucket does not hold a visitor for half a minute.
- `NUXT_CMS_STORAGE_S3_FORCE_PATH_STYLE` (injected by Pushbase) is accepted and ignored: addresses are always path-style.
- Under `public` with a bucket that is in fact private, the first upload logs one line saying so.
- `tinyzoo export` / `import` write the address the running app would (app path for `proxy` / `redirect`); `backup` / `restore` and the seed already read and wrote with signed requests.
- Docs: "Pushbase / private buckets" in `docs/deploying.md`; the storage section of the README.

### Upgrade

Sites on `driver: 's3'` / `'r2'` **with** `publicBaseUrl` change nothing: delivery stays `public`.

Sites on S3/R2 **without** `publicBaseUrl` now default to `proxy` (before, the stored address was `<endpoint>/<bucket>/<key>`, which only works for a public bucket). New uploads get the app path and are served through the app; rows made earlier keep their bucket address. To keep serving straight from a public bucket, set `delivery: 'public'` (or `NUXT_CMS_STORAGE_S3_DELIVERY=public`).

On a private bucket (Pushbase): link the storage with `--key NUXT_CMS_STORAGE_S3`, set `NUXT_CMS_STORAGE_DRIVER=s3` and nothing else.
