---
'tinyzoo': minor
---

`tinyzoo generate` also stops on statements that may fail on rows that already exist: a required column without a default, `SET NOT NULL`, a new unique constraint or unique index, a new `CHECK`. The new version would otherwise fail to migrate at start and restart in a loop. Keep such a migration with `--allow-risky` (`--allow-drop` still covers statements that lose data, and does not cover these). See "Adding a required field" in `docs/upgrading.md`, which also says why `drizzle-kit push` is not supported on a tinyzoo site and how to fix an out-of-order migration that already ran in production.

The `cms:error` report's `error` is now a scrubbed `Error` (the message and causes without the bound values of a failed database query, stack frames kept); the error as thrown moved to `report.rawError`, which can contain personal data and should not be sent to a tracker. A webhook address in the report and in the log is its origin plus a short hash of the path (Slack and Discord keep their secret in the path).

Erasing a person in Settings → Privacy no longer strips other people's details from the audit entries they appear on: an administrator's `user.invite` entries keep the invitees' addresses.

### Upgrade

If your `cms:error` plugin sends `report.error` to a tracker, nothing changes except that it is now safe to do so. Code that read the thrown error's own properties (`statusCode`, `data`) from `report.error` should read them from `report.rawError`.
