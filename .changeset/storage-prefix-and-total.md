---
"tinyzoo": minor
---

Two storage settings.

- `cms.storage.s3.prefix` (`NUXT_CMS_STORAGE_S3_PREFIX`): a place of the site's own inside a bucket, such as `sites/7f3a`. Every object is stored under it; the keys in the database and the addresses under `proxy` and `redirect` stay as they are. `tinyzoo backup`, `restore`, `export` and `import` use the same place.
- `cms.storage.maxBytes` (`NUXT_CMS_STORAGE_MAX_BYTES`): how much the whole site may store. An upload that would go over is refused with `413` and the admin says there is not enough space left. The status route reports the limit as `media.limitBytes`.

The limit is checked again when the file's row is inserted, under a lock per site, so uploads that arrive together cannot all see room. `maxBytesPerUser` is checked the same way now. With neither set, uploads work as before.
