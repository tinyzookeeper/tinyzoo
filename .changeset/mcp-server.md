---
'tinyzoo': minor
---

**An MCP server at `/api/mcp`, with personal access tokens.** A program that speaks MCP can read and edit the site's content: describe the collections, list, read, create and change entries and globals, publish and unpublish, delete, search, and upload files. Rich-text fields can be written and read as Markdown.

**A program signs in with OAuth: the address is the whole setup.** It finds the sign-in from the server's 401, registers itself, and sends its person to a new admin page, `/admin/connect`, to choose what it may do. It then gets an access token for an hour and a refresh token that lasts 60 days from its last use (PKCE required; RFC 8414, 9728, 7591, 7009). Each connection is listed on the person's account page and revoked there.

A program that cannot sign in, or a script, takes a token made by hand (`tzp_…`): each person makes their own on their account page, picks what each may do (edit, publish, delete, change files, only some collections) and can revoke them there. A token never does more than its person's role, and every tool goes through the admin's own server code, so validation, publishing rules, field access, revisions, webhooks and the audit log apply as in the admin. Changes are recorded under the person, with `via: 'mcp'` in the audit log. Only the SHA-256 of a token is stored.

It needs the built-in sign-in. `cms.mcp: false` (`NUXT_CMS_MCP_ENABLED=false`) turns it off. See `docs/guide/mcp.md`.

### Upgrade

Run `pnpm exec tinyzoo upgrade` as on every upgrade: it writes a migration that adds the tables `cms_access_tokens`, `cms_oauth_clients`, `cms_oauth_requests` and `cms_oauth_codes`. Commit it with the update; nothing else changes.

A site whose own app already serves `/.well-known/oauth-authorization-server` or `/.well-known/oauth-protected-resource`: those addresses are now tinyzoo's while `cms.mcp` is on.
