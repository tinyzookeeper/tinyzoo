---
'tinyzoo': patch
---

**`tinyzoo seed` refuses a file folder the site would rename, instead of uploading the files again on every run.** The media library's folders have one level. The site files `Lektoři/fotky` as `Lektoři fotky`, so the seed's second run looked under the name it was given, found nothing and uploaded every file again. The seed now stops on such a folder (`/`, `\`, doubled spaces or spaces at the ends) before uploading anything, says how the site would file it, and suggests a name. An empty folder (`folder: ''`) counts as no folder, as on the site.

### Upgrade

A seed that stops with `the folder "…" cannot be used`: write the folder without `/`, for example `Lektoři – fotky`. Files uploaded earlier under the renamed folder stay in the library. Remove the duplicates there, or move them to the new folder name.
