import { defineBlock, defineEntity, defineLocales, defineNavigation, definePages, defineRedirects, defineRoles, defineSingleton, eq, f, seo } from 'tinyzoo'

// The typed config of the 1.0 freeze: every field factory and every option of it, every
// option of an entity, a global and the presets, written once. From it:
//   - test/unit/surface-types.spec.ts asserts what is inferred (Row, Insert, Update, the
//     client's types), so a type regression fails `pnpm typecheck`;
//   - test/unit/api-surface.spec.ts keeps the generated client types, the OpenAPI document
//     and the admin graph in test/contracts/surface.* as golden files.
// Adding a field type or an option to the public API: add it here too. See "Contracts" in
// CONTRIBUTING.md.

export const locales = defineLocales({ default: 'cs', locales: ['cs', 'en', 'de'], labels: { de: 'Deutsch' }, prefix: 'except-default' })

/** A role of the site's own: it extends a built-in one. Defined above what names it (`.access()`, `entities`). */
export const roles = defineRoles({
  translator: {
    from: 'editor',
    label: { en: 'Translator', cs: 'Překladatel' },
    description: 'Writes the translations; does not publish.',
    entities: { event: ['read', 'update'], category: ['read'] },
    publish: false,
    media: 'own',
  },
})

/** A block with every kind of field a block may hold, a list and a group among them. */
export const feature = defineBlock({
  label: { en: 'Feature', cs: 'Vlastnost' },
  description: 'A picture with a heading and a few bullet points.',
  icon: 'i-lucide-sparkles',
  version: 2,
  upgrade: (data, from) => (from === 1 ? { ...data, heading: data.title, title: undefined } : data),
  fields: {
    heading: f.text({ required: true }),
    level: f.number({ min: 1, max: 6 }),
    featured: f.boolean(),
    shownFrom: f.datetime(),
    tone: f.select({ options: ['plain', 'accent'] as const, default: 'plain' }),
    text: f.richtext(),
    picture: f.media({ accept: 'image/*' }).optional(),
    bullets: f.list({ fields: { line: f.text({ required: true }), strong: f.boolean() }, max: 12, itemType: 'bullet' }),
    cta: f.group({ fields: { label: f.text({ required: true }), url: f.text({ format: 'link' }) } }).optional(),
  },
})

export const quote = defineBlock({
  label: 'Quote',
  fields: { text: f.text({ required: true, multiline: true, max: 400 }), by: f.text().optional() },
})

/** A layout: lists two levels deep (a group of blocks among its blocks), settings after the content, a choice as segments. */
export const layout = defineBlock({
  label: { en: 'Layout', cs: 'Rozvržení' },
  icon: 'i-lucide-layout-grid',
  fields: {
    items: f.blocks({ quote, group: defineBlock({ label: 'Group', fields: { items: f.blocks({ quote }) } }) }),
    arrangement: f.select({ options: ['row', 'stack', 'grid'] as const, icons: { row: 'i-lucide-columns-3', stack: 'i-lucide-rows-3' }, segments: true }).setting(),
    space: f.select({ options: ['small', 'medium', 'large'] as const }).setting().label({ en: 'Space between' }),
  },
})

export const Category = defineEntity('category', {
  label: { en: 'Categories', cs: 'Kategorie' },
  labelSingular: 'Category',
  description: 'Groups events.',
  icon: 'i-lucide-tag',
  titleField: 'name',
  admin: { list: { columns: ['name', 'color'], searchable: ['name'], orderField: 'order', layout: 'table' } },
  fields: {
    name: f.text({ required: true }).localized().label({ en: 'Name' }),
    slug: f.slug({ from: 'name', unique: true }).localized(),
    color: f.color({ required: true }),
    order: f.number({ int: true }).optional(),
    events: f.relation({ to: () => Event, kind: 'one-to-many', inverseOf: 'category' }),
  },
  content: { public: true, hidden: ['order'] },
})

export const Event = defineEntity('event', {
  label: { en: 'Events', cs: 'Akce' },
  labelSingular: { en: 'Event', cs: 'Akce' },
  description: { en: 'What happens, and when.', cs: 'Co se děje a kdy.' },
  icon: 'i-lucide-calendar',
  titleField: 'title',
  live: false,
  admin: {
    list: { columns: ['title', 'status', 'startsAt', 'category'], searchable: ['title', 'place'], layout: 'dated' },
    editor: 'form',
    preview: '/events/:slug',
    tabs: [{ label: { en: 'Text' }, fields: ['body', 'blocks'] }, { label: 'Pictures', fields: ['cover', 'gallery'] }],
    sections: [
      { label: { en: 'When?' }, icon: 'i-lucide-calendar', description: 'Date and time.', fields: ['startsAt', 'allDayFrom'], columns: 2 },
      { label: { en: 'Where?' }, fields: ['place', 'contact'], columns: 1 },
    ],
  },
  access: { read: () => true, update: ({ user, table }) => eq(table.createdBy, user.id) },
  content: {
    public: true,
    published: (t) => eq(t.status, 'published'),
    slug: 'slug',
    path: { cs: '/akce/:slug', en: '/events/:slug', de: '/veranstaltungen/:slug' },
    populate: ['cover', 'category', 'tags', 'gallery', 'file'],
    hidden: ['internalNote'],
    search: { fields: ['title', 'perex'] },
  },
  publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', dateField: 'publishedAt', schedule: true, preview: '/events/:slug', perLocale: true },
  fields: {
    // text: every option
    title: f.text({ required: true, max: 120 }).localized().label({ en: 'Title', cs: 'Název' }).help('Shown everywhere.').position('main'),
    perex: f.text({ multiline: true, max: 300 }).optional().localized(),
    email: f.text({ format: 'email' }).optional(),
    web: f.text({ format: 'url' }).optional().icon('i-lucide-globe'),
    oldPath: f.text({ format: 'path' }).optional(),
    link: f.text({ format: 'link' }).optional(),
    place: f.text().optional(),
    // a field with its own access rules, chained with a label: the roles are references, so a typo does not compile
    internalNote: f.text().optional().access({ read: ['editor', roles.translator], edit: ['editor'] }).label({ en: 'Internal note' }),
    // slug
    slug: f.slug({ from: 'title', unique: true }).localized().position('sidebar'),
    // numbers, switches, dates
    seats: f.number({ int: true, min: 0, max: 10_000 }),
    price: f.number({ int: false, min: 0 }).optional(),
    rating: f.number().withDefault(3),
    free: f.boolean({ default: true }),
    consent: f.boolean({ mustBeTrue: true }),
    startsAt: f.datetime(),
    publishedAt: f.datetime({ default: 'now' }).optional(),
    allDayFrom: f.datetime({ allDay: true }).optional(),
    // select: options, default, labels, icons
    status: f.select({
      options: ['draft', 'published', 'cancelled'] as const,
      default: 'draft',
      labels: { draft: { en: 'Draft', cs: 'Koncept' }, published: 'Published' },
      icons: { cancelled: 'i-lucide-ban' },
    }),
    kind: f.select({ options: ['talk', 'workshop'] as const }),
    level: f.select({ options: ['easy', 'hard'] as const }).optional(),
    // rich text, blocks, lists, groups
    body: f.richtext().localized(),
    blocks: f.blocks({ feature, quote }).localized().group('Content'),
    schedule: f.list({
      fields: { at: f.text({ required: true }), what: f.text(), room: f.select({ options: ['a', 'b'] as const }) },
      max: 30,
      itemLabel: { en: 'Slot', cs: 'Položka' },
      version: 1,
    }),
    faq: f.list({ fields: { q: f.text({ required: true }), a: f.richtext() }, itemType: 'qa' }).localized(),
    contact: f.group({
      fields: {
        phone: f.text(),
        address: f.group({ fields: { street: f.text({ required: true }), city: f.text({ required: true }) } }).optional(),
        photo: f.media().optional(),
        hours: f.list({ fields: { days: f.text({ required: true }), hours: f.text() } }),
      },
    }).optional().localized(),
    // files
    cover: f.media({ accept: 'image/*' }).optional(),
    mandatoryCover: f.media(),
    file: f.file({ accept: 'application/pdf' }).optional(),
    gallery: f.gallery({ accept: 'image/*', max: 40 }),
    color: f.color().optional(),
    // relations
    category: f.relation({ to: () => Category, kind: 'many-to-one', required: true }),
    venue: f.relation({ to: () => Venue, kind: 'many-to-one', onDelete: 'cascade' }),
    tags: f.relation({ to: () => Category, kind: 'many-to-many', through: 'event_tags' }),
    related: f.relation({ to: () => Event, kind: 'many-to-many' }),
    ...seo({ localized: true }),
  },
})

export const Venue = defineEntity('venue', {
  label: 'Venues',
  titleField: 'name',
  fields: {
    name: f.text({ required: true }),
    events: f.relation({ to: () => Event, kind: 'one-to-many', inverseOf: 'venue' }),
  },
  content: { public: true, search: false },
})

export const Page = definePages({ blocks: { feature, quote, layout }, localized: true, tree: { maxDepth: 5 }, path: { cs: '/:slug', en: '/en/:slug', de: '/de/:slug' } })

export const Settings = defineSingleton('settings', {
  label: { en: 'Settings' },
  titleField: 'siteName',
  admin: { editor: 'preview', preview: '/', sections: [{ label: 'General', fields: ['siteName'] }] },
  fields: {
    siteName: f.text({ required: true }),
    logo: f.media({ accept: 'image/*' }).optional(),
    accent: f.color().optional(),
    ...seo(),
  },
  content: { public: true, populate: ['logo'] },
})

export const Navigation = defineNavigation({ menus: { main: { en: 'Main menu', cs: 'Hlavní menu' }, footer: 'Footer' }, localized: true })
export const Redirects = defineRedirects()
