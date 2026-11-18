import { describe, expect, it } from 'vitest'
import {
  buildRegistry, defineBlock, defineEntity, defineRoles, defineSingleton, f, fieldEditable, fieldReadable, resolveRole, rolesDefOf,
  type CmsFieldRule,
} from 'tinyzoo'
import * as playground from '../../playground/cms.config'

// Custom roles (`defineRoles`) and per-field access (`.access()`): the config rules that are
// checked as the config loads, and what a role means. What the server does with them is in
// test/api/custom-roles.spec.ts.

const role = (def: Record<string, unknown> = {}) => ({ from: 'editor' as const, ...def })

describe('defineRoles', () => {
  it('returns a reference to every role: the built-ins and the site\'s own', () => {
    const roles = defineRoles({ translator: role() })
    expect(roles.translator).toEqual({ __cms: 'role', name: 'translator' })
    expect(roles.editor.name).toBe('editor')
    expect(roles.admin.name).toBe('admin')
    expect(roles.author.name).toBe('author')
    expect(Object.isFrozen(roles)).toBe(true)
    expect(Object.isFrozen(roles.translator)).toBe(true)
  })

  it('keeps the definitions out of what is enumerated (a config module is searched by `__cms`)', () => {
    const roles = defineRoles({ translator: role({ publish: false }) })
    expect(Object.keys(roles).sort()).toEqual(['__cms', 'admin', 'author', 'editor', 'translator'])
    expect(rolesDefOf(roles)?.roles.translator).toMatchObject({ from: 'editor', publish: false })
    expect(rolesDefOf({ __cms: 'roles' })).toBeNull()
    expect(rolesDefOf(null)).toBeNull()
  })

  it.each(['admin', 'editor', 'author'])('refuses to define the built-in role %s', (name) => {
    expect(() => defineRoles({ [name]: role() } as any)).toThrow(/is built in/)
  })

  it('never lets a role be or extend admin', () => {
    expect(() => defineRoles({ boss: { from: 'admin' } } as any)).toThrow(/cannot extend admin: only the built-in admin manages people/)
  })

  it('needs `from`: editor or author', () => {
    expect(() => defineRoles({ x: {} } as any)).toThrow(/must say which built-in role it extends/)
    expect(() => defineRoles({ x: { from: 'owner' } } as any)).toThrow(/must say which built-in role it extends/)
    expect(() => defineRoles({ x: undefined } as any)).toThrow(/needs a definition/)
  })

  it.each(['Translator', '1st', 'a b', '', 'x'.repeat(41), 'é', '__proto__', '-x'])('refuses the name %j', (name) => {
    expect(() => defineRoles({ [name]: role() } as any)).toThrow(/Invalid role name/)
  })

  it('accepts lower-case names with digits, dashes and underscores', () => {
    expect(() => defineRoles({ 'shop-manager_2': role() })).not.toThrow()
  })

  it('checks media, publish and the operations', () => {
    expect(() => defineRoles({ x: role({ media: 'some' }) })).toThrow(/use 'all', 'own' or 'none'/)
    expect(() => defineRoles({ x: role({ publish: 'yes' }) })).toThrow(/use true or false/)
    expect(() => defineRoles({ x: role({ entities: { post: ['read', 'write'] } }) })).toThrow(/operation "write"/)
    expect(() => defineRoles({ x: role({ entities: { post: 'read' } }) })).toThrow(/use a list of operations/)
    expect(() => defineRoles({ x: role({ entities: { post: ['update'] } }) })).toThrow(/may update "post" but not read it/)
    expect(() => defineRoles({ x: role({ entities: { post: [] } }) })).not.toThrow() // not seeing a collection at all
  })
})

describe('what a role means', () => {
  const roles = defineRoles({
    translator: role({ publish: false, media: 'own', entities: { post: ['read', 'update'] } }),
    intern: { from: 'author' },
    chief: { from: 'author', publish: true, media: 'all' },
    drafting_editor: role({ publish: false }),
  })
  const defs = rolesDefOf(roles)

  it('resolves the built-ins', () => {
    expect(resolveRole(null, 'admin')).toMatchObject({ base: 'admin', manage: true, publish: true, media: 'all', custom: false })
    expect(resolveRole(null, 'editor')).toMatchObject({ base: 'editor', manage: false, publish: true, media: 'all' })
    expect(resolveRole(null, 'author')).toMatchObject({ base: 'author', manage: false, publish: false, media: 'own' })
  })

  it('fills a custom role from what it extends, and keeps what it sets', () => {
    expect(resolveRole(defs, 'translator')).toMatchObject({ base: 'editor', custom: true, manage: false, publish: false, media: 'own' })
    expect(resolveRole(defs, 'translator')!.entities.get('post')).toEqual(new Set(['read', 'update']))
    expect(resolveRole(defs, 'intern')).toMatchObject({ base: 'author', publish: false, media: 'own' })
    expect(resolveRole(defs, 'chief')).toMatchObject({ base: 'author', publish: true, media: 'all' })
    expect(resolveRole(defs, 'drafting_editor')).toMatchObject({ base: 'editor', publish: false, media: 'all' })
  })

  it('never lets a custom role manage people', () => {
    for (const name of ['translator', 'intern', 'chief']) expect(resolveRole(defs, name)!.manage).toBe(false)
  })

  it('knows no other name: a role that was removed has no access (null)', () => {
    expect(resolveRole(defs, 'gone')).toBeNull()
    expect(resolveRole(null, 'translator')).toBeNull()
    expect(resolveRole(defs, undefined)).toBeNull()
    expect(resolveRole(defs, 42)).toBeNull()
    // Names that live on every object are not roles.
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(resolveRole(defs, name)).toBeNull()
  })

  it('keeps an unknown name of an external sign-in working as before roles existed — only on a site that defines none', () => {
    expect(resolveRole(null, 'staff', { legacyUnknown: true })).toMatchObject({ name: 'staff', base: 'editor', publish: true, media: 'all', manage: false, legacy: true })
    expect(resolveRole(defs, 'staff', { legacyUnknown: true })).toBeNull()
    // Without the flag (the built-in sign-in) an unknown name is nothing, with or without roles.
    expect(resolveRole(null, 'staff')).toBeNull()
  })
})

describe('.access()', () => {
  const roles = defineRoles({ translator: role(), reviewer: role() })

  it('stores role names: built-ins as given, custom ones by their reference', () => {
    const fld = f.text().access({ read: ['editor', roles.translator], edit: [roles.editor, 'admin', roles.translator, roles.translator] })
    expect(fld.meta.access).toEqual({ read: ['editor', 'translator'], edit: ['editor', 'admin', 'translator'] })
  })

  it('keeps the rest of the field: it chains with .label(), .optional() and .localized() in any order', () => {
    const a = f.text().access({ edit: ['editor'] }).label('Title').optional().localized()
    expect(a.meta).toMatchObject({ label: 'Title', access: { edit: ['editor'] } })
    expect(a.isOptional && a.isLocalized).toBe(true)
    const b = f.text().label('Title').localized().optional().access({ read: ['editor'] })
    expect(b.meta).toMatchObject({ label: 'Title', access: { read: ['editor'] } })
  })

  it('takes read, edit or both — a list may be empty (administrators only)', () => {
    expect(f.text().access({ read: [] }).meta.access).toEqual({ read: [] })
    expect(() => f.text().access({})).toThrow(/needs `read`, `edit` or both/)
    expect(() => f.text().access({ write: ['editor'] } as any)).toThrow(/knows read and edit, not "write"/)
    expect(() => f.text().access({ read: 'editor' } as any)).toThrow(/takes a list of roles/)
    expect(() => f.text().access({ read: [{ name: 'editor' }] } as any)).toThrow(/is not a role/)
    expect(() => f.text().access(null as any)).toThrow(/takes \{ read/)
  })

  it('is only for the fields of a collection or global, not for what sits inside a block, a list or a group', () => {
    const inner = f.text().access({ read: ['editor'] })
    expect(() => defineBlock({ label: 'B', fields: { x: inner } })).toThrow(/per-field access belongs to the fields of a collection or global/)
    expect(() => f.group({ fields: { x: inner } })).toThrow(/per-field access belongs/)
    expect(() => f.list({ fields: { x: inner }, itemLabel: 'Item' })).toThrow(/per-field access belongs/)
    // On the group itself it is fine.
    expect(() => f.group({ fields: { x: f.text() } }).access({ read: ['editor'] })).not.toThrow()
  })

  it('says who may read and who may edit', () => {
    const rule: CmsFieldRule = { read: ['editor', 'translator'], edit: ['editor'] }
    const defs = rolesDefOf(roles)
    const as = (name: string) => resolveRole(defs, name)
    expect([fieldReadable(as('admin'), rule), fieldEditable(as('admin'), rule)]).toEqual([true, true]) // always
    expect([fieldReadable(as('editor'), rule), fieldEditable(as('editor'), rule)]).toEqual([true, true])
    expect([fieldReadable(as('translator'), rule), fieldEditable(as('translator'), rule)]).toEqual([true, false]) // read-only
    expect([fieldReadable(as('author'), rule), fieldEditable(as('author'), rule)]).toEqual([false, false]) // not there
    expect([fieldReadable(as('reviewer'), rule), fieldEditable(as('reviewer'), rule)]).toEqual([false, false])
    // No rule: whoever reaches the collection. A role the site does not know: nothing.
    expect([fieldReadable(as('author'), undefined), fieldEditable(as('author'), undefined)]).toEqual([true, true])
    expect([fieldReadable(null, undefined), fieldEditable(null, undefined)]).toEqual([false, false])
    // Editing needs reading: a role in `edit` only (read left open) edits, and one outside `read` does not.
    expect(fieldEditable(as('translator'), { edit: ['translator'] })).toBe(true)
    expect(fieldEditable(as('translator'), { read: ['editor'], edit: ['translator'] })).toBe(false)
    expect(fieldReadable(as('admin'), { read: [] })).toBe(true)
    expect(fieldReadable(as('editor'), { read: [] })).toBe(false)
  })
})

describe('checks that need the entities (when the config loads)', () => {
  const entity = (name: string, over: Record<string, unknown> = {}, fields: Record<string, any> = {}) => defineEntity(name, {
    label: name, titleField: 'title', fields: { title: f.text({ required: true }), note: f.text().optional(), ...fields }, ...over,
  } as any)

  it('builds with valid roles, and the registry carries them', () => {
    const roles = defineRoles({ translator: role({ entities: { post: ['read', 'update'], settings: ['read', 'update'] } }) })
    const reg = buildRegistry({ roles, post: entity('post', {}, { body: f.text().access({ edit: [roles.translator, 'editor'] }) }), settings: defineSingleton('settings', { label: 'S', titleField: 'title', fields: { title: f.text() } }) })
    expect(reg.roles?.roles.translator?.from).toBe('editor')
    expect(buildRegistry({ post: entity('post') }).roles).toBeNull()
  })

  it('names a collection the site does not have', () => {
    const roles = defineRoles({ translator: role({ entities: { psot: ['read'] } }) })
    expect(() => buildRegistry({ roles, post: entity('post') })).toThrow(/The role "translator" lists "psot", which is not a collection or global of this site \(they are: post\)/)
    const near = defineRoles({ translator: role({ entities: { Post: ['read'] } }) })
    expect(() => buildRegistry({ roles: near, post: entity('post') })).toThrow(/did you mean "post"/)
  })

  it('gives a global read and update only', () => {
    const roles = defineRoles({ x: role({ entities: { settings: ['read', 'delete'] } }) })
    const settings = defineSingleton('settings', { label: 'S', titleField: 'title', fields: { title: f.text() } })
    expect(() => buildRegistry({ roles, settings })).toThrow(/"settings" is a global: it has read and update only/)
  })

  it('refuses a field rule that names a role the site does not have', () => {
    const roles = defineRoles({ translator: role() })
    expect(() => buildRegistry({ roles, post: entity('post', {}, { note: f.text().access({ read: ['editro' as any] }) }) })).toThrow(/post\.note: access\.read names the role "editro", which this site does not have \(roles: admin, editor, author, translator\)/)
    // Without any defineRoles only the built-ins exist.
    expect(() => buildRegistry({ post: entity('post', {}, { note: f.text().access({ edit: [{ __cms: 'role', name: 'translator' }] as any }) }) })).toThrow(/names the role "translator"/)
  })

  it('refuses a field that may be edited by a role that may not read it', () => {
    expect(() => buildRegistry({ post: entity('post', {}, { note: f.text().access({ read: ['editor'], edit: ['editor', 'author'] }) }) })).toThrow(/author may edit the field but not read it/)
    expect(() => buildRegistry({ post: entity('post', {}, { note: f.text().access({ read: ['editor'], edit: ['editor'] }) }) })).not.toThrow()
    // admin is always allowed, whatever the lists say.
    expect(() => buildRegistry({ post: entity('post', {}, { note: f.text().access({ read: ['editor'], edit: ['admin'] }) }) })).not.toThrow()
  })

  it('refuses to hide what the admin shows everyone: the title, the publish state, the address, the place in a tree', () => {
    const hide = { read: ['editor'] as const }
    expect(() => buildRegistry({ post: defineEntity('post', { label: 'P', titleField: 'title', fields: { title: f.text().access(hide) } }) })).toThrow(/post\.title is its title.*cannot be hidden with access\.read\. Restrict access\.edit instead/)
    const statusHidden = defineEntity('post', { label: 'P', titleField: 'title', fields: { title: f.text(), status: f.select({ options: ['draft', 'live'] as const, default: 'draft' }).access(hide) }, publish: { field: 'status', publishedValue: 'live', draftValue: 'draft' } })
    expect(() => buildRegistry({ post: statusHidden })).toThrow(/post\.status is its publish state/)
    const slugHidden = defineEntity('post', { label: 'P', titleField: 'title', fields: { title: f.text(), slug: f.slug().access(hide) }, content: { public: true, slug: 'slug', path: '/p/:slug' } })
    expect(() => buildRegistry({ post: slugHidden })).toThrow(/post\.slug is its address/)
    const orderHidden = defineEntity('post', { label: 'P', titleField: 'title', fields: { title: f.text(), rank: f.number({ int: true }).access(hide) }, admin: { list: { columns: ['title'], orderField: 'rank' } } })
    expect(() => buildRegistry({ post: orderHidden })).toThrow(/post\.rank is its position in the list/)
    // Writing them can be restricted.
    const editOnly = defineEntity('post', { label: 'P', titleField: 'title', fields: { title: f.text().access({ edit: ['editor'] }) } })
    expect(() => buildRegistry({ post: editOnly })).not.toThrow()
  })

  it('allows one defineRoles per site', () => {
    const a = defineRoles({ one: role() })
    const b = defineRoles({ two: role() })
    expect(() => buildRegistry({ a, b, post: entity('post') })).toThrow(/more than one `defineRoles/)
  })

  it('works with the playground\'s own roles and field rules', () => {
    const reg = buildRegistry(playground)
    expect(Object.keys(reg.roles!.roles)).toEqual(['translator', 'proofreader', 'curator', 'marketer'])
    expect((playground.Author.fields.email as any).meta.access).toEqual({ read: ['editor', 'curator'], edit: ['editor'] })
  })
})

// ── the types: role names are typed where they are named ────────────────────────────
describe('types', () => {
  const roles = defineRoles({ translator: role() })

  it('accepts the roles that exist', () => {
    expect(() => f.text().access({ read: ['editor', 'author', 'admin', roles.translator, roles.editor] })).not.toThrow()
    // A reference carries its name as a literal type.
    const name: 'translator' = roles.translator.name
    expect(name).toBe('translator')
  })

  // Never run: tsc checks them, and each `@ts-expect-error` must really be an error.
  it('refuses, at compile time, roles that do not exist, a role extending admin and the wrong operations', () => {
    const wrong = () => {
      // @ts-expect-error a role of the site is named by its reference, and "translatr" is not one
      f.text().access({ read: [roles.translatr] })
      // @ts-expect-error a custom role is not a plain string (only the built-ins are)
      f.text().access({ read: ['translator'] })
      // @ts-expect-error not a role at all
      f.text().access({ edit: ['owner'] })
      // @ts-expect-error read and edit are the only keys
      f.text().access({ write: ['editor'] })
      // @ts-expect-error a list of roles, not one
      f.text().access({ read: 'editor' })

      // @ts-expect-error a role cannot extend admin
      defineRoles({ boss: { from: 'admin' } })
      // @ts-expect-error a role extends editor or author: `from` is required
      defineRoles({ x: {} })
      // @ts-expect-error built-in names cannot be redefined
      defineRoles({ editor: { from: 'author' } })
      // @ts-expect-error the operations are read, create, update and delete
      defineRoles({ x: { from: 'editor', entities: { post: ['write'] } } })
      // @ts-expect-error media is all, own or none
      defineRoles({ x: { from: 'editor', media: 'some' } })
      // @ts-expect-error publish is a switch
      defineRoles({ x: { from: 'editor', publish: 'yes' } })
      // @ts-expect-error only the roles that were defined are on the result
      void roles.translatr
    }
    expect(typeof wrong).toBe('function')
  })
})
