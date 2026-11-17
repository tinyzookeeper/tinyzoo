---
'tinyzoo': patch
---

An upload on a server whose temporary folder cannot be created (a read-only container filesystem with no writable `/tmp`) now logs what to do, once: point `TMPDIR` at a writable volume, or at `/dev/shm` for small files. The upload itself answers 500 "The server has no writable folder for uploads" instead of a bare server error. The deploy guide's Media and Pushbase sections describe the setting.
