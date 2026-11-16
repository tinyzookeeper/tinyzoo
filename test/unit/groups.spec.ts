import { describe, expect, it } from 'vitest'
import {
  blocksSchema, buildContentModel, buildOpenApiDocument, defineBlock, defineEntity, defineLocales, emitContentTypes, emitSchema, entryTexts, f,
  mediaIdsInBlocks, mediaIdsInFields, upgradeStoredRow,
} from 'tinyzoo'
import * as config from '../../playground/cms.config'

const M = '00000000-0000-4000-8000-0000000000aa'
const address = () => f.group({
  fields: {
    street: f.text({ required: true }),
    city: f.text({ required: true }),
    zip: f.text(),
    since: f.datetime().optional(),
    about: f.richtext().optional(),
    photo: f.media({ accept: 'image/*' }).optional(),
  },
})

describe('f.group', () => {
  it('is one jsonb column, typed as an object', () => {
    const g = address()
    expect(g.type).toBe('group')
    expect(g.spec?.base).toEqual({ kind: 'jsonb' })
    expect(g.spec?.notNull).toBe(true)
    expect(address().optional().spec?.notNull).toBe(false)
    expect((g.meta as any).fields.map((x: any) => x.key)).toEqual(['street', 'city', 'zip', 'since', 'about', 'photo'])
  })

  it('checks each field on its own: required ones must be filled in, the rest may be empty', () => {
    const z = address().zod('create')
    expect(z.parse({ street: 'Dlouhá 1', city: 'Tábor' })).toEqual({ street: 'Dlouhá 1', city: 'Tábor' })
    expect(z.parse({ street: 'Dlouhá 1', city: 'Tábor', zip: null, about: null, photo: null })).toMatchObject({ zip: null })
    const missing = z.safeParse({ street: '', city: 'Tábor' })
    expect(missing.success).toBe(false)
    expect(missing.error!.issues[0]!.path).toEqual(['street'])
    expect(z.safeParse({ street: 'x' }).success).toBe(false) // city missing
    expect(z.safeParse('Tábor').success).toBe(false) // not an object
    expect(z.safeParse(['x']).success).toBe(false)
  })

  it('uses each field’s own rule (media is a uuid, rich text is sanitised, a link is safe)', () => {
    const z = address().zod('create')
    expect(z.safeParse({ street: 'a', city: 'b', photo: 'not-a-uuid' }).success).toBe(false)
    expect(z.parse({ street: 'a', city: 'b', photo: M })).toMatchObject({ photo: M })
    const unsafe = z.parse({ street: 'a', city: 'b', about: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] } })
    expect(JSON.stringify(unsafe)).not.toContain('javascript:')
    const link = f.group({ fields: { site: f.text({ format: 'link' }) } }).zod('create')
    expect(link.safeParse({ site: 'javascript:alert(1)' }).success).toBe(false)
    expect(link.safeParse({ site: '/kontakt' }).success).toBe(true)
  })

  it('drops keys it does not know, and fills defaults (a switch is off)', () => {
    const z = f.group({ fields: { name: f.text(), open: f.boolean() } }).zod('create')
    expect(z.parse({ name: 'A', extra: 1 })).toEqual({ name: 'A', open: false })
  })

  it('may be absent when optional, and stays untouched on an update that leaves it out', () => {
    const opt = address().optional()
    expect(opt.zod('create').parse(null)).toBeNull()
    expect(opt.zod('create').parse(undefined)).toBeUndefined()
    expect(address().zod('create').safeParse(null).success).toBe(false)
    expect(address().zod('create').safeParse(undefined).success).toBe(false)
    expect(address().zod('update').parse(undefined)).toBeUndefined()
  })

  it('can be translated as a whole, and nests', () => {
    expect(address().localized().isLocalized).toBe(true)
    const nested = f.group({ fields: { place: f.group({ fields: { name: f.text({ required: true }) } }) } }).zod('create')
    expect(nested.safeParse({ place: { name: '' } }).success).toBe(false)
    expect(nested.parse({ place: { name: 'Tábor' } })).toEqual({ place: { name: 'Tábor' } })
  })

  it('holds the field types blocks hold, and nothing else', () => {
    const Tag = defineEntity('grouptag', { label: 'T', titleField: 'name', fields: { name: f.text() } })
    expect(() => f.group({ fields: { tag: f.relation({ to: () => Tag, kind: 'many-to-one' }) } })).toThrow(/do not support/)
    expect(() => f.group({ fields: { files: f.gallery() } })).toThrow(/do not support/)
    // a group may have a field called `type` or `id`: it is not a block
    expect(() => f.group({ fields: { type: f.text(), id: f.text() } })).not.toThrow()
  })
})

describe('where a group may go', () => {
  it('works inside a block and a list item, holding plain fields', () => {
    const block = defineBlock({ label: 'Contact', fields: { address: address() } })
    const z = blocksSchema({ contact: block })
    const ok = z.parse([{ id: 'c1', type: 'contact', address: { street: 'Dlouhá 1', city: 'Tábor', photo: M } }]) as any[]
    expect(ok[0].address).toMatchObject({ street: 'Dlouhá 1', photo: M })
    const bad = z.safeParse([{ id: 'c1', type: 'contact', address: { street: '', city: 'Tábor' } }])
    expect(bad.success).toBe(false)
    expect((bad as any).error.issues[0].path).toEqual([0, 'address', 'street'])
    const list = f.list({ fields: { place: address() } })
    expect(list.zod('create').safeParse([{ id: 'a', type: 'item', place: { street: 's', city: 'c' } }]).success).toBe(true)
  })

  it('holds a list only directly in a group on an entry — not in a block, a list item or a group inside a group', () => {
    const hours = f.list({ fields: { day: f.text() } })
    expect(() => f.group({ fields: { hours } })).not.toThrow()
    const withList = f.group({ fields: { hours } })
    expect(() => defineBlock({ label: 'X', fields: { g: withList } })).toThrow(/group with a list inside/)
    expect(() => f.list({ fields: { g: withList } })).toThrow(/group with a list inside/)
    expect(() => defineBlock({ label: 'X', fields: { items: f.list({ fields: { g: f.group({ fields: { t: f.text() } }) } }) } })).not.toThrow()
    // a list sits directly in the group on the entry: not in a group inside that group either
    expect(() => f.group({ fields: { inner: withList } })).toThrow(/group with a list inside/)
  })

  it('checks a list inside a group against what the same list holds now', () => {
    const g = f.group({ fields: { hours: f.list({ fields: { day: f.text({ required: true }) } }) } })
    const gone = { id: 'x', type: 'other', day: 'Po' }
    expect(g.zod('create').safeParse({ hours: [gone] }).success).toBe(false)
    expect(g.zod('update', { stored: { hours: [gone] } }).parse({ hours: [gone] })).toEqual({ hours: [gone] })
    expect(g.zod('create').parse({ hours: [{ id: 'a', type: 'item', day: 'Po' }] })).toEqual({ hours: [{ id: 'a', type: 'item', day: 'Po' }] })
  })
})

describe('stored JSON of a group', () => {
  it('finds the media in a group, inside a block and on an entry', () => {
    const g = address()
    expect(mediaIdsInFields(g.fields!, { street: 'x', photo: M })).toEqual([M])
    expect(mediaIdsInFields(g.fields!, { about: { type: 'doc', content: [{ type: 'image', attrs: { mediaId: M } }] } })).toEqual([M])
    const block = defineBlock({ label: 'C', fields: { address: g } })
    expect(mediaIdsInBlocks([{ id: 'c', type: 'contact', address: { photo: M } }], { contact: block })).toEqual([M])
    expect(mediaIdsInFields({ g: f.group({ fields: { inner: g } }) } as any, { g: { inner: { photo: M } } })).toEqual([M])
  })

  it('upgrades what is inside a group (a list’s items, through their `upgrade`)', () => {
    const g = f.group({
      fields: {
        hours: f.list({ version: 2, upgrade: (d) => ({ ...d, day: String(d.old ?? ''), old: undefined }), fields: { day: f.text() } }),
      },
    })
    const row = { schedule: { hours: [{ id: 'a', type: 'item', old: 'Po' }] } }
    upgradeStoredRow({ schedule: g } as any, row)
    expect(row.schedule.hours[0]).toMatchObject({ id: 'a', day: 'Po', v: 2 })
  })

  it('is read as text by the search index', () => {
    const fields = { place: f.group({ fields: { name: f.text(), note: f.text(), site: f.text({ format: 'link' }), more: f.group({ fields: { text: f.text() } }) } }) } as any
    expect(entryTexts(fields, { place: { name: 'Sokolovna', note: 'u nádraží', site: '/kontakt', more: { text: 'vchod z boku' } } })).toEqual(['Sokolovna', 'u nádraží', 'vchod z boku'])
    expect(entryTexts(fields, { place: null })).toEqual([])
  })
})

describe('what the content API, OpenAPI and the client say about a group', () => {
  const model = buildContentModel(config as any)
  const settings = model.globals.find((g) => g.name === 'siteSettings')!
  const contact = settings.fields.find((x) => x.key === 'contact')!

  it('is an object of its fields (null only when the group is optional)', () => {
    expect(contact.nullable).toBe(true)
    expect(contact.type.kind).toBe('group')
    const inner = (contact.type as any).fields as { key: string; nullable: boolean; type: { kind: string } }[]
    expect(inner.map((x) => [x.key, x.type.kind, x.nullable])).toEqual([
      ['phone', 'scalar', true], ['email', 'scalar', true], ['address', 'group', true], ['photo', 'media', true],
    ])
    const post = model.entities.find((e) => e.name === 'post')!
    expect(post.fields.find((x) => x.key === 'location')!.nullable).toBe(true)
  })

  it('appears in the OpenAPI document and the typed client', () => {
    const doc: any = buildOpenApiDocument(config as any)
    const schema = doc.components.schemas.SiteSettings.properties.contact
    expect(schema.type).toEqual(['object', 'null'])
    expect(schema.required).toEqual(['phone', 'email', 'address', 'photo'])
    expect(emitContentTypes(config as any)).toContain('contact: { phone: string | null; email: string | null; address: { street: string; city: string; zip: string | null } | null; photo: CmsMedia | null } | null')
  })

  it('is a jsonb column in the emitted schema, and a translated one in the locales table', () => {
    const source = emitSchema(config as any)
    expect(source).toContain("contact: jsonb('contact').$type<Record<string, unknown>>()")
    expect(source).toMatch(/location: jsonb\('location'\)\.\$type<Record<string, unknown>>\(\)/)
  })

  it('is translated as a whole group (the entity gets a translations column for it)', () => {
    const e = defineEntity('groupvenue', {
      label: 'V', titleField: 'name',
      fields: { name: f.text().localized(), where: address().optional().localized() },
    })
    expect(e.localized).toEqual(['name', 'where'])
    expect(e.localesTable).toBeTruthy()
    expect(defineLocales({ default: 'cs', locales: ['cs', 'en'] }).locales).toEqual(['cs', 'en'])
  })
})
