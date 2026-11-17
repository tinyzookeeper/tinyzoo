# Roles and permissions

Who may do what in the admin: the three built-in roles, roles of your own, what a role may
do with each collection and each field, the media library, and what happens to a person
whose role you take out of the config.

Editors change data, developers change structure, and **roles are structure**: they are written in
`cms.config.ts`, in TypeScript, and checked as the config loads. Which role a *person* has is
data: an administrator sets it in Settings → Team.

[The built-in roles](#the-built-in-roles) · [Roles of your own](#roles-of-your-own) ·
[Per-field permissions](#per-field-permissions) · [The media library](#the-media-library) ·
[Row-level rules](#row-level-rules) · [A role that is removed](#a-role-that-is-removed) ·
[External sign-in](#external-sign-in) · [What is enforced where](#what-is-enforced-where)

## The built-in roles

Every site has these, whatever the config says:

| Role | Can |
|---|---|
| **Administrator** | everything, plus people (invite, change role, disable, remove), the audit log and privacy |
| **Editor** | create, edit, publish and delete all content; edit site settings; every file in the media library |
| **Author** | create drafts; edit and delete only what they created; never publish, never touch settings or content that is live the moment it is saved; change only the files they uploaded |

**Only the administrator manages people.** That does not depend on a role's name or on what it
is based on: no role you define can invite, remove or change anyone.

## Roles of your own

A custom role **extends a built-in one** (`from: 'editor'` or `from: 'author'`) and narrows it,
or for an author widens it, one collection at a time. It can never be, or extend, `admin`.

<!-- check: roles/cms.config.ts -->
```ts
import { defineEntity, defineLocales, defineRoles, defineSingleton, f } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

// Export it from cms.config.ts, above the entities that name the roles.
export const roles = defineRoles({
  translator: {
    from: 'editor',
    label: { cs: 'Překladatel', en: 'Translator' },   // shown in Team, the account menu and invitations
    description: { en: 'Translates posts and pages; drafts only.' },
    entities: { post: ['read', 'update'], page: ['read', 'update'] },
    publish: false,
    media: 'own',
  },
  // Looks after the people who write: no media library, no say over the site name.
  curator: {
    from: 'editor',
    entities: { author: ['read', 'create', 'update', 'delete'], post: ['read'] },
    media: 'none',
  },
})

export const Author = defineEntity('author', {
  label: 'Authors',
  titleField: 'name',
  fields: {
    name: f.text({ required: true }),
    // Editors and curators read the email, only editors change it; everyone else does not see it.
    email: f.text({ format: 'email' }).optional().access({ read: ['editor', roles.curator], edit: ['editor'] }),
  },
})

export const Post = defineEntity('post', {
  label: 'Posts',
  titleField: 'title',
  fields: {
    title: f.text({ required: true }).localized(),
    // Translators write the text but cannot change the code the site's template reads.
    template: f.text().optional().access({ edit: ['editor'] }),
  },
})

export const Page = defineEntity('page', { label: 'Pages', titleField: 'title', fields: { title: f.text({ required: true }) } })
export const Settings = defineSingleton('settings', { label: 'Settings', titleField: 'name', fields: { name: f.text({ required: true }).access({ edit: ['editor'] }) } })
```

| Setting | Meaning |
|---|---|
| `from` | `'editor'` (every entry of every collection) or `'author'` (drafts, and only own entries). Required |
| `label`, `description` | the role's name and one sentence, one string or one per admin language |
| `entities` | what the role may do with a collection, by its name: `read`, `create`, `update`, `delete`. A collection listed gets **exactly** these operations (`['read']` reads, `[]` does not see it at all); one left out is **what `from` allows**. Anything but `read` needs `read` too. A global has `read` and `update` only |
| `publish` | may publish and unpublish, and change what is live. Default: what `from` has (editor yes, author no). A role that may not publish writes drafts only, and cannot change an entry that is live, or write content that is live the moment it is saved (a global, redirects) |
| `media` | the media library: `'all'`, `'own'` or `'none'` ([below](#the-media-library)). Default: what `from` has |

**Publish rights are role-wide.** `publish` is one switch for the whole site, also when an entity [publishes each language on its own](content-model.md#publishing-each-language-on-its-own): a role cannot be allowed to publish one language only.

A few things follow from "extends":

- **A role based on `author` keeps "own entries only".** It changes and deletes only what it created, on every collection it
  can write. A grant on a global has no owner to ask, so it applies to the one row.
- **A role left out of an entity's list gets what its parent has.** A translator based on editor that does not
  list `tag` can read tags; list `tag: []` to take them away, or `tag: ['read']` to say so. Form messages
  are an editor's to read, so a role based on editor reads them unless you narrow it.
- **The entity's own `access` rule still applies on top** of all this ([row-level rules](#row-level-rules)).

The names are checked when the config loads, with the collection or the field in the message:
a role named like a built-in, one that extends `admin`, a collection the site does not have, an
operation a global cannot have, or `update` without `read`.

## Per-field permissions

Each field can say who **reads** it and who **edits** it, by role:

```ts
body:  f.richtext().access({ edit: ['editor', roles.translator] }),   // the others see it, read-only
cost:  f.number().access({ read: ['editor'], edit: ['editor'] }),     // the others do not see it at all
```

- A list names the roles that may. A role missing from it does not see the field (`read`) or sees it
  read-only (`edit`). A rule left out means everyone who may read (or write) the collection.
- **Administrators always may.** Editing needs reading: a role in `edit` must be able to read, and the
  config is refused when it names one that cannot.
- Your own roles are named by their reference (`roles.translator`, so a typo is a compile error); the
  built-ins are plain strings (`'editor'`). A role is named exactly: a custom role that extends editor does
  not get a field because `'editor'` is listed. That is on purpose: a new role starts with nothing a field
  is closed to.
- It is for a field of a collection or global, not for one inside a block, a list or a group. Put it on the
  group, list or blocks field itself.
- **The title, the publish state and date, the address (`content.slug` and what `content.path` uses), the place in a
  tree and the list's order field cannot be hidden** (`read`): every screen of the admin shows them. They can be
  made read-only.

### What the server does

It enforces the rules on everything the admin does; the form only follows.

**Reading** — a field a role may not read is left out of the answer, and out of everything that could show it:

| Where | What |
|---|---|
| a list, one entry, the answer to a save, a global | the field (and its relation or file attachments) is not in the row |
| the list's search, its sort and its filters | never by a field the person may not read |
| the CSV export | no column |
| history (the list, a version, what changed) | the field is not in the snapshots or in "what changed" |
| the admin search (⌘K) | an entry is not found through text in a field the person may not read, and no excerpt shows it |
| where a file or an entry is used, what links to an entry, the refusal to delete something that is used | an entry that holds it only in a field the person may not read is counted, not named |
| the admin's schema (`/api/cms/_graph`) | the field is not in it, nor in the list columns, tabs and sections; one that is read-only is marked `readOnly: true` (a `CmsAdminField`), and a [custom field renderer](admin.md#extensibility--the-field--view-registry) receives it as its `readOnly` prop |
| a draft preview through the content API (`?preview`, signed in) | the page without those fields |

**Writing** — a request that names a field the person may not edit is **refused with `403`** and
`{ code: 'field_forbidden', fields: [...] }`, and nothing in it is saved. It is refused even when the value is the one
the field has now: a client leaves the fields it may not change out (the admin does), instead of having
a value dropped without a word. This covers creating, saving, a translation, the position a drag writes (arranging a
list, moving a page), and removing a translation (which removes every translated field of it).

An omitted field is never overwritten: saving an entry changes the fields it names; saving a global
(which replaces it) leaves a field the person may not edit as it is, with no default put in its place. Creating an entry
is the one place a default applies to such a field (a new post starts as a draft), and a required field with no
default that the person may not write makes creating refuse with a normal validation error: the person
cannot make that kind of entry.

**Shared editing** — a rich-text field with an `.access()` rule is **not edited together** with others: the
shared document is one for everyone who has the entry open, so it would show the field to people who may not read
it. Such a field is edited alone and saved the usual way. (A shared document made before a field got a rule is
started afresh the next time it is opened.)

**The public content API is not touched.** It follows `content.hidden` and `content.published`, as before: a field
that visitors must not see is hidden there, whatever the admin's rules say.

## The media library

`media` says what a role may do with the library:

| | Browse | Upload | Change details, delete | Where it is used |
|---|---|---|---|---|
| `'all'` | every file | yes | every file | yes |
| `'own'` | every file | yes | only the files they uploaded | yes |
| `'none'` | no | no | no | no |

`'none'` closes the library (and its page in the admin): nothing to list, upload, change or delete. Pictures
already on an entry stay as they are, shown with it, and are not cleaned up on that person's behalf. Whoever may
not change every file (`'own'`, `'none'`) can only clean up the files they uploaded themselves.

## Row-level rules

An entity's `access` still adds rules about *which* entries, on top of the role. Each is a function of the
signed-in person and the table. The person has `role` (the name stored for them) and **`base`**, the built-in
role they are or extend. Test `base` to treat a custom role like its parent:

```ts
access: {
  read: ({ user, table }) => (user.base === 'author' ? not(ilike(table.title, 'Interní%')) : true),
},
```

A rule on `user.role === 'author'` does not see a custom role built on author; `user.base === 'author'` does.

## A role that is removed

Take a role out of `cms.config.ts` and the people who had it keep their accounts and **lose all access**
(it fails closed, nothing is guessed):

- they sign in, and the admin shows **"Your role no longer exists"** with their account page and sign-out; every
  other request is refused with `403` and `{ code: 'role-removed' }` (the content API does not show them drafts either);
- **Settings → Team** marks each of them, and an administrator gives them another role;
- `tinyzoo status` warns, with how many people hold the missing role, before anyone finds out by being locked out.

Define the role again and they are back, as they were: the name stored with a person is all that connects them.
(The roles are not stored anywhere else: `cms_users.role` is a text column, so adding or removing a role needs no migration.)

## External sign-in

With `cms.auth.mode: 'external'` your app signs people in and sets their `role`; the names it uses map onto the
same definitions: the built-ins, and the roles from `defineRoles`.

- On a site that **defines roles**, every name must be known. A name the site does not define has no access, like a removed role.
- On a site that **defines none**, a name the CMS does not know acts as it always did: it reaches every
  collection and the entities' own `access` rules decide, it may publish, and it is never an administrator.
  Add `defineRoles` to get the stricter behaviour.

## What is enforced where

| | Entity (read / create / update / delete) | `publish` | `media` | A field (read / edit) |
|---|---|---|---|---|
| lists, entries, globals, options of a picker | ✓ | | | read ✓ |
| create, save, global save, translations, arranging, moving | ✓ | ✓ | | edit ✓ |
| history, export, search, links, "used by" | ✓ | | | read ✓ |
| the realtime feeds and the home page | ✓ | | | titles and states only, never a field |
| shared editing (socket) | ✓ (write or read) | ✓ | | fields with a rule are not shared |
| the media library and where a file is used | | ✓ (public details of a live file) | ✓ | read ✓ |
| people, privacy, audit | administrator only | | | |

Every request re-reads the account: changing someone's role, removing the role from the config or disabling them takes effect
on their next request, and ends an open realtime or shared-editing connection.
