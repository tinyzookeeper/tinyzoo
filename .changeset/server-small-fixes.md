---
'tinyzoo': patch
---

Smaller fixes from the 0.2 audit:

- Signing in successfully no longer counts towards the sign-in limits (only failed attempts do; an office behind one address could lock itself out). Every `429` of the CMS (sign-in, forms, uploads, resets, search…) now carries `Retry-After`.
- A form's honeypot and "too fast" answers are the same `201` as a stored message, so a robot cannot tell. `_t` stays optional, documented why.
- CSV export: a phone number like `+420 777 123 456` is no longer prefixed with `'`; `=`, `@`, a leading tab or CR, and `+`/`-` that are not followed by a number are still neutralised.
- The content API takes `?locale=en-US` or `EN` for the closest language the site has (`en`) instead of `400`; a language it does not have is still `400`.
- A `404` of an unmatched route (a signed-in probe of `/api/cms/_p/…`, or a page that throws a fatal 404) is one info line without a stack, not `level: error`.
- `tinyzoo backup` streams each media file to disk instead of reading it whole (a 400 MB video took 1.5 GB of memory).
- Reading a file from disk for a slow visitor no longer queues the whole file in memory (`Readable.toWeb` counts its queue in chunks, so 64 KB meant 4 GB), and an upload to a bucket is sent with a plain pipe instead of `fetch`, whose request stream (undici) read most of a 300 MB file ahead of the socket.
- `defineEntity` refuses a name that is not letters, digits and underscores (a name with a space or a dash made the generated `schema.ts` fail to compile).
