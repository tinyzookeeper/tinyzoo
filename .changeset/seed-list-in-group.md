---
'tinyzoo': patch
---

**`tinyzoo seed` gives the items of a list inside a group their ids.** A seed that wrote a list inside a group (on a global or an entry) failed with `422 … tagline.0.id: Invalid input: expected string, received undefined`. The seed now makes stable ids for those items as it does for blocks and other lists, so the items need no `id` and a second run changes nothing.

### Upgrade

Nothing to do.
