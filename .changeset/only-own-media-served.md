---
'tinyzoo': patch
---

Security: `/api/cms/_media/raw/<key>` served any object in the storage bucket, including ones other tools had put there (with a shared bucket, anyone could read them anonymously; redirect delivery even signed them). It now serves only keys that belong to a `cms_media` row, and the resized copies of those; everything else is a `404`. PDFs are now served with their file name (`Content-Disposition: inline; filename="…"`, also in the signed address of `redirect` delivery) instead of the uuid of the stored key.
