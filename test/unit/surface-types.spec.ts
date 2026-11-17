import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  buildRegistry, defineBlock, defineCmsPlugin, defineEntity, defineLocales, defineRoles, defineSeed, defineSingleton, eq, f,
  type BlocksValue, type CmsAccessUser, type CmsAdminField, type CmsBlock, type CmsFieldCellProps, type CmsFieldEditProps, type CmsGalleryValue, type CmsListValue, type Entity,
  type EntityDef, type FieldDescriptor, type Insert, type RichTextDoc, type Row, type SeedContext, type Update,
} from 'tinyzoo'
import { formsPlugin, defineForm, defineFormSettings } from 'tinyzoo/forms'
import { createCmsClient, cmsMenuTree, type CmsClient, type CmsError, type CmsMenuItem, type CmsMenuLink, type ListParams, type ListResponse } from '@tinyzoo/client'
import { createClient, type Category as CategoryItem, type ContentSchema, type Event as EventItem, type GlobalSchema, type Page as PageItem, type Settings as SettingsItem } from '../contracts/surface.client-types'
import { Category, Event, Page, Settings, Venue } from '../contracts/surface/cms.config'
import * as surface from '../contracts/surface/cms.config'

// Typed-config golden test: the types a site's code sees, for a config that uses every field
// and option (test/contracts/surface/cms.config.ts). The assertions are checked by
// `pnpm typecheck` (tsc), not at run time: change a field's inferred type, the shape of Row,
// Insert or Update, or a type of the generated client, and a line here stops compiling.
// `@ts-expect-error` lines must keep failing: they prove a type is not looser than it should be.
// See "Contracts" in CONTRIBUTING.md.

type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T]
type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>

type Feature = BlocksValue<{ feature: typeof surface.feature; quote: typeof surface.quote }>

describe('Row: what a select returns, at the database keys', () => {
  type EventRow = Row<typeof Event>

  it('has the system columns, every scalar at its key, and a foreign key at `<key>Id`', () => {
    expectTypeOf<EventRow>().toEqualTypeOf<{
      // system columns
      id: string
      createdAt: Date
      updatedAt: Date
      createdBy: string | null
      updatedBy: string | null
      // f.text and its formats
      title: string
      perex: string | null
      email: string | null
      web: string | null
      oldPath: string | null
      link: string | null
      place: string | null
      internalNote: string | null
      // f.slug
      slug: string
      // f.number, f.boolean, f.datetime
      seats: number
      // a decimal (`int: false`) is a string, as the database and the content API give it
      price: string | null
      rating: number
      free: boolean
      consent: boolean
      startsAt: Date
      publishedAt: Date | null
      allDayFrom: Date | null
      // f.select: the union of the options (`.optional()` adds null)
      status: 'draft' | 'published' | 'cancelled'
      kind: 'talk' | 'workshop'
      level: 'easy' | 'hard' | null
      // f.richtext, f.blocks, f.list, f.group
      body: RichTextDoc
      blocks: BlocksValue<{ feature: typeof surface.feature; quote: typeof surface.quote }>
      schedule: CmsListValue<{ at: FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: false }>; what: FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: false }>; room: FieldDescriptor<{ out: 'a' | 'b'; in: 'a' | 'b'; col: 'scalar'; optionalIn: false }> }>
      faq: CmsListValue<{ q: FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: false }>; a: FieldDescriptor<{ out: RichTextDoc; in: RichTextDoc; col: 'scalar'; optionalIn: false }> }, 'qa'>
      contact: Row<typeof Event>['contact']
      // f.media, f.file, f.gallery, f.color: a picture is `<key>Id`
      coverId: string | null
      mandatoryCoverId: string
      fileId: string | null
      gallery: CmsGalleryValue
      color: string | null
      // f.relation many-to-one: `<key>Id`; many-to-many and one-to-many own no column
      categoryId: string
      venueId: string | null
      // seo({ localized: true })
      metaTitle: string | null
      metaDescription: string | null
      ogImageId: string | null
    }>()
  })

  it('has no column for many-to-many and one-to-many relations', () => {
    expectTypeOf<EventRow>().not.toHaveProperty('tags')
    expectTypeOf<EventRow>().not.toHaveProperty('related')
    expectTypeOf<Row<typeof Category>>().not.toHaveProperty('events')
    expectTypeOf<Row<typeof Venue>>().not.toHaveProperty('events')
  })

  it('types a group, a list and blocks inside', () => {
    expectTypeOf<NonNullable<EventRow['contact']>['phone']>().toEqualTypeOf<string | null | undefined>()
    expectTypeOf<NonNullable<EventRow['contact']>['address']>().toEqualTypeOf<{ street?: string | null; city?: string | null } | null | undefined>()
    expectTypeOf<EventRow['blocks'][number]['type']>().toEqualTypeOf<'feature' | 'quote'>()
    expectTypeOf<EventRow['schedule'][number]>().toMatchTypeOf<{ id: string; type: 'item'; at: string }>()
    expectTypeOf<EventRow['faq'][number]['type']>().toEqualTypeOf<'qa'>()
    expectTypeOf<NonNullable<Extract<EventRow['blocks'][number], { type: 'feature' }>['bullets']>[number]['type']>().toEqualTypeOf<'bullet'>()
    expectTypeOf<Feature>().toEqualTypeOf<EventRow['blocks']>()
    expectTypeOf<CmsBlock>().toMatchTypeOf<{ id: string; type: string }>()
  })

  it('is exact for the other entities, a singleton and the presets', () => {
    expectTypeOf<Row<typeof Category>>().toEqualTypeOf<{
      id: string; createdAt: Date; updatedAt: Date; createdBy: string | null; updatedBy: string | null
      name: string; slug: string; color: string; order: number | null
    }>()
    expectTypeOf<Row<typeof Venue>>().toEqualTypeOf<{ id: string; createdAt: Date; updatedAt: Date; createdBy: string | null; updatedBy: string | null; name: string }>()
    expectTypeOf<Row<typeof Settings>>().toEqualTypeOf<{
      id: string; createdAt: Date; updatedAt: Date; createdBy: string | null; updatedBy: string | null
      siteName: string; logoId: string | null; accent: string | null
      metaTitle: string | null; metaDescription: string | null; ogImageId: string | null
    }>()
    // definePages({ tree: true }) adds the parent and the position
    expectTypeOf<Row<typeof Page>['parentId']>().toEqualTypeOf<string | null>()
    expectTypeOf<Row<typeof Page>['position']>().toEqualTypeOf<number>()
    expectTypeOf<Row<typeof Page>['status']>().toEqualTypeOf<'draft' | 'published'>()
  })

  it('refuses what is not a row', () => {
    // @ts-expect-error 'nope' is not one of the options
    const status: EventRow['status'] = 'nope'
    // @ts-expect-error a foreign key is `categoryId`, not `category`
    type NoCategory = EventRow['category']
    // @ts-expect-error a required text is not nullable
    const title: EventRow['title'] = null
    void status; void title
    expectTypeOf<NoCategory>().toBeAny()
  })
})

describe('Insert: what a create takes, at the API keys', () => {
  type EventInsert = Insert<typeof Event>

  it('requires what has no default and is not optional', () => {
    expectTypeOf<RequiredKeys<EventInsert>>().toEqualTypeOf<'title' | 'slug' | 'seats' | 'startsAt' | 'kind' | 'body' | 'category' | 'mandatoryCover'>()
  })

  it('leaves out what has a default, is optional, or is a list', () => {
    expectTypeOf<OptionalKeys<EventInsert>>().toEqualTypeOf<
      | 'perex' | 'email' | 'web' | 'oldPath' | 'link' | 'place' | 'internalNote'
      | 'price' | 'rating' | 'free' | 'consent' | 'publishedAt' | 'allDayFrom' | 'status' | 'level'
      | 'blocks' | 'schedule' | 'faq' | 'contact' | 'cover' | 'file' | 'gallery' | 'color' | 'venue' | 'tags' | 'related'
      | 'metaTitle' | 'metaDescription' | 'ogImage'
    >()
  })

  it('takes API keys: a relation or a picture is the id under its own name, a many-to-many is a list of ids', () => {
    expectTypeOf<EventInsert['category']>().toEqualTypeOf<string>()
    expectTypeOf<EventInsert['mandatoryCover']>().toEqualTypeOf<string>()
    expectTypeOf<EventInsert['cover']>().toEqualTypeOf<string | null | undefined>()
    expectTypeOf<EventInsert['venue']>().toEqualTypeOf<string | null | undefined>()
    expectTypeOf<EventInsert['tags']>().toEqualTypeOf<string[] | undefined>()
    expectTypeOf<EventInsert['related']>().toEqualTypeOf<string[] | undefined>()
    expectTypeOf<EventInsert>().not.toHaveProperty('categoryId')
    expectTypeOf<EventInsert>().not.toHaveProperty('createdAt')
  })

  it('takes a date or a string for a datetime, and the options for a select', () => {
    expectTypeOf<EventInsert['startsAt']>().toEqualTypeOf<Date | string>()
    expectTypeOf<EventInsert['publishedAt']>().toEqualTypeOf<Date | string | null | undefined>()
    expectTypeOf<EventInsert['kind']>().toEqualTypeOf<'talk' | 'workshop'>()
    // a decimal takes a number or a numeric string; a whole number only a number
    expectTypeOf<EventInsert['price']>().toEqualTypeOf<number | string | null | undefined>()
    expectTypeOf<EventInsert['seats']>().toEqualTypeOf<number>()
    expectTypeOf<EventInsert['status']>().toEqualTypeOf<'draft' | 'published' | 'cancelled' | undefined>()
  })

  it('is exact for the smaller entities and the presets', () => {
    expectTypeOf<Insert<typeof Category>>().toEqualTypeOf<{ name: string; slug: string; color: string; order?: number | null | undefined }>()
    expectTypeOf<RequiredKeys<Insert<typeof Settings>>>().toEqualTypeOf<'siteName'>()
    expectTypeOf<RequiredKeys<Insert<typeof Page>>>().toEqualTypeOf<'title' | 'slug'>()
    expectTypeOf<Insert<typeof Page>['parent']>().toEqualTypeOf<string | null | undefined>()
  })

  it('refuses what is not an insert', () => {
    const ok: EventInsert = { title: 't', slug: 's', seats: 1, startsAt: new Date(), kind: 'talk', body: { type: 'doc' }, category: 'c', mandatoryCover: 'm' }
    void ok
    // @ts-expect-error a title is required
    const noTitle: EventInsert = { slug: 's', seats: 1, startsAt: new Date(), kind: 'talk', body: { type: 'doc' }, category: 'c', mandatoryCover: 'm' }
    // @ts-expect-error 'party' is not a kind
    const badKind: EventInsert = { ...ok, kind: 'party' }
    // @ts-expect-error seats is a number
    const badSeats: EventInsert = { ...ok, seats: '3' }
    // @ts-expect-error a many-to-many takes ids, not one id
    const badTags: EventInsert = { ...ok, tags: 'x' }
    void noTitle; void badKind; void badSeats; void badTags
  })
})

describe('Update: every key of an insert, all optional', () => {
  it('takes a decimal as a number or a string', () => {
    const ok: Update<typeof Event> = { price: 19.99 }
    const alsoOk: Update<typeof Event> = { price: '19.99' }
    // @ts-expect-error a decimal is not a boolean
    const bad: Update<typeof Event> = { price: true }
    void ok; void alsoOk; void bad
  })

  it('is a partial insert', () => {
    expectTypeOf<Update<typeof Event>>().toEqualTypeOf<Partial<Insert<typeof Event>>>()
    expectTypeOf<RequiredKeys<Update<typeof Event>>>().toEqualTypeOf<never>()
    // @ts-expect-error even in an update 'party' is not a kind
    const bad: Update<typeof Event> = { kind: 'party' }
    void bad
  })
})

describe('the field factories', () => {
  it('give each field the kind that drives Row and Insert', () => {
    expectTypeOf(f.text()).toEqualTypeOf<FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: false }>>()
    expectTypeOf(f.text().optional()).toEqualTypeOf<FieldDescriptor<{ out: string | null; in: string | null | undefined; col: 'scalar'; optionalIn: true }>>()
    expectTypeOf(f.text().withDefault('x')).toEqualTypeOf<FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: true }>>()
    expectTypeOf(f.slug()).toEqualTypeOf<FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: false }>>()
    expectTypeOf(f.number()).toEqualTypeOf<FieldDescriptor<{ out: number; in: number; col: 'scalar'; optionalIn: false }>>()
    expectTypeOf(f.number({ int: true, min: 1 })).toEqualTypeOf<FieldDescriptor<{ out: number; in: number; col: 'scalar'; optionalIn: false }>>()
    // `int: false` is a decimal: read as a string (the column is `numeric`), written as a number or a string
    expectTypeOf(f.number({ int: false })).toEqualTypeOf<FieldDescriptor<{ out: string; in: number | string; col: 'scalar'; optionalIn: false }>>()
    expectTypeOf(f.number({ int: false }).optional()).toEqualTypeOf<FieldDescriptor<{ out: string | null; in: number | string | null | undefined; col: 'scalar'; optionalIn: true }>>()
    expectTypeOf(f.boolean()).toEqualTypeOf<FieldDescriptor<{ out: boolean; in: boolean; col: 'scalar'; optionalIn: true }>>()
    expectTypeOf(f.datetime()).toEqualTypeOf<FieldDescriptor<{ out: Date; in: Date | string; col: 'scalar'; optionalIn: false }>>()
    expectTypeOf(f.richtext()).toEqualTypeOf<FieldDescriptor<{ out: RichTextDoc; in: RichTextDoc; col: 'scalar'; optionalIn: false }>>()
    expectTypeOf(f.gallery()).toEqualTypeOf<FieldDescriptor<{ out: CmsGalleryValue; in: CmsGalleryValue; col: 'scalar'; optionalIn: true }>>()
    expectTypeOf(f.color()).toEqualTypeOf<FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: false }>>()
    expectTypeOf(f.media()).toEqualTypeOf<FieldDescriptor<{ out: string; in: string; col: 'fk'; optionalIn: false }>>()
    expectTypeOf(f.file()).toEqualTypeOf<FieldDescriptor<{ out: string; in: string; col: 'fk'; optionalIn: false }>>()
  })

  it('narrow a select to its options, with or without a default', () => {
    expectTypeOf(f.select({ options: ['a', 'b'] as const })).toEqualTypeOf<FieldDescriptor<{ out: 'a' | 'b'; in: 'a' | 'b'; col: 'scalar'; optionalIn: false }>>()
    expectTypeOf(f.select({ options: ['a', 'b'] as const, default: 'a' })).toEqualTypeOf<FieldDescriptor<{ out: 'a' | 'b'; in: 'a' | 'b'; col: 'scalar'; optionalIn: true }>>()
    // @ts-expect-error the default must be one of the options
    f.select({ options: ['a', 'b'] as const, default: 'c' })
    // @ts-expect-error a label is for an option
    f.select({ options: ['a', 'b'] as const, labels: { c: 'C' } })
  })

  it('type the value of a relation by its kind', () => {
    expectTypeOf(f.relation({ to: () => Category, kind: 'many-to-one' })).toEqualTypeOf<FieldDescriptor<{ out: string | null; in: string | null | undefined; col: 'fk'; optionalIn: true }>>()
    expectTypeOf(f.relation({ to: () => Category, kind: 'many-to-one', required: true })).toEqualTypeOf<FieldDescriptor<{ out: string; in: string; col: 'fk'; optionalIn: false }>>()
    expectTypeOf(f.relation({ to: () => Category, kind: 'many-to-many' })).toEqualTypeOf<FieldDescriptor<{ out: never; in: string[]; col: 'none'; optionalIn: true }>>()
    expectTypeOf(f.relation({ to: () => Category, kind: 'one-to-many' })).toEqualTypeOf<FieldDescriptor<{ out: never; in: never; col: 'none'; optionalIn: true }>>()
  })

  it('keep the kind through every modifier', () => {
    const base = f.text({ required: true })
    expectTypeOf(base.localized().label('L').help('H').position('sidebar').icon('i-lucide-x').group('G').unique()).toEqualTypeOf(base)
    // @ts-expect-error a position is main or sidebar
    base.position('top')
  })

  it('check the options of each factory', () => {
    // (Not run: some of these would throw at run time, which is not what is tested here.)
    const notRun = (_check: () => unknown) => {}
    // @ts-expect-error a text format is one of email, url, path, link
    notRun(() => f.text({ format: 'phone' }))
    // @ts-expect-error int is a boolean
    notRun(() => f.number({ int: 'yes' }))
    // @ts-expect-error `now` is the only datetime default
    notRun(() => f.datetime({ default: 'tomorrow' }))
    // @ts-expect-error a list needs its fields
    notRun(() => f.list({}))
    // @ts-expect-error a relation needs its kind
    notRun(() => f.relation({ to: () => Category }))
  })
})

describe('lists, groups and blocks', () => {
  it('type a list item with its stable id and its type', () => {
    const team = f.list({ fields: { name: f.text({ required: true }), age: f.number().optional() } })
    expectTypeOf<Row<Entity<{ team: typeof team }>>['team']>().toEqualTypeOf<CmsListValue<{ name: typeof team extends FieldDescriptor<any> ? FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: false }> : never; age: FieldDescriptor<{ out: number | null; in: number | null | undefined; col: 'scalar'; optionalIn: true }> }>>()
  })

  it('defineBlock keeps the type of its fields', () => {
    const block = defineBlock({ label: 'B', fields: { heading: f.text({ required: true }), tone: f.select({ options: ['a', 'b'] as const }) } })
    expectTypeOf<BlocksValue<{ b: typeof block }>[number]>().toEqualTypeOf<{ id: string; type: 'b'; heading: string; tone: 'a' | 'b' }>()
  })
})

describe('the definitions', () => {
  it('defineEntity returns an Entity of its fields, and defineSingleton the same', () => {
    expectTypeOf(Event).toMatchTypeOf<Entity<any>>()
    expectTypeOf(Settings).toMatchTypeOf<Entity<any>>()
    expectTypeOf(Event.name).toEqualTypeOf<string>()
    expectTypeOf(Event.fields.title).toEqualTypeOf<FieldDescriptor<{ out: string; in: string; col: 'scalar'; optionalIn: false }>>()
  })

  it('checks the keys an entity names: titleField, columns, content, publish', () => {
    defineEntity('probe', {
      label: 'Probes',
      titleField: 'name',
      admin: { list: { columns: ['name'], searchable: ['name'] }, tabs: [{ label: 'T', fields: ['name'] }] },
      content: { public: true, slug: 'name', hidden: ['name'], populate: ['name'] },
      fields: { name: f.text({ required: true }) },
    })
    // @ts-expect-error titleField must be a field of the entity
    defineEntity('probe', { label: 'Probes', titleField: 'nope', fields: { name: f.text() } })
    // @ts-expect-error a column must be a field
    defineEntity('probe', { label: 'Probes', titleField: 'name', admin: { list: { columns: ['nope'] } }, fields: { name: f.text() } })
    // @ts-expect-error content.hidden names fields
    defineEntity('probe', { label: 'Probes', titleField: 'name', content: { hidden: ['nope'] }, fields: { name: f.text() } })
    // @ts-expect-error publish.field names a field
    defineEntity('probe', { label: 'Probes', titleField: 'name', publish: { field: 'nope', publishedValue: 'a', draftValue: 'b' }, fields: { name: f.text() } })
    expectTypeOf<EntityDef<{ name: ReturnType<typeof f.text> }>['titleField']>().toEqualTypeOf<'name'>()
  })

  it('defineSingleton takes no `singleton` and a narrower admin', () => {
    // @ts-expect-error a singleton has no list
    defineSingleton('probe', { label: 'P', titleField: 'name', admin: { list: { columns: ['name'] } }, fields: { name: f.text() } })
  })

  it('defineLocales types the languages as strings', () => {
    expectTypeOf(defineLocales({ default: 'cs', locales: ['cs', 'en'] }).default).toEqualTypeOf<string>()
  })

  it('defineSeed takes a function of the seed context', () => {
    expectTypeOf(defineSeed).parameter(0).toEqualTypeOf<(s: SeedContext) => Promise<void> | void>()
  })

  it('defineCmsPlugin and the forms plugin', () => {
    expectTypeOf(defineCmsPlugin).parameter(0).toHaveProperty('name')
    expectTypeOf(formsPlugin()).toHaveProperty('__cms')
    expectTypeOf(defineForm).parameter(0).toEqualTypeOf<string>()
    expectTypeOf(defineFormSettings).toBeFunction()
  })
})

describe('roles, field access and per-language publishing', () => {
  // (test/contracts/surface/cms.config.ts: a role of the site's own, a field with `.access()` then `.label()`, `publish.perLocale`.)
  it('hands out role references, built-in and the site\'s own', () => {
    expectTypeOf(surface.roles.translator).toMatchTypeOf<{ name: string }>()
    expectTypeOf(surface.roles.editor).toMatchTypeOf<{ name: string }>()
    // @ts-expect-error a typo in a role name is a compile error
    void surface.roles.translatr
  })

  it('takes role references in a field\'s `.access()` and keeps the field\'s kind through `.label()`', () => {
    const field = f.text().optional().access({ read: ['editor', surface.roles.translator], edit: ['editor'] }).label({ en: 'Note' })
    expectTypeOf(field).toEqualTypeOf<FieldDescriptor<{ out: string | null; in: string | null | undefined; col: 'scalar'; optionalIn: true }>>()
    // (Not run: a typo would throw at run time, which is not what is tested here.)
    const notRun = (_check: () => unknown) => {}
    // @ts-expect-error a role is a built-in name or a reference, not any string
    notRun(() => f.text().access({ read: ['translator'] }))
    // @ts-expect-error a typo in a reference is not a role
    notRun(() => f.text().access({ edit: [surface.roles.translatr] }))
    expectTypeOf(Event.fields.internalNote).toEqualTypeOf<FieldDescriptor<{ out: string | null; in: string | null | undefined; col: 'scalar'; optionalIn: true }>>()
  })

  it('refuses a role that extends admin or redefines a built-in one', () => {
    const notRun = (_check: () => unknown) => {}
    // @ts-expect-error only the built-in admin manages people
    notRun(() => defineRoles({ boss: { from: 'admin' } }))
    // @ts-expect-error a built-in role is not redefined
    notRun(() => defineRoles({ editor: { from: 'editor' } }))
  })

  it('leaves the row types alone: `publish.perLocale` adds no key to Row, Insert or the client item', () => {
    expectTypeOf<Row<typeof Event>>().not.toHaveProperty('published')
    expectTypeOf<Insert<typeof Event>>().not.toHaveProperty('published')
    expectTypeOf<EventItem>().not.toHaveProperty('published')
    // (and `surface.openapi.json` and `surface.client-types.ts` did not change when the option was added to this config: the language's state is the admin's, not the content API's)
    expect(Event.publish?.perLocale).toBe(true)
  })

  it('types the person an `access` rule is asked about', () => {
    expectTypeOf<CmsAccessUser>().toMatchTypeOf<{ id: string; email: string; name: string; role: string; base: 'admin' | 'editor' | 'author' | null; locale: string | null }>()
    // claims an external sign-in adds are there, as `unknown`
    expectTypeOf<CmsAccessUser['groups']>().toEqualTypeOf<unknown>()
    defineEntity('probe', {
      label: 'Probes', titleField: 'name', fields: { name: f.text({ required: true }) },
      access: {
        read: ({ user }) => user.base !== null,
        update: ({ user, table }) => (user.role === 'admin' ? true : eq(table.createdBy, user.id)),
        delete: ({ user }) => typeof user.tenant === 'string' && user.tenant === 'acme',
      },
    })
    defineEntity('probe', {
      label: 'Probes', titleField: 'name', fields: { name: f.text({ required: true }) },
      // @ts-expect-error the person has no `isAdmin`: it would be `unknown`, which is not a condition
      access: { read: ({ user }) => user.role.isAdmin },
    })
    defineEntity('probe', {
      label: 'Probes', titleField: 'name', fields: { name: f.text({ required: true }) },
      // @ts-expect-error `base` is a built-in role name or null, not 'owner'
      access: { read: ({ user }) => user.base === 'owner' },
    })
  })
})

describe('forms', () => {
  const ContactForm = defineForm('contactForm', {
    label: 'Contact form',
    fields: { name: f.text({ required: true }), email: f.text({ required: true, format: 'email' }), message: f.text({ multiline: true }).optional(), seats: f.number({ int: false }).optional() },
  })

  it('types a form\'s rows from its fields and its state', () => {
    expectTypeOf(ContactForm).toMatchTypeOf<Entity<any>>()
    expectTypeOf<Row<typeof ContactForm>['name']>().toEqualTypeOf<string>()
    expectTypeOf<Row<typeof ContactForm>['message']>().toEqualTypeOf<string | null>()
    expectTypeOf<Row<typeof ContactForm>['seats']>().toEqualTypeOf<string | null>()
    expectTypeOf<Row<typeof ContactForm>['status']>().toEqualTypeOf<'new' | 'read' | 'done'>()
    expectTypeOf<Insert<typeof ContactForm>>().toEqualTypeOf<{ name: string; email: string; message?: string | null | undefined; seats?: number | string | null | undefined; status?: 'new' | 'read' | 'done' | undefined }>()
    // @ts-expect-error a form has no such field
    type Missing = Row<typeof ContactForm>['phone']
    expectTypeOf<Missing>().toBeAny()
  })
})

describe('the admin extension points', () => {
  it('give a field renderer the field of the graph, and the entity', () => {
    expectTypeOf<CmsFieldEditProps>().toEqualTypeOf<{ field: CmsAdminField; entity: string; id?: string }>()
    expectTypeOf<CmsFieldCellProps>().toEqualTypeOf<{ field: CmsAdminField; row: Record<string, unknown>; entity: string }>()
    expectTypeOf<CmsAdminField['relation']>().toEqualTypeOf<{ to: string; kind: 'many-to-one' | 'one-to-many' | 'many-to-many'; required: boolean } | undefined>()
  })

  it('describe the graph the registry builds', () => {
    const graph = buildRegistry(surface).graph
    const event = graph.find((e: { name: string }) => e.name === 'event')
    const fields: CmsAdminField[] = event.fields
    expect(fields.map((x) => x.key)).toContain('title')
  })
})

describe('the typed content client (generated from the config)', () => {
  // (The assertions are about types; the calls that stay in the file get an answer that is nothing.)
  const cms = createClient({ baseUrl: 'https://cms.example.com', fetch: async () => new Response('{}') })

  it('is a CmsClient of the generated schemas', () => {
    expectTypeOf(cms).toEqualTypeOf<CmsClient<ContentSchema, GlobalSchema>>()
    expectTypeOf(createCmsClient<ContentSchema, GlobalSchema>).returns.toEqualTypeOf<CmsClient<ContentSchema, GlobalSchema>>()
  })

  it('lists a collection with typed sort, filters and items', () => {
    expectTypeOf(cms.event.list).parameter(0).toEqualTypeOf<ListParams<ContentSchema['event']['sort'], ContentSchema['event']['filters']> | undefined>()
    expectTypeOf(cms.event.list).returns.resolves.toEqualTypeOf<ListResponse<EventItem>>()
    expectTypeOf(cms.event.get).returns.resolves.toEqualTypeOf<EventItem>()
    expectTypeOf<Parameters<typeof cms.event.list>[0]>().toMatchTypeOf<{ sort?: 'startsAt' | 'title' | 'createdAt' | 'updatedAt' | 'status' | 'slug' | 'seats' | string; filter?: { status?: 'draft' | 'published' | 'cancelled' } } | undefined>()
  })

  it('has the item types the config implies', () => {
    expectTypeOf<EventItem['status']>().toEqualTypeOf<'draft' | 'published' | 'cancelled'>()
    expectTypeOf<EventItem['level']>().toEqualTypeOf<'easy' | 'hard' | null>()
    expectTypeOf<EventItem['startsAt']>().toEqualTypeOf<string>()
    expectTypeOf<EventItem['seats']>().toEqualTypeOf<number>()
    // a numeric column (`f.number({ int: false })`) is text on the wire
    expectTypeOf<EventItem['price']>().toEqualTypeOf<string | null>()
    expectTypeOf<EventItem['blocks'][number]['type']>().toEqualTypeOf<'feature' | 'quote'>()
    expectTypeOf<EventItem['category']['name']>().toEqualTypeOf<string>()
    expectTypeOf<EventItem['tags'][number]['id']>().toEqualTypeOf<string>()
    expectTypeOf<EventItem['locale']>().toEqualTypeOf<'cs' | 'en' | 'de'>()
    expectTypeOf<EventItem['paths']>().toEqualTypeOf<Partial<Record<'cs' | 'en' | 'de', string>>>()
    // `content.hidden` fields and fields outside `content.populate` that are relations are not in the item
    expectTypeOf<EventItem>().not.toHaveProperty('internalNote')
    expectTypeOf<EventItem>().not.toHaveProperty('categoryId')
    expectTypeOf<CategoryItem>().not.toHaveProperty('order')
    // a page tree has an address and breadcrumbs
    expectTypeOf<PageItem['path']>().toEqualTypeOf<string | null>()
    expectTypeOf<PageItem['breadcrumbs']>().toEqualTypeOf<Array<{ title: string; path: string }>>()
  })

  it('has `tree()` only on a page tree', () => {
    expectTypeOf(cms.page).toHaveProperty('tree')
    expectTypeOf(cms.event).not.toHaveProperty('tree')
  })

  it('reads a global, possibly not saved yet', () => {
    expectTypeOf(cms.global('settings')).resolves.toEqualTypeOf<SettingsItem | null>()
    // @ts-expect-error there is no global of that name
    cms.global('nope')
  })

  it('refuses a wrong sort, filter or collection', () => {
    // @ts-expect-error 'nope' is not a sortable field
    cms.event.list({ sort: 'nope' })
    // @ts-expect-error status is one of the options
    cms.event.list({ filter: { status: 'nope' } })
    // @ts-expect-error there is no such collection of the config
    cms.collection('nope')
  })

  it('cmsMenuTree nests menu links', () => {
    expectTypeOf(cmsMenuTree<CmsMenuLink>).returns.toEqualTypeOf<CmsMenuItem<CmsMenuLink>[]>()
    expectTypeOf<CmsError['status']>().toEqualTypeOf<number>()
  })
})
