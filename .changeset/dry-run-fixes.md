---
'tinyzoo': patch
---

What upgrading two real sites to 1.0 turned up:

- **Files uploaded on 0.1 stay in the media library.** Going from 0.1 adds `cms_media.in_library` as `false` for every file, so an old library file was deleted the first time an editor replaced or cleared it. A new upgrade step, `media-in-library`, puts the existing files in the library in the run that adds the column. It does nothing on any other site.
- **One `x-default` per sitemap entry.** When a site's `cms:sitemap` hook already adds an `x-default` alternate, tinyzoo no longer adds a second one.
- **The upgrade guide** now says to move a site made with 0.1 to `vue-tsc` 3 (version 2 does not check the templates), that every site needs 0.2's migration, how to keep the old files in the library when stopping at 0.2 to 0.7, to drop a hook's own `x-default` from 0.5, and to update `engines.node` and list `@internationalized/date` for 1.0.

### Upgrade

Nothing to do. On a site from 0.1, `tinyzoo up` (or the start with `NUXT_CMS_MIGRATIONS_ON_START`) runs the new step by itself.
