---
'tinyzoo': patch
---

Image sizes are made with sharp 0.35 (was 0.34), which brings a newer libvips with its security fixes. A site that also uses `nuxt-og-image` (or anything else on sharp 0.35) now ends up with one sharp instead of two. With two, the server build put each in its own folder and sharp's Linux binary could not find libvips, so the server stopped on start with `ERR_DLOPEN_FAILED`. Sites that pinned sharp to 0.34.5 to avoid that can drop the pin. sharp 0.35 needs Node 20.9 or later; tinyzoo already needs 22.
