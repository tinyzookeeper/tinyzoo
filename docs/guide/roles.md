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
[Changing someone's role](#changing-someones-role) · [External sign-in](#external-sign-in) ·
[Worked example: a translator](#worked-example-a-translator) · [What is enforced where](#what-is-enforced-where)

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
| `label`, `description` | the role's name and one sentence, one string or one per admin language. Without a `description` the admin describes the role from this definition ([below](#how-the-admin-shows-a-role)) |
| `entities` | what the role may do with a collection, by its name: `read`, `create`, `update`, `delete`. A collection listed gets **exactly** these operations (`['read']` reads, `[]` does not see it at all); one left out is **what `from` allows**. Anything but `read` needs `read` too. A global has `read` and `update` only |
| `publish` | may publish and unpublish, and change what is live. Default: what `from` has (editor yes, author no). A role that may not publish writes drafts only, and cannot change an entry that is live, or write content that is live the moment it is saved (a global, redirects). Publish is also offered only to a role that may edit the entity's status field and its publish date (a publish writes both): put a field rule on one of them and add the roles that should publish |
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

### How the admin shows a role

Settings → Team names each role in the invitation and in "Change role" with one sentence: your `description`, or,
when you wrote none, a sentence made from the definition, in the admin's language: what the role changes, what it
only reads, whether it publishes, and its files. For the translator above without its description:

> Edits Posts and Pages. Only reads Authors, Tags and 2 more. Cannot publish: drafts only. Changes only the files they uploaded.

It is worked out from the same rules the server applies (the role, then each entity's own `access` rule), so it
also says what a role reaches through what it inherits: a role based on editor that does not list a collection
edits it, and a role that may not publish only reads content that is live the moment it is saved (a global, the
redirects). **What can each role do?** on the Team page shows every role side by side, built-in ones included:
what it changes, what it only reads, whether it publishes, its files, and how many people have it.

## Per-field permissions

Each field can say who **reads** it and who **edits** it, by role:

```ts
body:  f.richtext().access({ edit: ['editor', roles.translator] }),   // the others see it, read-only
cost:  f.number().access({ read: ['editor'], edit: ['editor'] }),     // the others do not see it at all
```

- A list names the roles that may. A role missing from it does not see the field (`read`) or sees it
  read-only (`edit`). A rule left out means everyone who may read (or write) the collection.
- A read-only field looks locked in the admin (a grey fill and a lock in the field) and says who can change it,
  by the roles' labels: "Only Editor and Administrator can change this." Name the roles you want people to ask.
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

## Changing someone's role

An administrator changes a role in Settings → Team (**Change role**, with the same sentence per role as the
invitation). The change **signs the person out on every device**: their sessions end, an open realtime or
shared-editing connection is closed, and they sign in again with the new role. Unsaved changes in an editor they had
open are lost, so tell them first. Nobody can change their own role, and the last active administrator cannot be
moved to another role. The audit log records the change (`user.role`, from and to).

## External sign-in

With `cms.auth.mode: 'external'` your app signs people in and sets their `role`; the names it uses map onto the
same definitions: the built-ins, and the roles from `defineRoles`.

- On a site that **defines roles**, every name must be known. A name the site does not define has no access, like a removed role.
- On a site that **defines none**, a name the CMS does not know acts as it always did: it reaches every
  collection and the entities' own `access` rules decide, it may publish, and it is never an administrator.
  Add `defineRoles` to get the stricter behaviour.

## Worked example: a translator

A site in Czech and English. Editors write posts in Czech and publish them. A translator writes the English
versions, and an editor decides when they go live. The translator must not change what all languages share (the
category), nor touch anything else on the site.

<!-- check: translator/cms.config.ts -->
```ts
import { defineEntity, defineLocales, defineRoles, eq, f } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

export const roles = defineRoles({
  translator: {
    from: 'editor',
    label: { cs: 'Překladatel', en: 'Translator' },
    description: { cs: 'Překládá články; jen koncepty.', en: 'Translates posts; drafts only.' },
    // Every collection is listed: one left out would get what an editor has.
    entities: { post: ['read', 'update'], tag: ['read'] },
    publish: false,
    media: 'none',
  },
})

export const Tag = defineEntity('tag', {
  label: { cs: 'Štítky', en: 'Tags' },
  titleField: 'name',
  fields: { name: f.text({ required: true }).localized() },
})

export const Post = defineEntity('post', {
  label: { cs: 'Články', en: 'Posts' },
  titleField: 'title',
  fields: {
    title: f.text({ required: true }).localized(),
    slug: f.slug({ from: 'title', unique: true }).localized(),
    body: f.richtext().localized(),
    // Shared by every language. Editors choose it; the translator sees it locked.
    category: f.select({ options: ['news', 'event'] as const, default: 'news' }).access({ edit: ['editor'] }),
    status: f.select({ options: ['draft', 'published'] as const, default: 'draft' }),
    publishedAt: f.datetime().optional(),
  },
  publish: {
    field: 'status', publishedValue: 'published', draftValue: 'draft',
    dateField: 'publishedAt',
    perLocale: true,   // each language has its own state; the default language gates them
  },
  content: { public: true, published: (t) => eq(t.status, 'published'), slug: 'slug', path: '/blog/:slug' },
})
```

`perLocale` adds three columns to `post_locales`: run `pnpm db:generate`, read the migration, `pnpm db:migrate`,
then give the person the role in Settings → Team.

**What the translator sees.** Under their name, *Translator*. In a post's English version:

- every field not translated yet shows the Czech text greyed inside it, with one line at the top saying so (*Empty fields show the Czech text in grey until you translate them*) and *Use it as a start* at each field (which copies the Czech text in), and the body offers *Show the original beside it* (Czech
  on the left, the translation on the right, on a wide screen);
- the category has a grey fill and a lock, and under it *Only Editor and Administrator can change this*;
- the top bar says *English · Being translated* for an English version that has never been on the website (the
  tooltip: *Visitors see the Czech version until an editor publishes this one.*), or *English · Draft* once an editor
  took it off, or *English · Waiting for Czech*, with *Save translation*, and no Publish;
- the media library is not in the sidebar, and pictures already on a post still show.

**What the editor sees.** The list's Languages column shows EN with a mark (a dot when it is on the website, a
ring for a draft, a clock when scheduled, an hourglass when it is published but waiting for Czech, a languages mark
when it is being translated; the tooltip says it in words). The home page's drafts and the search say *English · Being
translated* too. In the English version, Publish… opens *Publish the English version* (*Until now visitors see the
Czech version here. The other languages stay as they are.* for one being translated), with the fields still in Czech
listed, and, while Czech is a draft, *Czech is still a draft*: the English goes on the website together with Czech. Settings → Team → *What can each role do?* shows the translator's row: *Changes*
Posts, *Only reads* Tags, *Publishes* No, drafts only, *Files* None.

**Two things to know before you set this up:**

- **A role cannot be limited to one language.** `entities` and `.access()` hold for an entry in every language, so
  the translator above can also change the Czech text of a post **while it is a draft**. A live Czech version they
  cannot change: a role that may not publish never changes what is live.
- **Translating a post that is already live just works.** The translator opens its English version and saves: the
  English is *being translated*, a draft that has never been on the website. Visitors on `/en` keep reading the Czech
  text exactly as before (the item, the lists, the search, the sitemap, links to it), and no webhook says anything
  changed. The translator saves as often as needed (and may remove it again); an editor reads it in the preview and
  publishes it, and from then on English is live on its own, so it is the editors' to change or take off. A post that
  is still a draft works as before: the English follows the draft and goes live with Czech. What stays locked for the
  translator is what visitors see: an English version that is live (published, or a translation that follows a live
  Czech version), publishing, scheduling, unpublishing, and removing an English version an editor took off (that
  would put the Czech text back on `/en`). Without `perLocale` none of this exists: every language of a live post is
  live, and a role with `publish: false` can only translate drafts.

The editors' guide says the same for the people doing it: [Překlady](../editors/cs/preklady.md#každý-jazyk-zvlášť) and
[Role a oprávnění](../editors/cs/role-a-opravneni.md).

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
