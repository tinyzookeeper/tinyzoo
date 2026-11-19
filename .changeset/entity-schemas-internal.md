---
'tinyzoo': major
---

An entity's `insertSchema` and `updateSchema` (zod) are `@internal`. They follow zod's own major versions, so 1.0 does not freeze them. An entity's `table` is frozen for reading: one column per field under its config key (a relation's as `<field>Id`), plus `id`, `createdAt`, `updatedAt`, `createdBy` and `updatedBy`. The SQL names behind them are not frozen.

### Upgrade

Nothing to do for most sites. Access rules and plugin queries that read `table` keep working. Code that validates with `insertSchema` or `updateSchema` keeps working, but may need a change when tinyzoo moves to a new zod.
