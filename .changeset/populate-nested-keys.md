---
'tinyzoo': patch
---

**`tinyzoo generate` refuses a `content.populate` or `content.hidden` key that is not a field, as the types do.** A nested key such as `populate: ['sister.logo']` was a type error (TS2322), but `generate` accepted it without a word and the content API ignored it. Now `generate` stops and says why: `populate` and `hidden` take the entity's own fields, and a picture inside a group, a list or blocks is always delivered without `populate`. A misspelt `hidden` key is caught the same way, instead of leaving the field it meant public. The server still ignores such a key, so a site already running with one keeps working.

### Upgrade

If `tinyzoo generate` stops on `content.populate names "…"`: remove that key. A picture inside a group comes in the response anyway.
