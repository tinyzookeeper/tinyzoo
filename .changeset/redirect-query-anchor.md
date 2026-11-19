---
'tinyzoo': patch
---

**A redirect to an address with a `#anchor` keeps the visitor's query.** The query of the old address was put after the anchor (`/merch#shop?utm_source=x`), where the browser takes it as part of the anchor and the page never sees it. It now goes before the anchor (`/merch?utm_source=x#shop`). A target with a query of its own is still kept as it is.

### Upgrade

Nothing to do.
