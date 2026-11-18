# Recipes

Ten things clients ask for most. Each recipe gives the `cms.config.ts`, the page that shows
it on the website, and a note for the editor. Start here once you have finished
[Getting started](getting-started.md) and have a site running.

## How to use a recipe

1. Copy the config. Each one is a whole `cms.config.ts` with its imports. In a site you
   already have, add the new entities, `defineLocales` (once) and `plugins` to your file.
   Do not paste a second copy.
2. Run `pnpm db:generate` and read the migration it writes. Then run `pnpm db:migrate`.
   A new entity only adds tables, so the migration is safe on a site with content.
3. Run `pnpm cms:client`, so the typed client knows the new entity. It writes
   `app/lib/cms-content.ts`.
4. Add the page. The pages use the typed client: `cms.teamMember.list()` returns
   `TeamMember[]`, and a wrong field name or sort key is a compile error. The starter's own
   pages read the API with plain `useFetch`. Both work.
5. Tell the editor what you set up. The *Editor note* of each recipe answers the
   questions that come next.

Every config and script on this page is checked when the docs are built. It is loaded,
turned into a schema and a typed client, and type-checked, so these examples do not drift
from the code. [CONTRIBUTING.md](../../CONTRIBUTING.md#the-docs-check) explains how.

### The client on every page

Every page you build makes the client the same way:

```ts
const cms = createClient({ baseUrl: useRequestURL().origin })
```

`useRequestURL().origin` is the site's own address, so the request goes to the same
server on the server and in the browser. `useAsyncData` keeps the result between the
server render and the browser.

### Keys

Every `useAsyncData` and `useFetch` call has a key. Two calls with the same key share one
result.

The starter already uses these keys, so never reuse them:

- `site-settings` and `site-nav`, in `useSite()`
- `site:<address>`, for the page being shown

Say a recipe's call stored a different shape under `site-settings`. The layout could not
read it, and the page would answer 500. So the keys in this page are named after what they
hold (`opening-hours`, `team`, `faq`, and so on). Name yours the same way.

### Languages

The recipes that translate content use the starter's `useSiteLocale()`, in
`app/composables/useSite.ts`. It says `'en'` under `/en/…`, and the site's first language
(`'cs'` in the starter) otherwise. The languages are in `app/utils/site.ts`.

Replace it with your own if your site is not made from the starter. The recipes that show
one language leave it out.

Contents: [contact form](#1-a-contact-form) · [news](#2-news) · [team page](#3-a-team-page) ·
[FAQ](#4-questions-and-answers) · [opening hours](#5-opening-hours-and-closures) ·
[photo gallery](#6-a-photo-gallery) · [documents](#7-documents-to-download) ·
[partners](#8-partners-and-logos) · [events](#9-events-with-dates) ·
[menus with dropdowns](#10-menus-with-dropdowns)

---

## 1. A contact form

**The client asks:** visitors should write to them from the website, and the messages
should arrive by email and in the admin.

### Config

Forms are a plugin (`tinyzoo/forms`). Register it and define the form as an entity. Add the
settings screen where editors choose who is told.

<!-- check: contact/cms.config.ts -->
```ts
import { f } from 'tinyzoo'
import { defineForm, defineFormSettings, formsPlugin } from 'tinyzoo/forms'

export const plugins = [formsPlugin()]

export const ContactForm = defineForm('contactForm', {
  label: { en: 'Contact form', cs: 'Kontaktní formulář' },
  labelSingular: { en: 'Message', cs: 'Zpráva' },
  fields: {
    name: f.text({ required: true, max: 200 }).label({ en: 'Your name', cs: 'Vaše jméno' }),
    email: f.text({ required: true, format: 'email' }).label({ en: 'Email', cs: 'E-mail' }),
    phone: f.text().optional().label({ en: 'Phone', cs: 'Telefon' }),
    topic: f.select({
      options: ['question', 'order', 'other'] as const,
      default: 'question',
      labels: {
        question: { en: 'A question', cs: 'Dotaz' },
        order: { en: 'An order', cs: 'Objednávka' },
        other: { en: 'Something else', cs: 'Něco jiného' },
      },
    }).label({ en: 'What is it about?', cs: 'O co jde?' }),
    message: f.text({ required: true, multiline: true, max: 5000 }).label({ en: 'Message', cs: 'Zpráva' }),
    // `mustBeTrue`: the form cannot be sent without the box ticked.
    consent: f.boolean({ mustBeTrue: true }).label({ en: 'I agree to the processing of my details', cs: 'Souhlasím se zpracováním údajů' }),
  },
  submitLabel: { en: 'Send', cs: 'Odeslat' },
  successMessage: { en: 'Thank you, we will reply soon.', cs: 'Děkujeme, brzy se ozveme.' },
  retentionDays: 180,
})

// Editors choose who gets an email about new messages (the "Forms" settings screen).
export const FormSettings = defineFormSettings()
```

### The page

One component does everything. It fetches the form's description and draws the fields in
the visitor's language. It shows errors per field, then replaces itself with the thank-you
message.

<!-- check: contact/app/pages/contact.vue -->
```vue
<script setup lang="ts">
const locale = useSiteLocale()
</script>

<template>
  <section class="mx-auto max-w-xl px-4 py-12">
    <h1 class="text-3xl font-bold">{{ locale === 'en' ? 'Contact us' : 'Napište nám' }}</h1>
    <CmsForm name="contactForm" :locale="locale" class="mt-8" />
  </section>
</template>
```

### Editor note

- Messages land under *Contact form* in the sidebar.
- They are personal data, so only editors and administrators see them. Authors do not.
- Each message has a state: *New* (Nové), *Read* (Přečtené) or *Done* (Vyřízené).
- **Export CSV** downloads the whole list for a spreadsheet.
- Who gets the email is set in **Forms → Send new messages to** (Formuláře → Nové zprávy
  posílat na).
- Messages are deleted after `retentionDays` (180 here). The admin says so under the list.

### Details

**Who is emailed.** If nobody is set in the admin, the addresses in `notify: { to: [...] }`
of the form are used. After that comes `NUXT_CMS_FORMS_NOTIFY_TO`.

**Retention.** Without `retentionDays`, messages are kept until someone deletes them. Set it
to what the privacy policy promises.

**How `<CmsForm>` looks.**

- It makes plain HTML: `label`, `input`, `textarea`, `select` and a button.
- Its default styles sit in the lowest CSS layer, so your own CSS wins without a fight.
- The styles follow the text colour, so they read on a dark page too.
- A choice with a `default` opens on it, and a required field has a `*`.
- When the server refuses a field, the form shows the reason under it in the visitor's
  language (*Vyberte jednu z možností.*), with a red border.
- To restyle the refused state, style `[aria-invalid='true']` or set `--cms-form-error`.

- Emails need a mail transport. In development they are printed to the server log. In
  production set `NUXT_CMS_MAIL_TRANSPORT=smtp` and the `NUXT_CMS_MAIL_SMTP_*` variables
  ([deploying.md](../deploying.md#environment)).
- Spam is kept out by four checks: a hidden field, a minimum time to fill the form in, a
  rate limit per visitor, and a same-site check.
- For more, set `NUXT_CMS_FORMS_TURNSTILE_SECRET` and `NUXT_PUBLIC_CMS_TURNSTILE_SITE_KEY`.
  Cloudflare Turnstile is then used as well.
- A form field can be text (also `format: 'email'`, `multiline`), number, yes/no, a choice
  or a date. Relations and media are not allowed in a form.
- The word *topic* above is an ordinary choice field. Add as many as the client needs.
- The state column (`status`) is added for you and is reserved.

---

## 2. News

**The client asks:** to post articles with a title, a picture, a summary, a text and a date,
and to write some ahead so they appear on a chosen day.

### Config

This is the starter's news collection. Czech is the default language. English is a
translation of the fields marked `.localized()`.

<!-- check: news/cms.config.ts -->
```ts
import { defineEntity, defineLocales, eq, f, seo } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

export const News = defineEntity('news', {
  label: { en: 'News', cs: 'Aktuality' },
  labelSingular: { en: 'News item', cs: 'Aktualita' },
  icon: 'i-lucide-newspaper',
  titleField: 'title',
  admin: { list: { columns: ['cover', 'title', 'status', 'publishedAt'] } },
  fields: {
    title: f.text({ required: true }).localized().label({ en: 'Title', cs: 'Název' }),
    slug: f.slug({ from: 'title', unique: true }).localized().label({ en: 'URL address', cs: 'Adresa (URL)' }),
    status: f.select({
      options: ['draft', 'published'] as const,
      default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: { en: 'Published', cs: 'Zveřejněno' } },
    }).label({ en: 'Status', cs: 'Stav' }),
    publishedAt: f.datetime().optional().label({ en: 'Publish date', cs: 'Datum zveřejnění' }),
    cover: f.media({ accept: 'image/*' }).optional().label({ en: 'Cover photo', cs: 'Úvodní fotka' }),
    perex: f.text({ multiline: true, max: 300 }).optional().localized().label({ en: 'Summary', cs: 'Perex' }),
    body: f.richtext().localized().label({ en: 'Text', cs: 'Text' }),
    ...seo({ localized: true }),
  },
  publish: {
    field: 'status', publishedValue: 'published', draftValue: 'draft',
    dateField: 'publishedAt',
    preview: { cs: '/aktuality/:slug', en: '/news/:slug' },
  },
  content: {
    public: true,
    published: (table) => eq(table.status, 'published'),
    slug: 'slug',
    path: { cs: '/aktuality/:slug', en: '/news/:slug' },
    populate: ['cover', 'ogImage'],
  },
})
```

Four things carry the behaviour:

- `publish` gives the editor *Publish* and *Unpublish* buttons, and a **Preview** button
  that opens `preview` with `?preview`.
- `dateField` is stamped when the entry is published. A date in the **future** schedules
  it: the entry goes live at that moment.
- `content.published` is the rule the public API applies. Only published entries are
  served, and a scheduled one is hidden until its time.
- `content.path` puts every published news item into `/sitemap.xml`. It adds `hreflang`
  alternates when the item has a translation. It also tells webhooks which addresses changed.

### The page

The list is paged, newest first:

<!-- check: news/app/pages/aktuality/index.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const route = useRoute()
const locale = useSiteLocale()
const page = computed(() => Number(route.query.page) || 1)
const limit = 12

const { data } = await useAsyncData(
  'news-list',
  () => cms.news.list({ locale: locale.value, page: page.value, limit, sort: 'publishedAt', dir: 'desc' }),
  { watch: [page, locale] },
)
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / limit)))
const prefix = computed(() => (locale.value === 'en' ? '/en/news/' : '/aktuality/'))
const date = (iso: string) => new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'cs-CZ', { dateStyle: 'long' }).format(new Date(iso))
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-12">
    <h1 class="text-3xl font-bold">{{ locale === 'en' ? 'News' : 'Aktuality' }}</h1>
    <ul class="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="n in data?.items" :key="n.id">
        <NuxtLink :to="prefix + n.slug">
          <CmsImage v-if="n.cover" :media="n.cover" class="aspect-[3/2] w-full rounded-lg object-cover" />
          <p v-if="n.publishedAt" class="mt-3 text-sm text-muted">{{ date(n.publishedAt) }}</p>
          <h2 class="text-lg font-semibold">{{ n.title }}</h2>
          <p v-if="n.perex" class="text-muted">{{ n.perex }}</p>
        </NuxtLink>
      </li>
    </ul>
    <nav v-if="pages > 1" class="mt-10 flex justify-between">
      <NuxtLink v-if="page > 1" :to="{ query: { page: page - 1 } }">←</NuxtLink><span v-else />
      <span>{{ page }} / {{ pages }}</span>
      <NuxtLink v-if="page < pages" :to="{ query: { page: page + 1 } }">→</NuxtLink><span v-else />
    </nav>
  </section>
</template>
```

One item, with a proper 404 when the slug does not exist:

<!-- check: news/app/pages/aktuality/[slug].vue -->
```vue
<script setup lang="ts">
import { CmsError } from '@tinyzoo/client'
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const route = useRoute()
const locale = useSiteLocale()
const slug = String(route.params.slug)

const { data: item } = await useAsyncData(`news-${slug}-${locale.value}`, async () => {
  try {
    return await cms.news.get(slug, { locale: locale.value })
  } catch (err) {
    if (err instanceof CmsError && err.status === 404) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
    throw err
  }
})
useCmsSeo(() => item.value, { descriptionField: 'perex', imageField: 'cover' })
</script>

<template>
  <article v-if="item" class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-4xl font-bold">{{ item.title }}</h1>
    <p v-if="item.perex" class="mt-4 text-lg text-muted">{{ item.perex }}</p>
    <CmsImage v-if="item.cover" :media="item.cover" eager class="mt-8 w-full rounded-xl" />
    <CmsContent :doc="item.body" class="prose mt-8 max-w-none" />
  </article>
</template>
```

`/api/content/news/<slug>` finds an item by its slug **in the language asked for**
(`locale`). It falls back to the default language's slug. So the page's `locale` must
match the address the visitor used.

### Editor note

Editors write in the *Write* view: one calm column for the text, with the properties beside
it.

To schedule an article, set **Publish date** in the future and press **Schedule**
(Naplánovat). The article shows as *Scheduled* until then.

Each language is chosen with the language switcher in the editor. The English text starts
empty, and the Czech one is shown until it is written
([translations](content-model.md#languages)).

### Details

- The typed client does not do **draft preview**. `?preview` needs the editor's cookie, and
  the client has no option for it.
- The starter's catch-all page uses `useFetch` with `query: { preview: '' }` for exactly
  this. Keep `useFetch` on the pages an editor will preview, or add that page next to the
  typed one.
- `limit` is at most 100. Page through `total` for more.
- `sort` only accepts what the generated types list (`createdAt`, `updatedAt`, `title`,
  `slug`, `status`, `publishedAt`, …). A media, rich-text, group or relation field cannot
  be sorted on.

---

## 3. A team page

**The client asks:** for a "who we are" page with a photo, a name, a role and a short bio,
in an order they choose.

### Config

This is the `teamMember` of
[Getting started](getting-started.md#6-your-first-collection-team-members), with an email
added and a longer `bio`.

If you built that one, add only `email` to it. A new optional column is a safe migration.
Keep `bio` as it is.

Do not paste a second definition with a different type for `bio` (rich text instead of
plain text). That would ask Postgres to change the column's type, which it cannot do
without a conversion ([Changing a field's type](../upgrading.md#changing-a-fields-type)).

<!-- check: team/cms.config.ts -->
```ts
import { defineEntity, defineLocales, f } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

export const TeamMember = defineEntity('teamMember', {
  label: { en: 'Team', cs: 'Tým' },
  labelSingular: { en: 'Team member', cs: 'Člen týmu' },
  description: { en: 'The people shown on the Team page, in this order.', cs: 'Lidé na stránce Tým, v tomto pořadí.' },
  icon: 'i-lucide-users',
  titleField: 'name',
  // `orderField` turns on "Arrange": editors drag people into the order the website uses.
  admin: { list: { columns: ['photo', 'name', 'role'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Jméno' }),
    role: f.text({ required: true }).localized().label({ en: 'Role', cs: 'Funkce' }),
    photo: f.media({ accept: 'image/*' }).optional().label({ en: 'Photo', cs: 'Fotka' }),
    bio: f.text({ multiline: true, max: 400 }).optional().localized().label({ en: 'A few words', cs: 'Pár slov' }),
    email: f.text({ format: 'email' }).optional().label({ en: 'Email', cs: 'E-mail' }),
    position: f.number().optional().label({ en: 'Order', cs: 'Pořadí' }),
  },
  content: { public: true },
})
```

- `position` is the order. It is hidden from the form, so the editor never types a number.
- Make it `.optional()`. A new person can then be saved before anyone arranged the list, and
  is placed last.
- The entity is called `teamMember`, not `team`. `team` is one of the names the admin keeps
  for itself (Settings → Team), and a reserved name stops the build with a message that
  says so.

### The page

Nothing sorts here. With an `orderField` and no `sort`, the API returns the editors' order.

<!-- check: team/app/pages/team.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const locale = useSiteLocale()

const { data: team } = await useAsyncData(
  'team',
  () => cms.teamMember.list({ locale: locale.value, limit: 100 }).then((r) => r.items),
  { default: () => [], watch: [locale] },
)
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-12">
    <h1 class="text-3xl font-bold">{{ locale === 'en' ? 'Our team' : 'Náš tým' }}</h1>
    <ul class="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="person in team" :key="person.id">
        <CmsImage v-if="person.photo" :media="person.photo" sizes="(min-width: 1024px) 20rem, 50vw" class="aspect-square w-full rounded-xl object-cover" />
        <h2 class="mt-3 text-lg font-semibold">{{ person.name }}</h2>
        <p class="text-muted">{{ person.role }}</p>
        <p v-if="person.bio" class="mt-2 text-sm">{{ person.bio }}</p>
        <a v-if="person.email" :href="`mailto:${person.email}`">{{ person.email }}</a>
      </li>
    </ul>
  </section>
</template>
```

### Editor note

- In the list, **Arrange** (Seřadit) lets the editor drag people, or use the arrows.
  **Save order** (Uložit pořadí) stores it.
- Photos are cropped by the site (`object-cover`).
- In the media library the editor can click the picture where it must stay in view, for
  example a face. This is the *focal point*. `<CmsImage>` keeps that spot visible however
  the crop changes.

### Details

- **A longer, formatted bio** is `f.richtext()` instead of the short text. Draw it with
  `<CmsContent :doc="person.bio" class="prose" />`.
- On a site that already has people, that changes the column's type (text to JSON). Follow
  [Changing a field's type](../upgrading.md#changing-a-fields-type). It has the `USING`
  conversion the generated migration lacks. Or add the rich field next to the old one and
  move the texts over.
- Arranging works for up to 100 entries. The admin says so when there are more.
- Everyone you save is public at once, because the collection has no `status`. To hide
  someone without deleting them, add a `status` and `publish` as in [News](#2-news).

---

## 4. Questions and answers

**The client asks:** for a page of frequent questions that they can edit themselves.

There are two ways to hold the questions. Pick by who changes them and where they appear.

| | One entity (first) | A list inside a page block (second) |
|---|---|---|
| Good for | one FAQ page, or the same answers on several pages | answers that belong to one page |
| Editors find it | in the sidebar, with search, order and categories | inside the page, next to its other blocks |
| Reuse | any page can show any question | none |
| Cost | one more table | none (it is part of the page's JSON) |

### Config: an entity with categories

The answer is rich text. A category is optional.

<!-- check: faq/cms.config.ts -->
```ts
import { defineEntity, defineLocales, f } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

export const FaqCategory = defineEntity('faqCategory', {
  label: { en: 'Question topics', cs: 'Témata dotazů' },
  labelSingular: { en: 'Topic', cs: 'Téma' },
  icon: 'i-lucide-folder',
  titleField: 'name',
  admin: { list: { columns: ['name'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).localized().label({ en: 'Name', cs: 'Název' }),
    position: f.number().optional(),
  },
  content: { public: true },
})

export const Faq = defineEntity('faq', {
  label: { en: 'Questions', cs: 'Časté dotazy' },
  labelSingular: { en: 'Question', cs: 'Dotaz' },
  icon: 'i-lucide-circle-help',
  titleField: 'question',
  admin: { list: { columns: ['question', 'category'], orderField: 'position' } },
  fields: {
    question: f.text({ required: true }).localized().label({ en: 'Question', cs: 'Otázka' }),
    answer: f.richtext().localized().label({ en: 'Answer', cs: 'Odpověď' }),
    // A relation is optional unless you say `required: true`.
    category: f.relation({ to: () => FaqCategory, kind: 'many-to-one' }).label({ en: 'Topic', cs: 'Téma' }),
    position: f.number().optional(),
  },
  content: { public: true, populate: ['category'] },
})
```

### The page

Group the questions by topic. Native `<details>` is an accordion with no JavaScript.

<!-- check: faq/app/pages/faq.vue -->
```vue
<script setup lang="ts">
import { createClient, type Faq } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const locale = useSiteLocale()

const { data: questions } = await useAsyncData(
  'faq',
  () => cms.faq.list({ locale: locale.value, limit: 100 }).then((r) => r.items),
  { default: () => [] as Faq[], watch: [locale] },
)

// Topics in the order the questions come, questions without a topic last.
const topics = computed(() => {
  const groups = new Map<string, { title: string; items: Faq[] }>()
  for (const q of questions.value) {
    const key = q.category?.id ?? ''
    const group = groups.get(key) ?? { title: q.category?.name ?? '', items: [] }
    group.items.push(q)
    groups.set(key, group)
  }
  return [...groups.values()]
})
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold">{{ locale === 'en' ? 'Questions' : 'Časté dotazy' }}</h1>
    <div v-for="topic in topics" :key="topic.title" class="mt-8">
      <h2 v-if="topic.title" class="text-xl font-semibold">{{ topic.title }}</h2>
      <details v-for="q in topic.items" :key="q.id" class="border-b border-default py-3">
        <summary class="cursor-pointer font-medium">{{ q.question }}</summary>
        <CmsContent :doc="q.answer" class="prose mt-2" />
      </details>
    </div>
  </section>
</template>
```

To show one topic only, filter on the server: `cms.faq.list({ filter: { category: id } })`.
A many-to-one relation is a typed filter.

### The other way: a list in a page block

When the answers belong to one page, add a block to `definePages` and let the editor write
them in place. The items are the block's JSON. There is no table and no sidebar entry, and
you cannot reuse the items elsewhere.

<!-- check: faq-block/cms.config.ts -->
```ts
import { defineBlock, defineLocales, definePages, f } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

const questions = defineBlock({
  label: { en: 'Questions and answers', cs: 'Otázky a odpovědi' },
  icon: 'i-lucide-circle-help',
  fields: {
    heading: f.text().label({ en: 'Heading', cs: 'Nadpis' }),
    items: f.list({
      fields: {
        question: f.text({ required: true }).label({ en: 'Question', cs: 'Otázka' }),
        answer: f.richtext().label({ en: 'Answer', cs: 'Odpověď' }),
      },
      max: 30,
      itemLabel: { en: 'Question', cs: 'Otázka' },
    }).label({ en: 'Questions', cs: 'Otázky' }),
  },
})

export const Page = definePages({ blocks: { questions }, localized: true })
```

The block is drawn by `app/components/global/BlockQuestions.vue`. A block of type
`questions` goes to `Block` + `Questions`. Its props are typed from the generated client:

<!-- check: faq-block/app/components/global/BlockQuestions.vue -->
```vue
<script setup lang="ts">
import type { Page } from '~/lib/cms-content'

defineProps<{ block: Extract<Page['sections'][number], { type: 'questions' }> }>()
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-10">
    <h2 v-if="block.heading" class="text-2xl font-semibold">{{ block.heading }}</h2>
    <details v-for="item in block.items" :key="item.id" class="border-b border-default py-3">
      <summary class="cursor-pointer font-medium">{{ item.question }}</summary>
      <CmsContent :doc="item.answer" class="prose mt-2" />
    </details>
  </section>
</template>
```

### Editor note

- **With the entity**, editors arrange the questions with **Arrange** and pick a topic from
  a menu.
- **With the block**, they add *Questions and answers* to a page with **Add block**
  (Přidat blok). Then they press **Add item** (Přidat položku) for each question, and drag
  items to reorder.

### Details

- A list holds up to `max` items (500 when you leave it out), and items cannot hold another
  list.
- If you later want the questions on several pages, move them to the entity. There is no
  automatic conversion. Copy them across and remove the block.

---

## 5. Opening hours and closures

**The client asks:** for regular opening hours in the footer, and a list of days when they
are closed.

### Config

Both live in one global, the **site settings**. A global is a single record with one form
and no list ([globals](content-model.md#globals)).

<!-- check: hours/cms.config.ts -->
```ts
import { defineSingleton, f } from 'tinyzoo'

export const SiteSettings = defineSingleton('siteSettings', {
  label: { en: 'Site settings', cs: 'Nastavení webu' },
  icon: 'i-lucide-settings-2',
  titleField: 'siteName',
  fields: {
    siteName: f.text({ required: true }).label({ en: 'Site name', cs: 'Název webu' }),
    openingHours: f.list({
      fields: {
        days: f.text({ required: true }).label({ en: 'Days', cs: 'Dny' }),
        hours: f.text().label({ en: 'Hours', cs: 'Hodiny' }),
      },
      max: 14,
      itemLabel: { en: 'Opening hours', cs: 'Otevírací doba' },
    }).label({ en: 'Opening hours', cs: 'Otevírací doba' })
      .help({ en: 'One line per group of days, e.g. "Mon–Fri" and "7:00–17:00".', cs: 'Jeden řádek na skupinu dní, např. „Po–Pá“ a „7:00–17:00“.' }),
    closures: f.list({
      fields: {
        from: f.datetime({ allDay: true }).label({ en: 'From', cs: 'Od' }),
        to: f.datetime({ allDay: true }).label({ en: 'To (last day)', cs: 'Do (poslední den)' }),
        reason: f.text().label({ en: 'Reason', cs: 'Důvod' }),
      },
      max: 50,
      itemLabel: { en: 'Closure', cs: 'Zavřeno' },
    }).label({ en: 'Days we are closed', cs: 'Kdy máme zavřeno' }),
  },
  content: { public: true },
})
```

### The page

Read the global once and show both lists. Closures that are over drop out by themselves.

<!-- check: hours/app/components/OpeningHours.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
// Its own key: `site-settings` belongs to the starter's useSite() and holds another shape.
const { data: settings } = await useAsyncData('opening-hours', () => cms.global('siteSettings'))

const DAY = 86_400_000
// All-day dates are stored at midnight (in the admin's time zone), so a closure lasts
// until a day after its last date.
const closures = computed(() => (settings.value?.closures ?? [])
  .filter((c) => c.from && new Date(c.to ?? c.from).getTime() + DAY > Date.now()))
const day = (iso: string) => new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long', timeZone: 'Europe/Prague' }).format(new Date(iso))
</script>

<template>
  <div>
    <dl v-if="settings?.openingHours.length" class="grid grid-cols-[auto_1fr] gap-x-4">
      <template v-for="row in settings.openingHours" :key="row.id">
        <dt class="text-muted">{{ row.days }}</dt>
        <dd>{{ row.hours }}</dd>
      </template>
    </dl>
    <ul v-if="closures.length" class="mt-4">
      <li v-for="c in closures" :key="c.id">
        {{ day(c.from!) }}<template v-if="c.to"> – {{ day(c.to) }}</template><template v-if="c.reason">: {{ c.reason }}</template>
      </li>
    </ul>
  </div>
</template>
```

### Editor note

- The form has two lists, each with **Add item**.
- The "All day" switch on the dates hides the time.
- A closure is something the client adds a week ahead and forgets. It disappears from the
  website after its last day, without anyone removing it.

### Details

- The hours are **text**, not times. tinyzoo does not compute "open now". If the website
  should say it, that logic is yours. You will need the hours in a form you can parse, for
  example two `f.text()` fields for opening and closing time per row.
- Set the date fields' time zone in `app.config.ts` with `cms.admin.timeZone` (default
  `Europe/Prague`). Then "midnight" means the client's midnight.
- Add `.localized()` to the list if the day names differ per language ("Po–Pá" and
  "Mon–Fri"). It needs `defineLocales`, and the list then gets a translation per language.

---

## 6. A photo gallery

**The client asks:** for albums from events and trips, each with a cover, a title, a date and
many photos with captions.

### Config

<!-- check: gallery/cms.config.ts -->
```ts
import { defineEntity, f } from 'tinyzoo'

export const Album = defineEntity('album', {
  label: { en: 'Photo albums', cs: 'Fotogalerie' },
  labelSingular: { en: 'Album', cs: 'Album' },
  icon: 'i-lucide-images',
  titleField: 'title',
  // A picture first and no rich-text body: the list is a grid of covers.
  admin: { list: { columns: ['cover', 'title', 'takenAt'] } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    takenAt: f.datetime().optional().label({ en: 'Date', cs: 'Datum' }),
    cover: f.media({ accept: 'image/*' }).optional().label({ en: 'Cover photo', cs: 'Titulní fotka' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Description', cs: 'Popis' }),
    photos: f.gallery({ max: 200 }).label({ en: 'Photos', cs: 'Fotky' })
      .help({ en: 'Shown in this order. Drag to rearrange; add a caption under each.', cs: 'Zobrazí se v tomto pořadí. Přetažením je přeuspořádáte, pod každou může být popisek.' }),
  },
  content: { public: true, slug: 'slug', path: '/foto/:slug' },
})
```

### The page

The list of albums, and one album. Each photo is the full media object (`url`, `width`,
`height`, `alt`, `focal`) plus its `caption`.

<!-- check: gallery/app/pages/foto/index.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const { data: albums } = await useAsyncData(
  'albums',
  () => cms.album.list({ sort: 'takenAt', dir: 'desc', limit: 48 }).then((r) => r.items),
  { default: () => [] },
)
</script>

<template>
  <ul class="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
    <li v-for="album in albums" :key="album.id">
      <NuxtLink :to="`/foto/${album.slug}`">
        <CmsImage v-if="album.cover" :media="album.cover" class="aspect-[4/3] w-full rounded-lg object-cover" />
        <h2 class="mt-2 font-semibold">{{ album.title }}</h2>
      </NuxtLink>
    </li>
  </ul>
</template>
```

<!-- check: gallery/app/pages/foto/[slug].vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const slug = String(useRoute().params.slug)
const { data: album } = await useAsyncData(`album-${slug}`, () => cms.album.get(slug))
</script>

<template>
  <section v-if="album" class="mx-auto max-w-5xl px-4 py-12">
    <h1 class="text-3xl font-bold">{{ album.title }}</h1>
    <p v-if="album.description" class="mt-2 text-muted">{{ album.description }}</p>
    <ul class="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
      <li v-for="photo in album.photos" :key="photo.id">
        <a :href="photo.url">
          <CmsImage :media="photo" sizes="(min-width: 768px) 20rem, 50vw" class="aspect-square w-full rounded-lg object-cover" />
        </a>
        <p v-if="photo.caption" class="mt-1 text-sm text-muted">{{ photo.caption }}</p>
      </li>
    </ul>
  </section>
</template>
```

`<CmsImage>` does five things:

- It writes the description as `alt`.
- It sets the real size, so the page does not jump.
- It lazy-loads.
- It serves smaller copies to smaller screens.
- It applies the focal point as `object-position` when the image is cropped.

### Editor note

In the gallery field the editor drops many files at once and drags them into order. They
type a caption under each (**Caption**, Popisek).

Tell them first: the **image description** (alt text) is set in the media library, once per
file (**Image description**, Popis obrázku). It is for people who cannot see the photo, and
Google reads it too. A caption is for everyone, and is per album.

### Details

- A gallery holds up to `max` photos (200 by default). A larger archive belongs in many
  albums.
- Photos are files in the media library. A photo used in two albums is one file, kept while
  anything uses it. A file uploaded in the library itself is only removed by deleting it
  there.
- There is no lightbox. The link above opens the original file. A lightbox is a frontend
  library you add to the site.

---

## 7. Documents to download

**The client asks:** to publish price lists, forms, minutes and rules as PDFs, and to update
them a few times a year.

### Config

<!-- check: downloads/cms.config.ts -->
```ts
import { defineEntity, f } from 'tinyzoo'

export const Download = defineEntity('download', {
  label: { en: 'Documents', cs: 'Dokumenty' },
  labelSingular: { en: 'Document', cs: 'Dokument' },
  icon: 'i-lucide-file-text',
  titleField: 'title',
  admin: { list: { columns: ['title', 'category', 'file'], orderField: 'position' } },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
    category: f.select({
      options: ['forms', 'rules', 'reports'] as const,
      default: 'forms',
      labels: {
        forms: { en: 'Forms', cs: 'Formuláře' },
        rules: { en: 'Rules', cs: 'Pravidla' },
        reports: { en: 'Reports', cs: 'Výroční zprávy' },
      },
    }).label({ en: 'Category', cs: 'Kategorie' }),
    // `f.file()` accepts PDF by default; `f.file({ accept: '…' })` changes it.
    file: f.file().label({ en: 'File (PDF)', cs: 'Soubor (PDF)' }),
    note: f.text().optional().label({ en: 'Note', cs: 'Poznámka' })
      .help({ en: 'Shown beside the title, e.g. "valid from 1 March" or "240 kB".', cs: 'Zobrazí se u názvu, např. „platné od 1. března“ nebo „240 kB“.' }),
    position: f.number().optional(),
  },
  content: { public: true },
})
```

### The page

Group by category and link to the file. The API gives the file's `url` and `mime`. It does
not give a size or a file name, so use `title` and, when you want a size, the `note`.

<!-- check: downloads/app/pages/documents.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const { data: documents } = await useAsyncData(
  'documents',
  () => cms.download.list({ limit: 100 }).then((r) => r.items),
  { default: () => [] },
)
const categories = [
  { key: 'forms', title: 'Formuláře' },
  { key: 'rules', title: 'Pravidla' },
  { key: 'reports', title: 'Výroční zprávy' },
] as const
const inCategory = (key: (typeof categories)[number]['key']) => documents.value.filter((d) => d.category === key)
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold">Ke stažení</h1>
    <template v-for="c in categories" :key="c.key">
      <div v-if="inCategory(c.key).length" class="mt-8">
        <h2 class="text-xl font-semibold">{{ c.title }}</h2>
        <ul>
          <li v-for="d in inCategory(c.key)" :key="d.id" class="py-1">
            <a :href="d.file?.url" download>{{ d.title }}</a>
            <span class="text-sm text-muted"> · PDF<template v-if="d.note"> · {{ d.note }}</template></span>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
```

### Editor note

- The editor uploads the PDF in the document's form, or picks one from the library
  (**Choose from library**, Vybrat z knihovny).
- To replace a document, press **Replace** (Vyměnit) on the same entry. The page and its
  place in the list stay.
- The admin shows the file's name, its size and a button to open it.

### Details

- **Uploaded files are public by their address.** Anyone who has the address can open the
  file, and a search engine that finds the address will list it. Do not upload anything
  that must stay private.
- A new upload gets a new address. Files never change under an address, so a CDN can keep
  them forever.
- So replacing a document changes its link. A link typed into a text by hand goes stale.
  The website does not, because it reads the address from the API.
- Only the file types the server allows can be uploaded: images (JPG, PNG, WebP, GIF, AVIF),
  PDF, MP4/WebM video and MP3. The admin names them when a file is refused.

---

## 8. Partners and logos

**The client asks:** for a strip of logos of sponsors, customers or members, in a chosen
order, each possibly linking to its website.

### Config

<!-- check: partners/cms.config.ts -->
```ts
import { defineEntity, f } from 'tinyzoo'

export const Partner = defineEntity('partner', {
  label: { en: 'Partners', cs: 'Partneři' },
  labelSingular: { en: 'Partner', cs: 'Partner' },
  icon: 'i-lucide-handshake',
  titleField: 'name',
  // The logo leads the list and there is no rich-text body: the list is a grid of logos.
  admin: { list: { columns: ['logo', 'name', 'url'], orderField: 'position' } },
  fields: {
    name: f.text({ required: true }).label({ en: 'Name', cs: 'Název' }),
    logo: f.media({ accept: 'image/*' }).label({ en: 'Logo', cs: 'Logo' }),
    url: f.text({ format: 'url' }).optional().label({ en: 'Website', cs: 'Web' })
      .help({ en: 'A full address, https://…', cs: 'Celá adresa, https://…' }),
    contract: f.text({ multiline: true }).optional().label({ en: 'Internal note', cs: 'Interní poznámka' })
      .help({ en: 'For the team only: never shown on the website.', cs: 'Jen pro tým: na webu se nikdy nezobrazí.' }),
    position: f.number().optional(),
  },
  // `hidden` leaves a field out of every public answer, also when a partner is shown
  // inside another entry.
  content: { public: true, hidden: ['contract'] },
})
```

### The page

<!-- check: partners/app/components/PartnerLogos.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const { data: partners } = await useAsyncData(
  'partners',
  () => cms.partner.list({ limit: 100 }).then((r) => r.items),
  { default: () => [] },
)
</script>

<template>
  <ul class="flex flex-wrap items-center gap-x-10 gap-y-6">
    <li v-for="p in partners" :key="p.id">
      <a v-if="p.url" :href="p.url" target="_blank" rel="noopener">
        <CmsImage :media="p.logo" :alt="p.name" sizes="10rem" class="h-12 w-auto object-contain" />
      </a>
      <CmsImage v-else :media="p.logo" :alt="p.name" sizes="10rem" class="h-12 w-auto object-contain" />
    </li>
  </ul>
</template>
```

Passing `:alt="p.name"` overrides the stored description. A logo's useful alt text is the
name of the company, whatever the editor typed in the library.

### Editor note

- The list is a grid of logos. **Arrange** (Seřadit) works as for the team.
- Tell the client which formats work: **PNG, WebP, JPG, GIF or AVIF, not SVG**.
- SVG files can carry scripts, so the server does not accept them.
- A logo exported as PNG at twice its display size looks sharp.

### Details

- `content.hidden` is a deny-list: list every field that must not be public. A field you
  add later is public until you list it.
- To split partners into groups (gold, silver), add an `f.select` and filter with
  `cms.partner.list({ filter: { tier: 'gold' } })`. Choice fields are typed filters.

---

## 9. Events with dates

**The client asks:** for a calendar of races, workshops or meetings, each with a date, a
place and a link.

### Config

<!-- check: events/cms.config.ts -->
```ts
import { defineEntity, f } from 'tinyzoo'

export const Event = defineEntity('event', {
  label: { en: 'Events', cs: 'Akce' },
  labelSingular: { en: 'Event', cs: 'Akce' },
  icon: 'i-lucide-calendar-days',
  titleField: 'title',
  admin: {
    // No `publish` and a date column: the list opens as "Upcoming" and "Past".
    list: { columns: ['title', 'startsAt', 'place'] },
    // The form reads as three short questions.
    sections: [
      { label: { en: 'When?', cs: 'Kdy?' }, icon: 'i-lucide-calendar', fields: ['startsAt', 'endsAt'] },
      { label: { en: 'Where?', cs: 'Kde?' }, icon: 'i-lucide-map-pin', fields: ['place'] },
      { label: { en: 'More', cs: 'Další informace' }, fields: ['description', 'link'] },
    ],
  },
  fields: {
    title: f.text({ required: true }).label({ en: 'Title', cs: 'Název' }),
    slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)' }),
    // "All day" switch in the editor; an all-day value is stored at 0:00.
    startsAt: f.datetime({ allDay: true }).label({ en: 'Starts', cs: 'Začíná' }),
    endsAt: f.datetime({ allDay: true }).optional().label({ en: 'Ends', cs: 'Končí' }),
    place: f.group({
      fields: {
        name: f.text({ required: true }).label({ en: 'Place', cs: 'Místo' }),
        address: f.text().label({ en: 'Address', cs: 'Adresa' }),
        mapUrl: f.text({ format: 'url' }).label({ en: 'Map link', cs: 'Odkaz na mapu' }),
      },
    }).optional().label({ en: 'Place', cs: 'Místo konání' }),
    description: f.text({ multiline: true }).optional().label({ en: 'Description', cs: 'Popis' }),
    link: f.text({ format: 'link' }).optional().label({ en: 'More information', cs: 'Další informace' }),
  },
  content: { public: true, slug: 'slug', path: '/akce/:slug' },
})
```

### The page

Ask for what is still ahead, soonest first. Date fields have range filters,
`'<field>.from'` and `'<field>.to'`:

<!-- check: events/app/pages/akce/index.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const DAY = 86_400_000

const { data: events } = await useAsyncData(
  'events-upcoming',
  () => cms.event.list({
    // A typo such as 'startAt.from' is a compile error: filters are typed.
    filter: { 'startsAt.from': new Date(Date.now() - DAY) },
    sort: 'startsAt',
    dir: 'asc',
    limit: 50,
  }).then((r) => r.items),
  { default: () => [] },
)
// An all-day event is stored at midnight, so it stays for the day it ends.
const upcoming = computed(() => events.value.filter((e) => new Date(e.endsAt ?? e.startsAt).getTime() + DAY > Date.now()))
const when = (iso: string) => new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'full', timeZone: 'Europe/Prague' }).format(new Date(iso))
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-3xl font-bold">Co se chystá</h1>
    <ul class="mt-8 divide-y divide-default">
      <li v-for="e in upcoming" :key="e.id" class="py-4">
        <NuxtLink :to="`/akce/${e.slug}`" class="font-semibold">{{ e.title }}</NuxtLink>
        <p class="text-muted">
          {{ when(e.startsAt) }}<template v-if="e.endsAt"> – {{ when(e.endsAt) }}</template>
          <template v-if="e.place"> · {{ e.place.name }}</template>
        </p>
      </li>
    </ul>
    <p v-if="!upcoming.length" class="mt-8 text-muted">Zatím nic nechystáme.</p>
  </section>
</template>
```

For a calendar archive, ask for the past the same way, with `'startsAt.to': new Date()`
and `dir: 'desc'`.

### Editor note

- The list opens as **Upcoming** (Nadcházející) and **Past** (Proběhlé).
- The form has the three questions as headings. Empty optional fields wait behind
  **+ Add …**.
- For a one-day event the editor leaves **Ends** empty.

### Details

- A bare date in a filter (`'2026-03-01'`) is a whole day in **UTC**. A time without an
  offset is UTC too. Pass a `Date` or an ISO string with an offset to be exact.
- The list is ordered by when events **start**. An event that started last week and runs
  all month is "past" by this query. Show such long events from a second query, or give
  them a start date that keeps them in view.
- There is no calendar file (`.ics`) export. Add a server route that builds one from
  `cms.event.list` if the client wants it.

---

## 10. Menus with dropdowns

**The client asks:** for a main menu with a few dropdowns and a footer menu, which they can
change without calling you.

### Config

<!-- check: menus/cms.config.ts -->
```ts
import { defineBlock, defineLocales, defineNavigation, definePages, defineRedirects, f } from 'tinyzoo'

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en'] })

const text = defineBlock({
  label: { en: 'Text', cs: 'Text' },
  icon: 'i-lucide-text',
  fields: { body: f.richtext().label({ en: 'Text', cs: 'Text' }) },
})

// Pages can sit under pages (`tree: true`), and the menu can link to any of them.
export const Page = definePages({ blocks: { text }, localized: true, tree: true })

// Two menus by default (main, footer); name your own with `menus: { … }`.
export const Navigation = defineNavigation({
  localized: true,
  menus: {
    main: { en: 'Main menu', cs: 'Hlavní menu' },
    footer: { en: 'Footer menu', cs: 'Menu v patičce' },
  },
})

// Old addresses keep working when a page is moved or renamed.
export const Redirect = defineRedirects()
```

### The page

Read the menu and nest it. A link the editor marked **Under the link above** (Pod odkazem
nad ním) goes into the dropdown of the link before it:

<!-- check: menus/app/layouts/default.vue -->
```vue
<script setup lang="ts">
import { cmsMenuTree } from '@tinyzoo/client'
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const locale = useSiteLocale()
const { data: nav } = await useAsyncData('navigation', () => cms.global('navigation', { locale: locale.value }), { watch: [locale] })

// [{ label, url, children: [{ label, url, … }] }, …]
const main = computed(() => cmsMenuTree(nav.value?.main))
</script>

<template>
  <header>
    <ul>
      <li v-for="link in main" :key="link.id">
        <NuxtLink v-if="link.url" :to="siteHref(link.url)">{{ link.label }}</NuxtLink>
        <span v-else>{{ link.label }}</span>
        <ul v-if="link.children.length">
          <li v-for="child in link.children" :key="child.id">
            <NuxtLink :to="siteHref(child.url!)">{{ child.label }}</NuxtLink>
          </li>
        </ul>
      </li>
    </ul>
  </header>
</template>
```

`siteHref()` is the starter's, in `app/utils/site.ts`. It exists because of the home page:

- The page whose address is `home` is at `/home` in the content API.
- So a menu link picked from the page list comes out as `/home`.
- The website sends the visitor on to `/` with a redirect, and `/en/home` to `/en`.

Writing the link as `/` instead of `/home` saves the hop and keeps the menu's "current
page" marking right. `siteHref` does this for every link, so the editor can keep picking the
home page from the list.

A site that does not come from the starter does the same with
`url.replace(/^((?:\/[a-z]{2})?)\/home$/, '$1') || '/'`.

#### Without your own markup

`<CmsNav :links="nav?.main" />` does the same nesting. It makes
`<nav class="cms-nav"><ul><li class="cms-nav__has-children"><a>…</a><ul><li><a>…</a></li></ul></li></ul></nav>`.

Style it like any list. The starter's `app/layouts/default.vue` has a complete example. Its
dropdown opens on hover or keyboard focus and folds behind a button on phones.

#### Links follow their page

When the editor picks a page from the link picker, the menu stores a reference to it, not
its address. The content API turns it into the page's **current address in the language
asked for**. So renaming, moving or translating a page never breaks the menu.

- A link to a page that was deleted or is not published comes back with `url: null`.
  `cmsMenuTree` and `<CmsNav>` leave it out. A heading whose dropdown still works stays,
  without a link.
- Addresses typed by hand (`/cenik`, `https://…`, `mailto:`, `tel:`) are kept as typed.

See [links that follow their target](content-model.md#links-that-follow-their-page).

#### Pages under pages instead of a hand-made menu

With `tree: true` the site can build navigation from the page tree itself:

<!-- check: menus/app/components/PageTree.vue -->
```vue
<script setup lang="ts">
import { createClient } from '~/lib/cms-content'

const cms = createClient({ baseUrl: useRequestURL().origin })
const locale = useSiteLocale()

// Live pages in the editors' order: [{ id, title, path, children: [...] }]
const { data: tree } = await useAsyncData('page-tree', () => cms.page.tree({ locale: locale.value }), { default: () => [], watch: [locale] })

// A page, with its trail: breadcrumbs go from the top of the tree to the page itself.
const { data: team } = await useAsyncData('team-page', () => cms.page.get('o-nas/tym', { locale: locale.value }))
</script>

<template>
  <div>
    <nav aria-label="Breadcrumbs">
      <NuxtLink v-for="crumb in team?.breadcrumbs" :key="crumb.path" :to="crumb.path">{{ crumb.title }} / </NuxtLink>
    </nav>
    <ul>
      <li v-for="page in tree" :key="page.id">
        <NuxtLink v-if="page.path" :to="page.path">{{ page.title }}</NuxtLink>
        <ul v-if="page.children.length">
          <li v-for="child in page.children" :key="child.id"><NuxtLink v-if="child.path" :to="child.path">{{ child.title }}</NuxtLink></li>
        </ul>
      </li>
    </ul>
  </div>
</template>
```

Which one to use:

- A **menu** is what the client chooses to show and in what order. It can have external
  links and links that open in a new tab.
- The **tree** is the structure of the site itself. Every live page appears.
- Moving a page in the admin changes its place in a navigation built from the tree. It
  also changes its address and the addresses of the pages under it, with redirects.

Many sites use the tree for the sitemap and breadcrumbs, and a menu for the header. Details:
[pages under pages](content-model.md#presets).

### Editor note

- **Navigation** has one form with a list per menu.
- For each link the editor picks a page (or types an address) and writes the text. They may
  tick **Open in a new tab** or **Under the link above**.
- Links are dragged to reorder.
- In the page tree, **Move…** in a page's menu (or dragging) changes where it sits. The
  admin says how many addresses changed and whether redirects were made.

### Details

- A dropdown is one level deep. A `sub` link goes under the nearest top-level link above
  it. Deeper nesting is what the page tree is for.
- A top-level link needs an address to be shown, unless it has working dropdown links.
- If the first link in a menu is marked "under the link above", there is nothing above it,
  so it stays on top.
- A site with no `defineRedirects()` gets no redirects when pages move. Add it.

---

Next: [content model](content-model.md) for every field type and option used above,
[deploying](../deploying.md) when the site goes live, and [upgrading](../upgrading.md)
when a recipe needs to change after launch.
