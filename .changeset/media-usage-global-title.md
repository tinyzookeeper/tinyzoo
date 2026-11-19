---
'tinyzoo': patch
---

**Changing a picture's alt text works when a global holding it has no `titleField`.** `PATCH /api/cms/_media/:id` answered 500 (`Cannot convert undefined or null to object`) when the picture was used by a global without a `titleField`, or by an entry whose `titleField` is a picture. The file's usage list ("Used in") now shows such an entry without a title instead of failing.

### Upgrade

Nothing to do. A `titleField` added only to get around this can stay or go.
