---
'tinyzoo': patch
---

Uploads are parsed with `@fastify/busboy`, the Fastify team's maintained fork of `busboy` (also what Node's own `fetch` uses), instead of `busboy` 1.6, which has had no release since 2022. Its types are built in, so `@types/busboy` is gone. The upload size cap is enforced by tinyzoo's own byte count, independent of the parser. Nothing changes for sites.
