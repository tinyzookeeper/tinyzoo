---
'tinyzoo': patch
---

**Two parts of the content model with the same name are refused when the config loads, with both named.** An entity `courseSignup` and the choice field `signup` of `course` both became `courseSignup` in the generated `schema.ts` (and `course_signup` in the database). Nothing said so until drizzle-kit failed with `Multiple exports with the same name "courseSignup"`. tinyzoo now checks every table, translation table, many-to-many junction and choice field when it reads `cms.config.ts`, and names the two that clash and how to rename one.

### Upgrade

Nothing to do. Such a config never got a migration, so no running site has one.
