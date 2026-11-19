# The MCP server

Every tinyzoo site has an MCP server at `/api/mcp`. A program that speaks [MCP](https://modelcontextprotocol.io) can use it to read and edit the site's content: list and change entries, publish them, change settings, upload files. It works as the person who connected it, with only the rights that person gave it.

[Connect a program](#connect-a-program) · [Access tokens](#access-tokens) · [What a token may do](#what-a-token-may-do) ·
[The tools](#the-tools) · [Rich text as Markdown](#rich-text-as-markdown) · [What is recorded](#what-is-recorded) ·
[Turning it off](#turning-it-off) · [Security](#security)

## Connect a program

1. In the admin, open **your account** (the menu at the bottom left) and go to **Access tokens**.
2. Click **New token**, give it a name and the rights it needs, and copy the token. It is shown only once.
3. Give the program the address shown above the list (`https://your-site/api/mcp`) and the token, sent as `Authorization: Bearer tzp_…`.

With Claude Code, for example:

```sh
claude mcp add --transport http my-site https://example.com/api/mcp --header "Authorization: Bearer tzp_…"
```

The server is Streamable HTTP and stateless. It serves the 2026-07-28 revision of MCP and the older 2025 ones.

## Access tokens

A token belongs to one person and acts as them. Each person makes and revokes their own tokens on their account page, and nobody else sees them.

- A token looks like `tzp_` and 43 more characters. tinyzoo stores only its SHA-256, so a lost token cannot be shown again: revoke it and make another.
- A token can work for 30 days, 90 days, a year, or until it is revoked.
- It stops working at once when it is revoked, when it expires, or when its person is disabled or deleted. A password change does not end it.
- A person can have 20 tokens at a time.
- The shared demo account (`cms.demo`) cannot make tokens.
- Tokens need the built-in sign-in. With `cms.auth.mode: 'external'` there is no MCP server.

## What a token may do

A token never does more than its person's role. Its rights narrow the role further:

| Right | Lets the token |
|---|---|
| (always) | read the content its person can open |
| **Create and edit** | create entries and change them, as drafts in collections with publishing |
| **Publish and unpublish** | publish, unpublish, change what is live, and change globals and collections without publishing (those are live the moment they are saved). Only for a role that may publish |
| **Delete** | delete entries (and files, with the next right) |
| **Upload and change files** | add files to the media library and change their details. Only for a role with the media library |

A token can also be limited to **some collections and globals**. It then cannot see the others.

Everything else stays with people in the admin: accounts, the team, the audit log, privacy requests, previews and shared editing. Field access (`.access()`) and row rules (`access`) apply to a token exactly as to its person. See [Roles and permissions](roles.md).

## The tools

| Tool | What it does | Needs |
|---|---|---|
| `describe_site` | the collections and globals the token reaches, their fields, how each publishes, what the token may do there, the languages | |
| `describe_collection` | the exact data a collection or global takes, as JSON Schema | |
| `list_entries` | entries of a collection: search, status, missing translations, sorting, pages | |
| `get_entry` | one entry with all its fields, in a language | |
| `get_global` | a global | |
| `search` | the admin's search over every collection, drafts included | |
| `list_media` | files in the media library | |
| `create_entry` | a new entry, a draft unless `publish: true` | create and edit |
| `update_entry` | change some fields of an entry, or of a translation (`locale`) | create and edit |
| `publish_entry`, `unpublish_entry` | put an entry, or one translation, on the website or take it off | publish |
| `delete_entry` | delete an entry, or one translation | delete |
| `update_global` | change some fields of a global; the others stay | publish |
| `upload_media` | add a file, sent as base64 | files |
| `update_media` | change a file's description or folder | files |
| `delete_media` | delete a file | files and delete |

Every tool goes through the same server code as the admin: the same validation, publishing rules, revisions, search index, webhooks and change hooks. A tool that is not allowed answers with an error that says why.

Results are compact JSON. Fields without a value are left out.

## Rich text as Markdown

Rich-text fields can be written as Markdown strings, and read as Markdown with `richText: "markdown"`. The editor's own nodes and marks come through: headings, paragraphs, bullet and numbered lists, quotes, code blocks, rules, line breaks, images, bold, italic, strikethrough, code and links. An image from the media library keeps its file as `![alt](src "media:<id>")`.

Underline has no Markdown: it is read as plain text. To keep it, read and write the editor's JSON (the default).

## What is recorded

A change made with a token is recorded under its person, like a change in the admin: in the history of the entry, as the entry's last editor, and in the audit log. The audit entry also carries `meta.via: 'mcp'` and the token's id. Making and revoking a token are in the audit log too (`token.create`, `token.revoke`).

## Turning it off

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  cms: { mcp: false },
})
```

Or set `NUXT_CMS_MCP_ENABLED=false`. `/api/mcp` then answers `404`, and the account page shows no tokens.

## Security

- Only a token opens `/api/mcp`. A signed-in session does not.
- Tokens are taken only at `/api/mcp`, never by the admin's own API.
- After 20 wrong tokens from one address in 10 minutes, the server answers `429`. One token may make 300 requests a minute.
- A file sent to `upload_media` is checked like an upload in the admin: its type, its first bytes, its size and the storage quota.
