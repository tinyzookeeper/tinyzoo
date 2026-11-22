---
'tinyzoo': minor
---

**Pictures no longer take a small server down.** A page full of new photos used to resize them all at once on the server; on an instance with 256 MB of memory that was enough for the host to kill it. Now:

- The smaller copies of an uploaded picture are made right after the upload, in the background, so no visitor waits for one. The server works on one picture at a time (decoded once, every width drawn from it, the original read as it is decoded); a width a visitor asks for before it exists is made on the spot and goes before the background work.
- More widths, closer to real screens: 320, 480, 640, 750, 828, 960, 1080, 1280, 1440, 1920 and 2560 px. `<CmsImage>` lists them by itself.
- Pictures uploaded before are caught up by a new scheduled task, `cms:media-sizes` (every minute, newest first). Nothing to do; the site's status says how far it is (`media.sizes`).
- A site that uses `@nuxt/image` gets tinyzoo's provider by default: the pictures in `public/` get their copies when the site is built, and `<NuxtImg>` picks one instead of resizing with IPX on every request. `cms: { images: { static: false } }` or an `image: { provider }` of the site's own keeps the old behaviour.
- The status (`GET /api/health/status`) also says how much memory the instance holds and, in a container, its limit and peak (`instance.memory`).

### Upgrade

1. Run `tinyzoo upgrade` and commit the migration it writes: it adds the table `cms_media_sizes`.
2. Deploy. With `NUXT_CMS_MIGRATIONS_ON_START=true` the migration is applied at start; otherwise run `tinyzoo up`. The copies of existing pictures are then made in the background within minutes.
3. Only if the site sets `image: { provider: 'ipx' }` in `nuxt.config.ts`: remove it to use the copies made at build (the build warns while it is there).
