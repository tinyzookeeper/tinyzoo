---
'tinyzoo': minor
---

**An MCP server at `/api/mcp`, with personal access tokens.** A program that speaks MCP can read and edit the site's content: describe the collections, list, read, create and change entries and globals, publish and unpublish, delete, search, and upload files. Rich-text fields can be written and read as Markdown.

Each person makes their own tokens (`tzp_…`) on their account page in the admin, picks what each may do (edit, publish, delete, change files, only some collections) and can revoke them there. A token never does more than its person's role, and every tool goes through the admin's own server code, so validation, publishing rules, field access, revisions, webhooks and the audit log apply as in the admin. Changes are recorded under the person, with `via: 'mcp'` in the audit log. Only the SHA-256 of a token is stored.

It needs the built-in sign-in. `cms.mcp: false` (`NUXT_CMS_MCP_ENABLED=false`) turns it off. See `docs/guide/mcp.md`.

### Upgrade

Run `pnpm exec tinyzoo upgrade` as on every upgrade: it writes a migration that adds the table `cms_access_tokens`. Commit it with the update; nothing else changes.
